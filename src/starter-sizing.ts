import type {
  Fashion,
  MeasurementKey,
  MeasurementProfile,
} from "./fashion-model";

export type StarterSize = "S" | "M" | "L";
export type StarterBody = "male" | "female";
export type StarterId = `${StarterBody}-${Lowercase<StarterSize>}`;
export type CompleteMeasurements = Required<Fashion["measurements"]>;
export const sizingSources = {
  chart: "https://simplicity.com/size-charts/",
  landmarks: "https://freesewing.eu/docs/measurements/",
  fit: "https://freesewing.eu/docs/about/faq/standard-measurements/",
} as const;
export type MeasurementEvidence = {
  kind: "chart" | "estimate";
  basis: string;
};
export type StarterProfile = {
  id: StarterId;
  body: StarterBody;
  size: StarterSize;
  name: string;
  sourceSize: string;
  heightMm: number;
  measurements: CompleteMeasurements;
  evidence: Record<MeasurementKey, MeasurementEvidence>;
};

// Published centimetre columns, converted to millimetres. Pick the upper
// numerical size in each publisher's S/M/L band; do not interpolate new sizes.
// "Hip" in this chart is the full seat, NOT FreeSewing's high-hip landmark.
const charts = {
  male: [
    {
      size: "S",
      source: "Men 36",
      chest: 920,
      waist: 760,
      seat: 940,
      neckband: 370,
    },
    {
      size: "M",
      source: "Men 40",
      chest: 1020,
      waist: 870,
      seat: 1040,
      neckband: 395,
    },
    {
      size: "L",
      source: "Men 44",
      chest: 1120,
      waist: 990,
      seat: 1140,
      neckband: 420,
    },
  ],
  female: [
    {
      size: "S",
      source: "Misses 10",
      chest: 830,
      waist: 640,
      seat: 880,
      highBust: 780,
      backWaist: 405,
    },
    {
      size: "M",
      source: "Misses 14",
      chest: 920,
      waist: 710,
      seat: 970,
      highBust: 870,
      backWaist: 420,
    },
    {
      size: "L",
      source: "Misses 18",
      chest: 1020,
      waist: 810,
      seat: 1070,
      highBust: 970,
      backWaist: 430,
    },
  ],
} as const;

function makeProfile(body: StarterBody, index: number): StarterProfile {
  const row = charts[body][index],
    male = body === "male";
  const H = male ? 1778 : 1660;
  const { chest: C, waist: W, seat: S } = row;
  const evidence = {} as StarterProfile["evidence"];
  const m = {} as CompleteMeasurements;
  const set = (
    key: MeasurementKey,
    value: number,
    basis: string,
    kind: MeasurementEvidence["kind"] = "estimate",
  ) => {
    m[key] = Math.round(value * 10) / 10;
    evidence[key] = { kind, basis };
  };
  set(
    "chest",
    C,
    `Simplicity ${row.source}, ${male ? "chest" : "bust"} cm × 10`,
    "chart",
  );
  set("waist", W, `Simplicity ${row.source}, waist cm × 10`, "chart");
  set("seat", S, `Simplicity ${row.source}, hip / full seat cm × 10`, "chart");
  if (!male)
    set(
      "highBust",
      charts.female[index].highBust,
      `Simplicity ${row.source}, high bust cm × 10`,
      "chart",
    );
  else set("highBust", C - 20, "Chest − 20 mm; shallow chest-shape assumption");
  set(
    "hips",
    W + (S - W) * 0.65,
    "Waist + 65% of the waist-to-seat difference; high-hip estimate",
  );
  set("biceps", C * (male ? 0.326 : 0.32), `Chest × ${male ? ".326" : ".32"}`);
  set(
    "neck",
    male ? charts.male[index].neckband - 10 : m.highBust * 0.39,
    male
      ? "Published neckband − 10 mm allowance; neckband is not a bare-neck measurement"
      : "High bust × .39",
  );
  set("shoulderToShoulder", C * 0.42, "Chest × .42");
  set(
    "hpsToBust",
    C * (male ? 0.27 : 0.293),
    `Chest × ${male ? ".27" : ".293"}`,
  );
  set(
    "hpsToWaistBack",
    male ? H * 0.259 : charts.female[index].backWaist + 15,
    male
      ? "Reference height × .259"
      : "Published center-back waist length + 15 mm to estimate the distinct HPS landmark",
  );
  set("waistToArmpit", m.hpsToWaistBack * 0.435, "HPS-to-waist back × .435");
  set(
    "waistToHips",
    H * 0.072,
    "Reference height × .072 (high hip, not full seat)",
  );
  set(
    "shoulderToWrist",
    H * 0.35,
    "Reference height × .35; not the chart's center-back shirt sleeve",
  );
  set(
    "wrist",
    H * (male ? 0.096 : 0.09),
    `Reference height × ${male ? ".096" : ".09"}`,
  );
  set(
    "shoulderSlope",
    13,
    "13° neutral drafting assumption; measure the individual angle",
  );
  set("seatBack", S * 0.52, "Full seat × .52");
  set("waistBack", W * 0.5, "Waist × .50");
  set("crotchDepth", H * 0.17, "Reference height × .17");
  set(
    "crossSeam",
    m.crotchDepth * 2 + W * 0.16,
    "2 × seated crotch depth + waist × .16",
  );
  set("crossSeamFront", m.crossSeam * 0.46, "Total crotch length × .46");
  set("knee", S * 0.39, "Full seat × .39");
  set("waistToFloor", H * 0.61, "Reference height × .61");
  set("waistToKnee", m.waistToFloor * 0.57, "Waist-to-floor × .57");
  set("waistToSeat", H * 0.132, "Reference height × .132");
  set("waistToUpperLeg", m.crotchDepth + 20, "Seated crotch depth + 20 mm");
  set("ankle", H * 0.13, "Reference height × .13");
  set(
    "bustFront",
    C * (male ? 0.51 : 0.54),
    `Chest × ${male ? ".51" : ".54"}; front arc estimate`,
  );
  set(
    "bustPointToUnderbust",
    C * (male ? 0.06 : 0.095),
    `Chest × ${male ? ".06" : ".095"}; breast-shape assumption`,
  );
  set("bustSpan", C * 0.215, "Chest × .215");
  set(
    "head",
    H * (male ? 0.32 : 0.335),
    `Reference height × ${male ? ".32" : ".335"}`,
  );
  set("heel", H * 0.19, "Reference height × .19");
  set("highBustFront", m.highBust * 0.5, "High bust × .50");
  set(
    "hpsToWaistFront",
    m.hpsToWaistBack + (male ? 10 : 25),
    `HPS-to-waist back + ${male ? "10" : "25"} mm; front contour estimate`,
  );
  set(
    "inseam",
    m.waistToFloor - m.crotchDepth,
    "Waist-to-floor − seated crotch depth",
  );
  set("shoulderToElbow", m.shoulderToWrist * 0.55, "Shoulder-to-wrist × .55");
  set(
    "underbust",
    C - (male ? 60 : 110),
    `Chest − ${male ? "60" : "110"} mm; not inferred cup size`,
  );
  set("upperLeg", S * 0.58, "Full seat × .58");
  set(
    "waistToUnderbust",
    m.hpsToWaistFront - m.hpsToBust - m.bustPointToUnderbust,
    "HPS-to-waist front − HPS-to-bust − bust-point-to-underbust",
  );
  return {
    id: `${body}-${row.size.toLowerCase()}` as StarterId,
    body,
    size: row.size,
    name: `${male ? "Male" : "Female"} ${row.size} · chart-based starter`,
    sourceSize: row.source,
    heightMm: H,
    measurements: m,
    evidence,
  };
}
export const starterProfiles = (["male", "female"] as const).flatMap((body) =>
  [0, 1, 2].map((index) => makeProfile(body, index)),
);
export function starterProfile(id: StarterId) {
  const profile = starterProfiles.find((p) => p.id === id);
  if (!profile) throw new Error("Unknown starter measurement profile.");
  return profile;
}
export function starterNote(profile: StarterProfile) {
  return `${profile.sourceSize}; ${sizingSources.chart}. Chart chest/bust, waist, full seat${profile.body === "female" ? ", high bust" : ""}; remaining measurements are Corpora Studio derived estimates. Reference height ${profile.heightMm} mm. Verify landmarks and fit with personal measurements and a toile. Formulas: docs/starter-sizing.md.`;
}
export function applyStarterProfile(value: Fashion, id: StarterId): Fashion {
  const profile = starterProfile(id);
  const profiles = [...(value.profiles ?? [])];
  const sameMeasurements = (
    a: Fashion["measurements"],
    b: Fashion["measurements"],
  ) =>
    JSON.stringify(Object.entries(a).sort()) ===
    JSON.stringify(Object.entries(b).sort());
  if (
    sameMeasurements(value.measurements, profile.measurements) &&
    value.profile === profile.name
  )
    return value;
  if (
    !profiles.some(
      (p) =>
        p.name === value.profile &&
        sameMeasurements(p.measurements, value.measurements),
    )
  ) {
    if (profiles.length >= 20)
      throw new Error(
        "Keep or export your current measurements first: the project already holds 20 profiles.",
      );
    const currentStarter = starterProfiles.find(
      (p) =>
        p.name === value.profile &&
        sameMeasurements(p.measurements, value.measurements),
    );
    profiles.push({
      id: crypto.randomUUID(),
      name: value.profile,
      source: "sample",
      note: currentStarter
        ? starterNote(currentStarter)
        : "Saved before changing starter size. Original measurement source was not recorded here; confirm it before cutting.",
      measurements: { ...value.measurements },
    } satisfies MeasurementProfile);
  }
  if (
    !profiles.some(
      (p) =>
        p.name === profile.name &&
        sameMeasurements(p.measurements, profile.measurements),
    )
  ) {
    if (profiles.length >= 20)
      throw new Error(
        "Keep or export your current measurements first: keeping both profiles would exceed the project's 20-profile limit.",
      );
    profiles.push({
      id: crypto.randomUUID(),
      name: profile.name,
      source: "sample",
      note: starterNote(profile),
      measurements: { ...profile.measurements },
    });
  }
  return {
    ...value,
    profile: profile.name,
    measurements: { ...profile.measurements },
    profiles,
  };
}
