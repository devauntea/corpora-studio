/** Numeric counterpart to canvas handles; percent coordinates support keyboard editing. */
export function PointInputs({
  label,
  point,
  change,
  min = 0,
  max = 1,
  disabled = false,
}: {
  label: string;
  point: [number, number];
  change: (p: [number, number]) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <fieldset className="point-inputs" disabled={disabled}>
      <legend>{label}</legend>
      {([0, 1] as const).map((axis) => (
        <label key={axis}>
          {axis ? "Y" : "X"} %
          <input
            aria-label={`${label} ${axis ? "Y" : "X"} percent`}
            type="number"
            min={min * 100}
            max={max * 100}
            step={0.1}
            value={+(point[axis] * 100).toFixed(2)}
            onChange={(e) => {
              if (e.target.value === "") return;
              const v = Number(e.target.value) / 100;
              if (Number.isFinite(v) && v >= min && v <= max) {
                const q: [number, number] = [...point];
                q[axis] = v;
                change(q);
              }
            }}
          />
        </label>
      ))}
    </fieldset>
  );
}
