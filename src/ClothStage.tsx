import { useEffect, useRef } from "react";
import * as THREE from "three";
import { StudioScene } from "./scene";
import { blankProject, type HumanBody } from "./domain";
import type { ClothMesh, ClothResult } from "./cloth-model";
export type Collider = {
  positions: Float32Array;
  indices: Uint32Array;
  floor: number;
};
export function ClothStage({
  body,
  mesh,
  result,
  onCollider,
  onScene,
  benchmark,
}: {
  body: HumanBody;
  mesh?: ClothMesh;
  result?: ClothResult;
  benchmark?: boolean;
  onCollider: (c: Collider) => void;
  onScene: (s: StudioScene | undefined) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<StudioScene | undefined>(undefined),
    cloth = useRef<THREE.Mesh | undefined>(undefined);
  useEffect(() => {
    if (!host.current) return;
    let active = true;
    const s = (scene.current = new StudioScene(host.current, {
      begin() {},
      move() {},
      end() {},
      stats() {},
      error(message) {
        if (host.current) host.current.dataset.error = message;
      },
    }));
    onScene(s);
    if (benchmark) {
      s.surface.visible = false;
      s.caps.visible = false;
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(100, 100, 200, 64),
        new THREE.MeshStandardMaterial({ color: "#b0b0b0", roughness: 0.8 }),
      );
      cylinder.position.y = 250;
      s.scene.add(cylinder);
      cylinder.updateMatrixWorld();
      const g = cylinder.geometry.clone().applyMatrix4(cylinder.matrixWorld);
      onCollider({
        positions: (g.attributes.position.array as Float32Array).slice(),
        indices: Uint32Array.from(g.index!.array),
        floor: 0,
      });
      g.dispose();
      s.floor.position.y = -2;
      s.grid.position.y = -1;
      s.controls.target.set(0, 230, 0);
      s.camera.position.set(700, 650, 950);
      s.controls.update();
      s.needsRender = true;
      return () => {
        active = false;
        onScene(undefined);
        cylinder.geometry.dispose();
        cylinder.material.dispose();
        s.dispose();
        scene.current = undefined;
      };
    }
    void s.update({ ...blankProject(), body }).then((ok) => {
      if (!active || !ok) return;
      const positions: number[] = [];
      for (const { mesh } of s.human!.charts.values()) {
        const p = mesh.geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++)
          positions.push(p.getX(i), p.getY(i), p.getZ(i));
      }
      onCollider({
        positions: new Float32Array(positions),
        indices: Uint32Array.from(
          { length: positions.length / 3 },
          (_, i) => i,
        ),
        floor: s.floor.position.y + 12,
      });
      s.view("front", body.length);
    });
    return () => {
      active = false;
      onScene(undefined);
      s.dispose();
      scene.current = undefined;
    };
  }, [body, benchmark]);
  useEffect(() => {
    const s = scene.current;
    if (!s) return;
    if (cloth.current) {
      s.scene.remove(cloth.current);
      cloth.current.geometry.dispose();
      (cloth.current.material as THREE.Material).dispose();
      cloth.current = undefined;
    }
    if (mesh) {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          result?.positions ?? mesh.positions,
          3,
        ),
      );
      g.setAttribute("color", new THREE.Float32BufferAttribute(mesh.colors, 3));
      g.setIndex(Array.from(mesh.indices));
      g.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.95,
      });
      const m = (cloth.current = new THREE.Mesh(g, material));
      m.castShadow = true;
      s.scene.add(m);
    }
    s.needsRender = true;
  }, [mesh, result]);
  return (
    <div
      ref={host}
      className="cloth-stage"
      aria-label="Garment visual fit preview"
    />
  );
}
