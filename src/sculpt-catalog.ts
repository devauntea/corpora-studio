import bundledCatalog from "../public/sculpts/catalog.json" with { type: "json" };
/** Stable IDs are part of saved tattoo anchor identity. Never reuse an ID for different topology. */
export const sculptIds = [
  "torso-study",
  "anatomical-arm",
  "sculpt-torso",
  "sculpt-arm",
  "sculpt-hand",
  "sculpt-leg",
  "sculpt-foot",
  "tripo-body-study",
  "tripo-full-body",
  "tripo-human-anatomy",
  "tripo-muscular-arm",
  "tripo-muscular-forearm",
  "tripo-anatomical-human",
  "tripo-leg-one",
  "tripo-leg-two",
  "tripo-leg-three",
  "tripo-leg-four",
  "tripo-leg-five",
  "tripo-leg-six",
  "derived-anatomy-body",
  "derived-anatomy-torso",
  "derived-anatomy-left-arm",
  "derived-anatomy-right-arm",
  "derived-anatomy-left-forearm",
  "derived-anatomy-right-forearm",
  "derived-anatomy-left-leg",
  "derived-anatomy-right-leg",
  "derived-anatomy-neck",
  "derived-anatomy-head",
] as const;
export type SculptId = (typeof sculptIds)[number];
export type SculptEntry = {
  id: SculptId;
  name: string;
  section: "upper-body" | "full-arm" | "full-leg" | "full-body" | "neck";
  physicalHeightMm: number;
  chartWidthMm: number;
  chartHeightMm: number;
  author: string;
  source: string;
  file: string;
  thumbnail: string;
  description: string;
  license: string;
  groupId?: string;
  groupName?: string;
  poseName?: string;
  variantLabel?: string;
  skinEnvelope?: boolean;
  muscleThumbnail?: string;
};
export const sculptCatalog: SculptEntry[] = bundledCatalog.map((entry) => ({
  ...entry,
  id: entry.id as SculptId,
  name: entry.name,
  section: ["neck", "head"].includes(entry.section)
    ? "neck"
    : entry.section === "body"
      ? "full-body"
      : entry.section === "torso"
        ? "upper-body"
        : ["arm", "hand"].includes(entry.section)
          ? "full-arm"
          : "full-leg",
  physicalHeightMm: entry.heightMm,
  author: entry.author.split(" (")[0],
}));
export const sculptById = (id?: string) =>
  sculptCatalog.find((entry) => entry.id === id);

/** One library card per collection; variants keep separate immutable anchor IDs. */
export const sculptGroups = sculptCatalog.reduce<
  { id: SculptId; name: string; entries: SculptEntry[] }[]
>((groups, entry) => {
  // Retain IDs/assets for saved 0.19.4 projects, but retire the collection from all pickers.
  if (entry.groupId === "derived-anatomy") return groups;
  const existing =
    entry.groupId && groups.find((g) => g.entries[0].groupId === entry.groupId);
  if (existing) existing.entries.push(entry);
  else
    groups.push({
      id: entry.id,
      name: entry.groupName ?? entry.name,
      entries: [entry],
    });
  return groups;
}, []);
export const sculptGroupFor = (id?: string) =>
  sculptGroups.find((g) => g.entries.some((e) => e.id === id));
