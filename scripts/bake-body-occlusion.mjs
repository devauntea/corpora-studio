// Deterministic cosine hemisphere ambient occlusion, in the body's rest frame.
// No external textures or services. Cached average/fit fields follow the morph.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir=new URL('../public/anatomy/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const samples=32, range=.65;
for(const sex of ['male','female']) {
  const meta=JSON.parse(await fs.readFile(new URL(`human-v5-${sex}.json`,dir),'utf8'));
  const raw=await fs.readFile(new URL(meta.buffer,dir));
  if(hash(raw)!==meta.sha256) throw new Error('Body checksum mismatch');
  const buffer=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
  const n=meta.vertexCount, values=new Float32Array(buffer,0,n*12);
  const allIndices=new Uint32Array(buffer,n*48);
  const fullCount=meta.partCounts.slice(0,6).reduce((a,b)=>a+b,0);
  const output=new Uint8Array(n*2);
  for(const fit of [0,1]) {
    const geometry=new THREE.BufferGeometry(), p=new Float32Array(n*3);
    for(let i=0;i<n;i++) for(let k=0;k<3;k++) p[i*3+k]=values[i*12+k]+fit*values[i*12+k+3];
    geometry.setAttribute('position',new THREE.BufferAttribute(p,3));
    // Full surface occludes light; section-only cut vertices need normals too.
    geometry.setIndex(new THREE.BufferAttribute(allIndices.slice(),1));
    geometry.computeVertexNormals();
    const normals=geometry.getAttribute('normal');
    geometry.setIndex(new THREE.BufferAttribute(allIndices.slice(0,fullCount),1));
    const bvh=new MeshBVH(geometry,{targetLeafSize:8});
    const ray=new THREE.Ray(), normal=new THREE.Vector3(), tangent=new THREE.Vector3(), bitangent=new THREE.Vector3();
    const up=new THREE.Vector3(0,1,0), side=new THREE.Vector3(1,0,0);
    for(let i=0;i<n;i++) {
      normal.fromBufferAttribute(normals,i).normalize();
      if(normal.lengthSq()<.1) { output[i*2+fit]=255; continue; }
      tangent.crossVectors(Math.abs(normal.y)<.9?up:side,normal).normalize();
      bitangent.crossVectors(normal,tangent);
      ray.origin.fromArray(p,i*3).addScaledVector(normal,.0015);
      let obscured=0;
      for(let j=0;j<samples;j++) {
        const radius=Math.sqrt((j+.5)/samples), angle=j*2.399963229728653;
        ray.direction.copy(normal).multiplyScalar(Math.sqrt(1-radius*radius))
          .addScaledVector(tangent,Math.cos(angle)*radius).addScaledVector(bitangent,Math.sin(angle)*radius);
        const hit=bvh.raycastFirst(ray,THREE.DoubleSide,.001,range);
        if(hit) obscured+=Math.pow(1-hit.distance/range,.65);
      }
      output[i*2+fit]=Math.round(255*(1-.68*obscured/samples));
    }
    geometry.dispose();
    console.log(`${sex} ${fit?'fit':'average'} occlusion baked`);
  }
  const name=`skin-occlusion-v5-${sex}.bin`;
  await fs.writeFile(new URL(name,dir),output);
  meta.occlusion={buffer:name,sha256:hash(output),bytesPerVertex:2,samples,rangeDm:range,description:'Cosine-weighted short-range rest-space visibility; average and fit uint8 channels. Artistic static shading, not dynamic pose shadows.'};
  await fs.writeFile(new URL(`human-v5-${sex}.json`,dir),JSON.stringify(meta,null,2)+'\n');
}
const manifestPath=new URL('../assets/anatomy/hashes.json',import.meta.url);
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
for(const file of await fs.readdir(dir)) manifest[file]=hash(await fs.readFile(new URL(file,dir)));
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
