import type { Project, Layer } from "./domain";
export function effectiveLayer(p: Project, l: Layer): Layer {
  const g = p.groups?.find((g) => g.id === l.groupId);
  return g
    ? {
        ...l,
        visible: l.visible && g.visible,
        locked: Boolean(l.locked || g.locked),
        opacity: l.opacity * g.opacity,
      }
    : l;
}
export function compositeProject(p: Project): Project {
  return p.groups?.length
    ? {
        ...p,
        layers: p.layers.map((l) => effectiveLayer(p, l)),
        groups: undefined,
      }
    : p;
}
