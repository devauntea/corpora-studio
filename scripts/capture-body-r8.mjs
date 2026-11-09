// Matched-camera review of immutable r7 and r8. No external reference pixels.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const out = process.env.BODY_REVIEW_OUTPUT || 'qa/body-017/comparison';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1.5 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.env.STUDIO_URL || 'http://127.0.0.1:1420');
const host = page.locator('.canvas-host');
const captures = [];
try {
  const fixtures = await page.evaluate(async () => {
    const { blankProject, humanBody } = await import('/src/domain.ts');
    const { musclePoseArms } = await import('/src/muscle-pose.ts');
    return { base: blankProject(), doubleBiceps: musclePoseArms('double-biceps'), bodies: Object.fromEntries(['upper-body','full-arm','full-leg','full-body'].map(s => [s,humanBody(s)])) };
  });
  for (const sex of (process.env.BODY_SEX ? [process.env.BODY_SEX] : ['male','female'])) for (const revision of (process.env.BODY_REVISION ? [Number(process.env.BODY_REVISION)] : [7,8])) {
    for (const [section, physique, flex, pose, camera, anatomy, zoom] of [
      ['upper-body','fit',0,'relaxed','front',false,1],
      ['upper-body','fit',0,'relaxed','back',false,1],
      ['upper-body','fit',0,'relaxed','left',false,1],
      ['upper-body','average',0,'relaxed','three-quarter',false,1],
      ['full-arm','fit',0,'relaxed','three-quarter',false,0],
      ['full-arm','fit',0,'relaxed','three-quarter',true,0],
      ['full-leg','fit',0,'relaxed','three-quarter',false,0],
      ['full-leg','fit',0,'relaxed','back',true,0],
      ['full-arm','fit',110,'relaxed','left',false,0],
      ['full-leg','fit',110,'relaxed','left',false,0],
      ['full-body','fit',0,'double-biceps','front',false,0],
      ['full-body','fit',0,'double-biceps','back',true,0],
    ]) {
      if (process.env.BODY_CASE && !`${section}-${physique}-${flex}-${pose}-${camera}-${anatomy ? 'muscle' : 'skin'}`.includes(process.env.BODY_CASE)) continue;
      const body = structuredClone(fixtures.bodies[section]);
      Object.assign(body, { muscularity: physique === 'fit' ? 1 : 0, flex, musclePose: pose, muscleTension: 1, anatomy, skin: '#cfae9f' });
      Object.assign(body.model, { revision, sex, physique, anatomyOpacity: 1 });
      if (section === 'full-body' && pose === 'double-biceps') body.armPose = structuredClone(fixtures.doubleBiceps);
      if (section === 'full-arm') body.armPose = {left: {flex,raise:0,twist:0},right: {flex,raise:0,twist:0}};
      const project = { ...fixtures.base, name: 'Body surface review', body };
      await page.getByLabel('Project file', { exact: true }).setInputFiles({ name: 'review.formstudio', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
      await expect.poll(async () => JSON.parse(await host.getAttribute('data-rendered-body') || '{}'), { timeout: 60000 }).toMatchObject(body);
      await page.locator('.camera-tabs').getByRole('button', { name: camera, exact: true }).click();
      await page.getByRole('button', { name: 'Fit model', exact: true }).click();
      for (let i=0;i<zoom+Number(process.env.BODY_ZOOM_EXTRA || 0);i++) await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      const close = page.getByRole("button", {name:"Dismiss notification"});
      if (await close.count()) await close.click();
      await page.waitForTimeout(500);
      const name = `${sex}-r${revision}-${section}-${physique}-${flex}-${pose}-${camera}-${anatomy ? 'muscle' : 'skin'}`;
      await host.screenshot({ path: `${out}/${name}.png` });
      captures.push({ name, body });
    }
  }
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ captures, errors }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`${captures.length} matched renders; no renderer errors.`);
} finally { await browser.close(); }
