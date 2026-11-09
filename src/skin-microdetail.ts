import * as THREE from "three";
import { armPose, type HumanBody } from "./domain";

let tile: THREE.Texture | undefined;
let loading: Promise<void> | undefined;
/** Load before the first body frame: the viewport renders on demand. */
export function loadSkinMicrodetail(): Promise<void> {
  return (loading ??= new THREE.TextureLoader()
    .loadAsync("/anatomy/skin-detail-v8.png")
    .then((texture) => {
      texture.colorSpace = THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 4;
      tile = texture;
    })
    .catch(() => {
      loading = undefined;
      throw new Error("The bundled skin microdetail could not load.");
    }));
}
export function skinMicroUniforms(body: HumanBody) {
  if (!tile)
    throw new Error("Skin microdetail must load before the body material.");
  return {
    skinMicroTile: { value: tile },
    jointBends: {
      value: new THREE.Vector3(
        THREE.MathUtils.degToRad(armPose(body, "left").flex),
        THREE.MathUtils.degToRad(armPose(body, "right").flex),
        body.section === "full-leg" ? THREE.MathUtils.degToRad(body.flex) : 0,
      ),
    },
  };
}

/** Original microrelief in physical rest-space. Triplanar sampling eliminates
 * both tattoo-chart seams and tangent-sign problems during skeleton posing.
 * Wrinkles are appearance cues, not contact or soft-tissue simulation. */
export function addSkinMicrodetail(
  shader: Parameters<THREE.Material["onBeforeCompile"]>[0],
) {
  shader.fragmentShader =
    `uniform sampler2D skinMicroTile;
    uniform vec3 jointBends;\n` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "void main() {",
    `
    vec3 microSurface(vec3 p) {
      vec3 rn=normalize(cross(dFdx(p),dFdy(p)));
      vec3 w=pow(abs(rn),vec3(6.0)); w/=max(dot(w,vec3(1.0)),.00001);
      // One tile spans 48 mm; source mesh units are decimetres.
      p/=.48;
      return texture2D(skinMicroTile,p.yz).rgb*w.x
           + texture2D(skinMicroTile,p.zx).rgb*w.y
           + texture2D(skinMicroTile,p.xy).rgb*w.z;
    }
    float flexWrinkles(vec3 p) {
      float elbow=p.x>=0.0 ? jointBends.x:jointBends.y;
      p.x=abs(p.x);
      vec3 ea=normalize(bodyJoints[1]-bodyJoints[0]);
      vec3 ef=normalize(vec3(0,0,1)-ea*ea.z);
      vec3 eq=p-bodyJoints[1];
      float ev=dot(eq,ea),eh=dot(eq,ef);
      float ew=length(eq-ea*ev-ef*eh);
      float activation=smoothstep(.18,1.8,elbow);
      float fold=-.20*bell(ev-.015,.023)-.11*bell(ev+.075,.021)-.09*bell(ev-.10,.024);
      float relief=fold*activation*bell(ew,.36)*smoothstep(.10,.26,eh)*(1.0-smoothstep(.9,1.2,eh));
      vec3 ka=normalize(bodyJoints[4]-bodyJoints[3]);
      vec3 kf=normalize(vec3(0,0,1)-ka*ka.z);
      vec3 kq=p-bodyJoints[4];
      float kv=dot(kq,ka),kh=-dot(kq,kf);
      float kw=length(kq-ka*kv+kf*kh);
      float kfold=-.18*bell(kv,.03)-.10*bell(kv+.11,.025)-.08*bell(kv-.12,.028);
      relief+=kfold*smoothstep(.20,1.8,jointBends.z)*bell(kw,.44)*smoothstep(.16,.35,kh)*(1.0-smoothstep(.85,1.15,kh));
      return relief;
    }
    void main() {`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "float skinRelief = digitFolds(vRest)*.55 - pores*.022 + regions.y*.065-regions.z*.025;",
    `vec3 micro=microSurface(vRest);
     float jointRelief=flexWrinkles(vRest);
     float skinRelief=digitFolds(vRest)*.55 + (micro.r*.055-.035)*(1.0-regions.y) + jointRelief + regions.y*.065-regions.z*.025;`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "float muscleRelief = smoothstep(.04,.65,confidence)*.85*(group==36 ? 0.0:1.0)*intersections;",
    "float muscleRelief = smoothstep(.04,.65,confidence)*.30*(group==36 ? 0.0:1.0)*intersections;",
  );
  // roughness runs before normal_fragment_maps: sample here separately so no
  // declaration-order dependency on the bump mapping block is introduced.
  shader.fragmentShader = shader.fragmentShader.replace(
    "roughnessFactor = clamp(roughnessFactor+(poreNoise-.5)*.07*(1.0-anatomyMix)-regions.y*.12*(1.0-anatomyMix)+anatomyMix*.17,.32,.86);",
    "roughnessFactor = clamp(roughnessFactor+(microSurface(vRest).g-.62)*(1.0-anatomyMix)-regions.y*.12*(1.0-anatomyMix)+anatomyMix*.12,.36,.86);",
  );
}
