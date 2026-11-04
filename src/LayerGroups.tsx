import { useState } from "react";
import type { Project } from "./domain";
export function LayerGroups({
  project,
  change,
  selected,
}: {
  project: Project;
  change: (p: Project) => void;
  selected?: string;
}) {
  const [name, setName] = useState("");
  return (
    <details className="layer-groups">
      <summary>Layer groups ({project.groups?.length ?? 0})</summary>
      <label>
        New group
        <input
          aria-label="New layer group name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        disabled={!name.trim() || (project.groups?.length ?? 0) >= 12}
        onClick={() => {
          const id = crypto.randomUUID();
          change({
            ...project,
            groups: [
              ...(project.groups ?? []),
              {
                id,
                name: name.trim(),
                visible: true,
                locked: false,
                opacity: 1,
              },
            ],
            layers: project.layers.map((l) =>
              l.id === selected ? { ...l, groupId: id } : l,
            ),
          });
          setName("");
        }}
      >
        Create group with selected layer
      </button>
      {(project.groups ?? []).map((g) => {
        const update = (patch: Partial<typeof g>) =>
          change({
            ...project,
            groups: project.groups?.map((x) =>
              x.id === g.id ? { ...g, ...patch } : x,
            ),
          });
        return (
          <div key={g.id}>
            <strong>
              {g.name} ·{" "}
              {project.layers.filter((l) => l.groupId === g.id).length}
            </strong>
            <label>
              <input
                type="checkbox"
                checked={g.visible}
                onChange={(e) => update({ visible: e.target.checked })}
              />
              Show {g.name}
            </label>
            <label>
              <input
                type="checkbox"
                checked={g.locked}
                onChange={(e) => update({ locked: e.target.checked })}
              />
              Lock {g.name}
            </label>
            <label>
              Group opacity
              <input
                aria-label={`${g.name} group opacity`}
                type="range"
                min={0}
                max={100}
                value={Math.round(g.opacity * 100)}
                onChange={(e) =>
                  update({ opacity: Number(e.target.value) / 100 })
                }
              />
            </label>
            <button
              onClick={() =>
                change({
                  ...project,
                  groups: project.groups?.filter((x) => x.id !== g.id),
                  layers: project.layers.map((l) =>
                    l.groupId === g.id ? { ...l, groupId: undefined } : l,
                  ),
                })
              }
            >
              Ungroup {g.name}
            </button>
          </div>
        );
      })}
    </details>
  );
}
