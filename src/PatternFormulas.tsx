import { useState } from "react";
import type { Fashion, PatternPiece } from "./fashion-model";
import { detachPiece, constructPiece } from "./pattern-geometry";
import { resolveConstruction } from "./pattern-formulas";
export function PatternFormulas({
  value,
  piece,
  change,
  notify,
}: {
  value: Fashion;
  piece: PatternPiece;
  change: (f: Fashion) => void;
  notify: (s: string, error?: boolean) => void;
}) {
  const [target, setTarget] = useState("0:to:x"),
    [expression, setExpression] = useState("waist / 4");
  const c =
    value.construction?.[piece.id] ?? detachPiece(piece, value.seamAllowance);
  const update = (next: typeof c) => {
    try {
      constructPiece(piece.id, resolveConstruction(next, value.measurements));
      change({
        ...value,
        construction: { ...value.construction, [piece.id]: next },
      });
    } catch (e) {
      notify(String(e), true);
    }
  };
  return (
    <details className="fashion-details">
      <summary>Measurement formulas</summary>
      <p className="fashion-caption">
        Use measurement names (waist, chest…) or anchors p0.x, p1.y. Formulas
        update on measurement changes. Geometry edits detach the formulas first.
      </p>
      <label className="fashion-text-field">
        Point coordinate
        <select
          aria-label="Formula target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {c.seam.flatMap((op, edge) =>
            op.type === "close"
              ? []
              : (op.type === "curve" ? ["to", "cp1", "cp2"] : ["to"]).flatMap(
                  (point) =>
                    ["x", "y"].map((axis) => (
                      <option
                        key={`${edge}:${point}:${axis}`}
                        value={`${edge}:${point}:${axis}`}
                      >
                        p{edge} {point === "to" ? "anchor" : point} {axis}
                      </option>
                    )),
                ),
          )}
        </select>
      </label>
      <label className="fashion-text-field">
        Expression
        <input
          aria-label="Point formula"
          maxLength={200}
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
        />
      </label>
      <button
        onClick={() => {
          const [edge, point, axis] = target.split(":");
          update({
            ...c,
            formulas: [
              ...(c.formulas ?? []).filter(
                (f) => `${f.edge}:${f.point}:${f.axis}` !== target,
              ),
              {
                edge: Number(edge),
                point: point as "to" | "cp1" | "cp2",
                axis: axis as "x" | "y",
                expression,
              },
            ],
          });
        }}
      >
        Apply point formula
      </button>
      {c.formulas?.map((f) => (
        <div className="profile-row" key={`${f.edge}:${f.point}:${f.axis}`}>
          <small>
            p{f.edge} {f.point}.{f.axis} = {f.expression}
          </small>
          <button
            onClick={() =>
              update({
                ...resolveConstruction(c, value.measurements),
                formulas: c.formulas?.filter((x) => x !== f),
              })
            }
          >
            Detach formula
          </button>
        </div>
      ))}
    </details>
  );
}
