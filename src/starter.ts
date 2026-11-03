import { assetFromFile } from "./io";
import { blankProject, newLayer } from "./domain";

// Original vector-like study drawn locally. No reference photographs are bundled.
export async function starterProject() {
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 1000;
  const x = c.getContext("2d")!;
  x.strokeStyle = "#202620";
  x.fillStyle = "#202620";
  x.lineWidth = 4;
  x.lineCap = "round";
  const line = (ax: number, ay: number, bx: number, by: number) => {
    x.beginPath();
    x.moveTo(ax, ay);
    x.lineTo(bx, by);
    x.stroke();
  };
  const circle = (cx: number, cy: number, r: number) => {
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.stroke();
  };
  circle(300, 300, 69);
  circle(300, 300, 58);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const r = i % 2 ? 99 : 126;
    line(
      300 + Math.sin(a) * 82,
      300 + Math.cos(a) * 82,
      300 + Math.sin(a) * r,
      300 + Math.cos(a) * r,
    );
    if (i % 2 === 0)
      circle(300 + Math.sin(a) * (r + 14), 300 + Math.cos(a) * (r + 14), 2);
  }
  line(300, 465, 300, 855);
  for (let i = 0; i < 5; i++) {
    const y = 510 + i * 57,
      span = 120 - i * 14;
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(300, y + 32);
      x.bezierCurveTo(
        300 + s * span,
        y + 20,
        300 + s * span,
        y - 53,
        300 + s * span,
        y - 53,
      );
      x.bezierCurveTo(300 + s * 26, y - 35, 300 + s * 15, y + 8, 300, y + 32);
      x.stroke();
      line(300, y + 32, 300 + s * span * 0.8, y - 34);
    }
  }
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    x.arc(300, 100 + i * 10, 1.7, 0, Math.PI * 2);
    x.fill();
  }
  x.beginPath();
  x.moveTo(300, 45);
  x.lineTo(311, 70);
  x.lineTo(300, 95);
  x.lineTo(289, 70);
  x.closePath();
  x.stroke();
  circle(300, 890, 9);
  line(300, 914, 300, 940);
  const blob = await new Promise<Blob>((r) =>
    c.toBlob((b) => r(b!), "image/png"),
  );
  const asset = await assetFromFile(
    new File([blob], "Solar botanical.png", { type: "image/png" }),
  );
  const p = blankProject();
  p.name = "Solar study";
  p.assets = [asset];
  p.layers = [{ ...newLayer(asset), width: 95, v: 0.5 }];
  return p;
}
