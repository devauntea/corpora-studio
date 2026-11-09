import {
  layerBounds,
  mapLayer,
  type VectorPack,
  type VectorLayer,
  type VectorView,
} from "./vector-pack";
export function selectionFor(pack: VectorPack, id: string, individual = false) {
  return individual
    ? [id]
    : (pack.groups.find((g) => g.layerIds.includes(id))?.layerIds ?? [id]);
}
export function selectionBounds(layers: VectorLayer[]) {
  if (!layers.length) return null;
  const boxes = layers.map(layerBounds);
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}
export function pruneGroups(pack: VectorPack): VectorPack {
  const ids = new Set(pack.layers.map((l) => l.id));
  return {
    ...pack,
    groups: pack.groups
      .map((g) => ({ ...g, layerIds: g.layerIds.filter((id) => ids.has(id)) }))
      .filter((g) => g.layerIds.length >= 2),
  };
}
export function groupSelection(
  pack: VectorPack,
  ids: string[],
  name = "Garment group",
): VectorPack {
  const members = new Set(ids);
  if (members.size < 2) return pack;
  return {
    ...pack,
    groups: [
      ...pack.groups
        .map((g) => ({
          ...g,
          layerIds: g.layerIds.filter((id) => !members.has(id)),
        }))
        .filter((g) => g.layerIds.length >= 2),
      { id: crypto.randomUUID(), name, layerIds: [...members] },
    ],
  };
}
export function transformSelection(
  pack: VectorPack,
  ids: string[],
  fn: (p: { x: number; y: number }) => { x: number; y: number },
): VectorPack {
  const members = new Set(ids);
  // A partially locked garment must never be pulled apart by a shared transform.
  if (pack.layers.some((l) => members.has(l.id) && l.locked)) return pack;
  return {
    ...pack,
    layers: pack.layers.map((l) => (members.has(l.id) ? mapLayer(l, fn) : l)),
  };
}
export function duplicateSelection(
  pack: VectorPack,
  ids: string[],
  view?: VectorView,
) {
  const members = new Set(ids),
    mapping = new Map<string, string>();
  const layers = pack.layers
    .filter((l) => members.has(l.id))
    .map((l) => {
      const id = crypto.randomUUID();
      mapping.set(l.id, id);
      return {
        ...mapLayer(l, (p) => ({
          x: p.x + (view ? 0 : 12),
          y: p.y + (view ? 0 : 12),
        })),
        id,
        view: view ?? l.view,
      };
    });
  const groups = pack.groups
    .map((g) => ({
      ...g,
      id: crypto.randomUUID(),
      layerIds: g.layerIds.flatMap((id) =>
        mapping.has(id) ? [mapping.get(id)!] : [],
      ),
    }))
    .filter((g) => g.layerIds.length >= 2);
  return {
    pack: {
      ...pack,
      layers: [...pack.layers, ...layers],
      groups: [...pack.groups, ...groups],
    },
    ids: layers.map((l) => l.id),
  };
}
export function reorderSelection(
  pack: VectorPack,
  ids: string[],
  front: boolean,
): VectorPack {
  const selected = new Set(ids),
    moving = pack.layers.filter((l) => selected.has(l.id)),
    remaining = pack.layers.filter((l) => !selected.has(l.id));
  return {
    ...pack,
    layers: front ? [...remaining, ...moving] : [...moving, ...remaining],
  };
}
