import * as THREE from "three";

/** Procedural rest-space skin detail. No photograph is projected onto the body.
 * This is an artistic diffuse-wrap approximation, not tissue simulation. */
export function referenceSkin(
  shader: Parameters<THREE.Material["onBeforeCompile"]>[0],
) {
  shader.vertexShader =
    "attribute float skinOcclusion; varying float vSkinOcclusion;\n" +
    shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    "#include <begin_vertex>\nvSkinOcclusion=skinOcclusion;",
  );
  shader.fragmentShader =
    "varying float vSkinOcclusion;\n" + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <aomap_fragment>",
    `#include <aomap_fragment>
    reflectedLight.indirectDiffuse *= mix(1.0,vSkinOcclusion,.85);
    reflectedLight.directDiffuse *= mix(1.0,vSkinOcclusion,.22);
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "void main() {",
    `
    vec3 skinRegions(vec3 p) {
      p.x=abs(p.x);
      vec3 wr=bodyJoints[2];
      float palm=0.0,nail=0.0,edge=0.0;
      if(distance(p,wr)<2.2) {
        vec3 palmAxis=normalize(handJoints[8]-wr);
        float h=dot(p-wr,handNormal);
        palm=(1.0-smoothstep(-.10,.02,h))*smoothstep(.05,.25,dot(p-wr,palmAxis));
        for(int f=0;f<5;f++) {
          vec3 a=handJoints[f*4+2],b=handJoints[f*4+3];
          vec3 axis=normalize(b-a),q=p-a;
          float t=dot(q,axis)/max(length(b-a),.01);
          vec3 off=q-axis*dot(q,axis);
          float dorsal=dot(off,handNormal);
          float lateral=length(off-handNormal*dorsal);
          float width=f==0 ? .082:.066;
          float shape=pow((t-.58)/.34,4.0)+pow(lateral/width,4.0);
          float mask=(1.0-smoothstep(.70,1.12,shape))*smoothstep(.035,.065,dorsal);
          nail=max(nail,mask);
          edge=max(edge,(1.0-smoothstep(.07,.22,abs(shape-1.0)))*smoothstep(.035,.065,dorsal));
        }
      }
      if(p.y<bodyJoints[5].y+.2) {
        for(int f=0;f<5;f++) {
          int start=f==0 ? 1:2;
          vec3 a=toeJoints[f*4+start],b=toeJoints[f*4+start+1];
          vec3 axis=normalize(b-a),q=p-a;
          float t=dot(q,axis)/max(length(b-a),.01);
          float lateral=length(vec2(q.x,q.z)-vec2(axis.x,axis.z)*dot(q,axis));
          float width=f==0 ? .115:.065;
          float shape=pow((t-.50)/.38,4.0)+pow(lateral/width,4.0);
          float top=smoothstep(.035,.065,q.y);
          nail=max(nail,(1.0-smoothstep(.70,1.12,shape))*top);
          edge=max(edge,(1.0-smoothstep(.07,.22,abs(shape-1.0)))*top);
        }
      }
      return vec3(palm,nail,edge);
    }
    void main() {`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "float skinVariation = (skinNoise(vRest*13.0)-0.5)*0.018;",
    `float skinVariation = (skinNoise(vRest*13.0)-0.5)*0.024;
     vec3 regions=skinRegions(vRest);
     float mottling=skinNoise(vRest*4.7)-0.5;
     float warmJoint=bell(distance(vec3(abs(vRest.x),vRest.yz),bodyJoints[1]),.48)
                    +bell(distance(vec3(abs(vRest.x),vRest.yz),bodyJoints[4]),.55);
     vec3 variation=vec3(1.0+mottling*.033+warmJoint*.020,1.0-mottling*.012-warmJoint*.015,1.0-mottling*.018-warmJoint*.018);
     float luminance=dot(skinTint,vec3(.2126,.7152,.0722));
     // Palms and nail plates retain local color across the whole skin palette.
     vec3 palmRatio=mix(vec3(1.08,1.015,.98),vec3(1.9,1.55,1.35),1.0-smoothstep(.06,.38,luminance));
     variation*=mix(vec3(1.0),palmRatio,regions.x*.60);
     variation=mix(variation,vec3(1.12,1.005,1.01),regions.y*.70);
     variation*=1.0-regions.z*.045;
     diffuseColor.rgb*=mix(variation,vec3(1.0),anatomyMix);`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "float skinRelief = digitFolds(vRest) - pores*0.045;",
    "float skinRelief = digitFolds(vRest)*.55 - pores*.022 + regions.y*.065-regions.z*.025;",
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "roughnessFactor = clamp(roughnessFactor + (poreNoise-0.5)*0.06*(1.0-anatomyMix) + anatomyMix*0.08,0.4,0.9);",
    "roughnessFactor = clamp(roughnessFactor+(poreNoise-.5)*.07*(1.0-anatomyMix)-regions.y*.12*(1.0-anatomyMix)+anatomyMix*.17,.32,.86);",
  );
  // Wrap a small part of the diffuse lobe into the light terminator. Specular
  // reflection stays the stock physical BRDF; the anatomy filter stays opaque.
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_physical_pars_fragment>",
    THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      "reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );",
      `float cosine=dot(geometryNormal,directLight.direction);
       float wrap=max(0.0,(cosine+.28)/1.28);
       vec3 softIrradiance=mix(irradiance,wrap*directLight.color,.25*(1.0-anatomyMix));
       reflectedLight.directDiffuse += softIrradiance * diffuseBRDF * ( 1.0 - F );`,
    ),
  );
}
