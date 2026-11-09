import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { reviewProjectHash } from "../../src/review-room";

test("local review freezes a real revision, shares only selected views and imports feedback without geometry changes", async ({
  page,
  context,
}, info) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const open = page.getByRole("button", { name: "Review room", exact: true });
  await expect(open).toBeEnabled({ timeout: 45_000 });
  const baselineDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const baselinePath = info.outputPath("baseline.formstudio");
  await (await baselineDownload).saveAs(baselinePath);
  const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"));
  const originalHash = await reviewProjectHash(baseline);
  await open.click();
  const room = page.getByRole("dialog", { name: "Review room", exact: true });
  await expect(room).toBeVisible();
  await room.getByLabel("Review revision name").fill("Sample A");
  await room.getByLabel("Review view name").fill("Front review");
  await room.getByRole("button", { name: "Freeze & capture" }).click();
  await expect(room.getByRole("status")).toContainText("Revision frozen", {
    timeout: 45_000,
  });
  await expect(room.locator(".review-hash")).toHaveAttribute(
    "title",
    originalHash,
  );
  await room.getByRole("tab", { name: "Notes" }).click();
  await room.getByLabel("Note object or area").fill("Front artwork");
  await room
    .getByLabel("Review note", { exact: true })
    .fill("Check the top edge alignment.");
  await room.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(
    room.getByText("Check the top edge alignment.", { exact: true }),
  ).toBeVisible();
  await room.getByRole("button", { name: "Mark resolved" }).click();
  await room.getByLabel("Filter review notes").selectOption("resolved");
  await expect(
    room.getByText("Check the top edge alignment.", { exact: true }),
  ).toBeVisible();
  await room.getByRole("button", { name: "Reopen note" }).click();
  await room.getByRole("tab", { name: "Views" }).click();
  await room.getByLabel("Review view name").fill("PRIVATE unused view");
  await room.getByRole("button", { name: "Capture current view" }).click();
  await expect(room.getByRole("status")).toContainText("Rendered view added");
  await room.getByRole("tab", { name: "Share" }).click();
  const exportButton = room.getByRole("button", {
    name: "Export selected review views",
  });
  await expect(exportButton).toBeDisabled();
  await room.getByLabel("Share Front review").check();
  const accessibility = await new AxeBuilder({ page })
    .include(".review-room")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  const archiveDownload = page.waitForEvent("download");
  await exportButton.click();
  const archivePath = info.outputPath("review.zip");
  await (await archiveDownload).saveAs(archivePath);
  const files = unzipSync(new Uint8Array(await fs.readFile(archivePath)));
  const metadata = JSON.parse(strFromU8(files["review.json"]));
  expect(metadata.revision.hash).toBe(originalHash);
  expect(metadata.views).toHaveLength(1);
  expect(metadata.views[0].name).toBe("Front review");
  expect(Object.keys(files).filter((f) => f.endsWith(".png"))).toEqual([
    "views/view-1.png",
  ]);
  expect(strFromU8(files["review.json"])).not.toContain("PRIVATE unused view");
  expect(metadata.assets).toBeUndefined();
  await room.screenshot({
    path: `qa/review-room/${info.project.name}-share.png`,
  });
  const extracted = info.outputPath("review-bundle");
  for (const [name, bytes] of Object.entries(files)) {
    const output = path.join(extracted, name);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, bytes);
  }
  const recipient = await context.newPage(),
    external: string[] = [];
  recipient.on("pageerror", (e) => errors.push(e.message));
  recipient.on("request", (request) => {
    if (/^https?:/.test(request.url())) external.push(request.url());
  });
  await recipient.goto(pathToFileURL(path.join(extracted, "index.html")).href);
  await expect(
    recipient.getByRole("heading", { name: "Your feedback" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      recipient
        .locator("figure img")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await recipient.getByLabel("Your name").fill("Sample maker");
  await recipient
    .getByLabel("View", { exact: true })
    .selectOption(metadata.views[0].id);
  await recipient.getByLabel("Object or area").fill("Upper edge");
  await recipient
    .getByLabel("Note", { exact: true })
    .fill("Move 5 mm toward the shoulder. <script>never execute</script>");
  await recipient
    .getByRole("button", { name: "Add note", exact: true })
    .click();
  await recipient
    .getByLabel("I reviewed the selected views of this revision.")
    .check();
  const feedbackDownload = recipient.waitForEvent("download");
  await recipient
    .getByRole("button", { name: "Download feedback JSON" })
    .click();
  const feedbackPath = info.outputPath("feedback.json");
  await (await feedbackDownload).saveAs(feedbackPath);
  const feedback = JSON.parse(await fs.readFile(feedbackPath, "utf8"));
  expect(feedback.revisionHash).toBe(originalHash);
  expect(feedback.notes).toHaveLength(1);
  expect(feedback.acknowledgement.viewIds).toEqual([metadata.views[0].id]);
  expect(external).toEqual([]);
  await recipient.close();
  await room.locator('input[type="file"]').setInputFiles(feedbackPath);
  await expect(room.getByRole("status")).toContainText(
    "2 feedback records imported",
  );
  await expect(
    room.getByText(
      "Move 5 mm toward the shoulder. <script>never execute</script>",
      { exact: true },
    ),
  ).toBeVisible();
  await room.locator('input[type="file"]').setInputFiles({
    name: "wrong.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...feedback, revisionHash: "0".repeat(64) }),
    ),
  });
  await expect(room.getByRole("alert")).toContainText("unknown revision");
  await room.getByRole("button", { name: "Return to studio" }).click();
  await expect(open).toBeFocused();
  const savedDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const savedPath = info.outputPath("reviewed.formstudio");
  await (await savedDownload).saveAs(savedPath);
  const saved = JSON.parse(await fs.readFile(savedPath, "utf8"));
  expect(saved.body).toEqual(baseline.body);
  expect(saved.layers).toEqual(baseline.layers);
  expect(saved.assets).toEqual(baseline.assets);
  expect(saved.review.revisions[0].notes).toHaveLength(2);
  expect(saved.review.revisions[0].acknowledgements).toHaveLength(1);
  await page
    .getByLabel("Project file", { exact: true })
    .setInputFiles(savedPath);
  await open.click();
  await expect(
    room.getByText("Matches the current project", { exact: true }),
  ).toBeVisible();
  await room.press("Escape");
  await expect(room).not.toBeVisible();
  await page.getByLabel("Project file", { exact: true }).setInputFiles({
    name: "changed.formstudio",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...saved,
        body: { ...saved.body, length: saved.body.length + 10 },
      }),
    ),
  });
  await open.click();
  await expect(
    room.getByText("Earlier project state", { exact: false }),
  ).toBeVisible();
  await expect(
    room.getByRole("button", { name: "Capture current view" }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});
