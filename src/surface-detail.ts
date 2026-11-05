import { referenceSkin } from "./reference-skin";
import * as THREE from "three";
import { humanScale, type HumanBody } from "./domain";
import { muscleGroups } from "./muscles";
export type DetailLandmarks = {
  wrist: number[];
  fingers: number[][][];
  normal: number[];
  toes: number[][][];
};

/** Surface-only detail follows the rest chart through posing. Switching the
 * anatomy filter never changes positions, tattoo UVs, or the raycast surface. */
export function addSculptedSurfaceDetail(
  material: THREE.MeshStandardMaterial,
  body: HumanBody,
  joints: Record<
    "shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle",
    number[]
  >,
  landmarks: DetailLandmarks,
) {
  const vec = (p: number[]) =>
    new THREE.Vector3(...(p as [number, number, number]));
  const uniforms = {
    anatomyMix: { value: body.anatomy ? body.model!.anatomyOpacity : 0 },
    skinTint: { value: new THREE.Color(body.skin) },
    atlasPalette: {
      value: [
        ...muscleGroups.map((g) => new THREE.Color(g.color)),
        new THREE.Color("#dfd4b5"),
      ],
    },
    bodyJoints: {
      value: ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"].map(
        (key) =>
          new THREE.Vector3(
            ...(joints[key as keyof typeof joints] as [number, number, number]),
          ),
      ),
    },
    handJoints: { value: landmarks.fingers.flat().map(vec) },
    handNormal: { value: vec(landmarks.normal) },
    toeJoints: { value: landmarks.toes.flat().map(vec) },
    detailScale: {
      value:
        body.model?.revision === 5
          ? humanScale(body) / 100
          : body.length /
            (body.section === "upper-body"
              ? 570
              : body.section === "full-arm"
                ? 790
                : 900),
    },
  };
  material.userData.surfaceUniforms = uniforms;
  material.customProgramCacheKey = () =>
    body.model!.revision >= 5
      ? "surface-v5-reference-1"
      : "surface-v3-sculpt-1";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      `
      attribute vec3 restPosition;
      attribute vec4 musclePalette;
      attribute vec4 muscleWeights;
      varying vec3 vRest;
      varying vec4 vMusclePalette;
      varying vec4 vMuscleWeights;
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvRest = restPosition; vMusclePalette=musclePalette; vMuscleWeights=muscleWeights;",
    );
    shader.fragmentShader =
      `
      varying vec3 vRest;
      varying vec4 vMusclePalette;
      varying vec4 vMuscleWeights;
      uniform float anatomyMix;
      uniform vec3 skinTint;
      uniform float detailScale;
      uniform vec3 atlasPalette[37];
      uniform vec3 bodyJoints[6];
      uniform vec3 handJoints[20];
      uniform vec3 handNormal;
      uniform vec3 toeJoints[20];
      float bell(float v,float radius) { return exp(-min(80.0,pow(v/radius,2.0))); }
      float digitFolds(vec3 p) {
        p.x=abs(p.x);
        float crease=0.0;
        vec3 wr=bodyJoints[2];
        if(distance(p,wr)<2.2) {
          float h=dot(p-wr,handNormal);
          float dorsal=smoothstep(.015,.12,h),palmar=1.0-smoothstep(-.12,-.015,h);
          for(int f=0;f<5;f++) for(int k=1;k<3;k++) {
            vec3 axis=normalize(handJoints[f*4+k+1]-handJoints[f*4+k-1]);
            vec3 q=p-handJoints[f*4+k];
            float along=dot(q,axis);
            vec3 across=q-axis*along;
            float ph=dot(across,handNormal);
            float width=length(across-handNormal*ph);
            float gate=bell(width,f==0 ? .14:.11)*bell(ph,.22);
            crease-=(.12*bell(along-.035,.018)+.08*bell(along+.035,.016))*gate*max(dorsal*.7,palmar);
          }
          vec3 palmAxis=normalize(handJoints[8]-wr), acrossAxis=normalize(cross(palmAxis,handNormal));
          float u=dot(p-wr,acrossAxis),v=dot(p-wr,palmAxis);
          if(v>-.15 && v<.65) {
            crease-=.12*bell(v-.03-.10*u,.020)*bell(u,.29)*palmar;
            crease-=.08*bell(v-.14-.08*u,.020)*bell(u,.27)*palmar;
            crease-=.15*bell(v-.45-.24*u,.026)*bell(u,.35)*palmar;
          }
        }
        if(p.y<bodyJoints[5].y+.35) {
          for(int f=0;f<5;f++) {
            vec3 axis=normalize(toeJoints[f*4+2]-toeJoints[f*4]);
            vec3 q=p-toeJoints[f*4+1];
            float along=dot(q,axis),top=smoothstep(.02,.12,q.y);
            float width=length(vec2(q.x,q.z)-vec2(axis.x,axis.z)*along);
            crease-=.12*bell(along,.023)*bell(width,f==0 ? .16:.10)*top;
          }
        }
        return crease;
      }
      vec3 limbFrame(vec3 p,vec3 a,vec3 b) {
        vec3 axis=normalize(b-a), q=p-a;
        float along=dot(q,axis);
        vec3 off=q-axis*along;
        return vec3(along/length(b-a),atan(off.x,off.z),length(off));
      }
      float musclePhase(vec3 p,int group) {
        p.x=abs(p.x);
        if(group==0) return atan(p.y-5.65,p.x-2.0)*1.15;
        if(group==1) return p.x+.025*sin(p.y*4.0);
        if(group==2) return p.x+p.y*.66;
        if(group==3) return p.x-p.y*.48;
        if(group==4) return atan(p.y-5.12,p.x-.1)*.85;
        if(group==5) return atan(p.y-5.45,p.x-2.0)*1.25;
        if(group==6 || group==7) return p.y+p.x*.28;
        if(group==34) return p.x-p.y*.36;
        if(group==35) return p.x+.025*sin(p.y*2.0);
        if(group>=8 && group<=21) {
          vec3 frame = group<=11 ? limbFrame(p,bodyJoints[0],bodyJoints[1]) : limbFrame(p,bodyJoints[1],bodyJoints[2]);
          if(group==8) return frame.y*.52*(1.0-.55*clamp(frame.x,0.0,1.0));
          return frame.y*(group<=11 ? .42:.30)+(group<=11 ? .10:.22)*frame.x*frame.x;
        }
        if(group>=22 && group<=33) {
          vec3 frame = group<=28 || group==33 ? limbFrame(p,bodyJoints[3],bodyJoints[4]) : limbFrame(p,bodyJoints[4],bodyJoints[5]);
          if(group==24 || group==29) return frame.y*.44+frame.x*.24;
          if(group==25) return frame.y*.52-frame.x*.65;
          return frame.y*.48+.05*sin(frame.x*4.0);
        }
        return p.x;
      }
      float detailHash(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float skinNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(mix(detailHash(i),detailHash(i+vec3(1,0,0)),f.x),
                       mix(detailHash(i+vec3(0,1,0)),detailHash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(detailHash(i+vec3(0,0,1)),detailHash(i+vec3(1,0,1)),f.x),
                       mix(detailHash(i+vec3(0,1,1)),detailHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `
      // Interpolate categorical probabilities, then sharpen them. This rounds
      // atlas contours without the muddy RGB blur of ordinary vertex colors.
      vec4 votes=max(vMuscleWeights,vec4(0.0));
      int lead=0;
      for(int k=1;k<4;k++) if(votes[k]>votes[lead]) lead=k;
      float runner=0.0;
      for(int k=0;k<4;k++) if(k!=lead) runner=max(runner,votes[k]);
      float confidence=max(0.0,votes[lead]-runner);
      int group=int(vMusclePalette[lead]+0.5);
      vec4 sharp=pow(votes,vec4(8.0));
      float total=max(dot(sharp,vec4(1.0)),0.000001);
      vec3 atlasColor=vec3(0.0);
      for(int k=0;k<4;k++) atlasColor+=atlasPalette[int(vMusclePalette[k]+0.5)]*sharp[k]/total;
      float septum=1.0-smoothstep(.015,.13,confidence);
      float intersections=1.0;
      if(group==1 && vRest.z>.3) {
        float closest=min(abs(vRest.x),min(abs(vRest.y-3.74),min(abs(vRest.y-3.12),abs(vRest.y-2.48))));
        intersections=smoothstep(.010,.040,closest);
      }
      if(group==0 && vRest.z>.3) intersections=smoothstep(.010,.040,abs(vRest.x));
      atlasColor=mix(atlasColor,atlasPalette[36],max(septum*.72,1.0-intersections));
      diffuseColor.rgb *= mix(skinTint, atlasColor, anatomyMix);
      float phase = musclePhase(vRest,group);
      float fiberMask = (group==36 ? 0.0:1.0)*smoothstep(.10,.38,confidence)*intersections;
      // Fascicle bundles remain readable at normal working zoom; the fine
      // filaments and skin pores resolve only when the pixel footprint permits.
      float coarsePhase = phase*95.0 + 0.24*sin(phase*23.0 + vRest.y*1.5);
      float finePhase = phase*310.0 + 0.4*sin(phase*37.0 + vRest.y*3.0);
      float coarseAA = 1.0-smoothstep(0.6,2.2,fwidth(coarsePhase));
      float fineAA = 1.0-smoothstep(0.5,1.8,fwidth(finePhase));
      float bundle = pow(0.5+0.5*sin(coarsePhase),6.0)*coarseAA;
      float filament = pow(0.5+0.5*sin(finePhase),10.0)*fineAA;
      float edgeShade = septum;
      float poreAA = 1.0-smoothstep(0.35,1.25,length(fwidth(vRest))*160.0);
      float poreNoise = skinNoise(vRest*160.0);
      float pores = pow(poreNoise,5.0)*poreAA;
      float skinVariation = (skinNoise(vRest*13.0)-0.5)*0.018;
      float striation = bundle*0.09 + filament*0.035;
      diffuseColor.rgb *= 1.0-anatomyMix*(fiberMask*striation + edgeShade*0.10);
      diffuseColor.rgb *= 1.0+(1.0-anatomyMix)*(skinVariation - pores*0.025);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
      // Height is in millimeters and scales with the model. No silhouette or
      // tattoo-coordinate changes occur when the visual anatomy layer changes.
      float muscleRelief = smoothstep(.04,.65,confidence)*.85*(group==36 ? 0.0:1.0)*intersections;
      float fiberRelief = (bundle*0.17 + filament*0.035)*fiberMask;
      float skinRelief = digitFolds(vRest) - pores*0.045;
      float height = mix(skinRelief,muscleRelief+fiberRelief,anatomyMix)*detailScale;
      vec3 tangentX = dFdx(-vViewPosition), tangentY = dFdy(-vViewPosition);
      vec3 gradientX = cross(tangentY,normal), gradientY = cross(normal,tangentX);
      float determinant = dot(tangentX,gradientX);
      vec3 gradient = (dFdx(height)*gradientX+dFdy(height)*gradientY)*sign(determinant)/max(abs(determinant),0.000001);
      normal = normalize(normal-gradient);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + (poreNoise-0.5)*0.06*(1.0-anatomyMix) + anatomyMix*0.08,0.4,0.9);
    `,
    );
    if (body.model!.revision >= 5) referenceSkin(shader);
  };
}
