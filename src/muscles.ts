import heads from "./muscle-heads.json";
// Color identities match the versioned anatomical field.
export const muscleGroups = [
  {
    name: "Pectoralis major",
    color: "#cb827b",
    flow: "Fans from the sternum toward the upper arm.",
  },
  {
    name: "Rectus abdominis",
    color: "#be6485",
    flow: "Paired vertical columns, separated by tendinous intersections.",
  },
  {
    name: "External oblique",
    color: "#8582b5",
    flow: "Diagonal flow from the ribs toward the pelvis.",
  },
  {
    name: "Serratus anterior",
    color: "#c78091",
    flow: "Fingerlike slips wrapping around the lateral ribs.",
  },
  {
    name: "Trapezius",
    color: "#d18d96",
    flow: "Upper-back fan between neck, spine, and shoulder.",
  },
  {
    name: "Latissimus dorsi",
    color: "#8aa6b8",
    flow: "Broad sweep from the lower back toward the upper arm.",
  },
  {
    name: "Infraspinatus",
    color: "#98bfb3",
    flow: "Crosses the back of the shoulder blade.",
  },
  {
    name: "Teres major",
    color: "#b39cbd",
    flow: "Runs from the lower shoulder blade to the upper arm.",
  },
  {
    name: "Deltoid",
    color: "#b87da8",
    flow: "Three-part cap converging down the upper arm.",
  },
  {
    name: "Biceps brachii",
    color: "#9d81c4",
    flow: "Long anterior upper-arm flow; compare bent and relaxed poses.",
  },
  {
    name: "Triceps brachii",
    color: "#8bb9c5",
    flow: "Posterior upper-arm flow toward the elbow.",
  },
  {
    name: "Brachialis",
    color: "#bb93b0",
    flow: "Deep upper-arm flexor visible beside the biceps.",
  },
  {
    name: "Brachioradialis",
    color: "#a4be83",
    flow: "Sweeps from the outer elbow toward the thumb side of the wrist.",
  },
  {
    name: "Pronator teres",
    color: "#ca9a87",
    flow: "Crosses diagonally through the upper forearm.",
  },
  {
    name: "Flexor carpi radialis",
    color: "#9c90bb",
    flow: "Anterior forearm toward the thumb side of the wrist.",
  },
  {
    name: "Flexor carpi ulnaris",
    color: "#72ab9e",
    flow: "Anterior forearm toward the little-finger side of the wrist.",
  },
  {
    name: "Palmaris longus",
    color: "#d0ad7e",
    flow: "Narrow central forearm path into the palm.",
  },
  {
    name: "Finger flexors",
    color: "#b7a0c5",
    flow: "Long forearm paths continuing toward the fingers.",
  },
  {
    name: "Extensor digitorum",
    color: "#9791bd",
    flow: "Posterior forearm paths extending into finger tendons.",
  },
  {
    name: "Extensor carpi radialis",
    color: "#83b8b4",
    flow: "Long radial edge of the back of the forearm.",
  },
  {
    name: "Extensor carpi ulnaris",
    color: "#c193a7",
    flow: "Long ulnar edge of the back of the forearm.",
  },
  {
    name: "Thumb extensors",
    color: "#bfad82",
    flow: "Oblique distal forearm paths toward the thumb.",
  },
  {
    name: "Rectus femoris",
    color: "#bd849a",
    flow: "Central anterior thigh toward the kneecap.",
  },
  {
    name: "Vastus lateralis",
    color: "#b6bf7d",
    flow: "Broad lateral thigh sweep toward the knee.",
  },
  {
    name: "Vastus medialis",
    color: "#9babc5",
    flow: "Medial teardrop just above the knee.",
  },
  {
    name: "Sartorius",
    color: "#cd9787",
    flow: "Diagonal strap from outer hip to inner knee.",
  },
  {
    name: "Adductors",
    color: "#a894b9",
    flow: "Inner-thigh flow from the pelvis toward the femur.",
  },
  {
    name: "Tensor fasciae latae",
    color: "#9fb782",
    flow: "Lateral hip transitioning into the iliotibial tract.",
  },
  {
    name: "Hamstrings",
    color: "#ae8bba",
    flow: "Long posterior thigh paths toward the back of the knee.",
  },
  {
    name: "Gastrocnemius",
    color: "#ba8195",
    flow: "Paired calf bellies converging toward the Achilles tendon.",
  },
  {
    name: "Soleus",
    color: "#8bb8aa",
    flow: "Broad lower calf on either side of the Achilles.",
  },
  {
    name: "Tibialis anterior",
    color: "#879dc2",
    flow: "Anterior shin toward the inner ankle.",
  },
  {
    name: "Fibularis",
    color: "#b3ba87",
    flow: "Lateral lower leg toward the outer ankle.",
  },
  {
    name: "Gluteus",
    color: "#c58e85",
    flow: "Broad pelvic fan on the posterior and lateral hip.",
  },
  {
    name: "Sternocleidomastoid",
    color: "#8cafb5",
    flow: "Diagonal neck strap toward the sternum and clavicle.",
  },
  {
    name: "Spinal extensors",
    color: "#aa9bbf",
    flow: "Long columns beside the spine.",
  },
] as const;

export const detailedMuscleGroups = [
  ...muscleGroups.map((g, parent) => ({ ...g, parent })),
  {
    name: "Connective tissue",
    color: "#dfd4b5",
    flow: "Tendons and connective regions.",
    parent: 36,
  },
  ...heads,
];
export const muscleParent = (id: number) =>
  detailedMuscleGroups[id]?.parent ?? 36;
export const muscleCatalog = (revision = 0) =>
  revision >= 8 ? detailedMuscleGroups : muscleGroups;
export function muscleLegend(revision = 0) {
  const replaced = new Set(heads.map((h) => h.parent));
  return detailedMuscleGroups.filter((g, i) =>
    revision >= 8 ? i !== 36 && (i >= 37 || !replaced.has(g.parent)) : i < 36,
  );
}
