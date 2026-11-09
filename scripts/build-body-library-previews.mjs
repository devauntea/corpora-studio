/** Reproduce the model picker from Form Studio's own neutral revision-9 meshes. */
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:640,height:640},deviceScaleFactor:1});
await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:1420');
const output='public/studio-previews/body';await fs.mkdir(output,{recursive:true});
const report=[];
try {
 for(const sex of ['male','female']) for(const physique of ['fit','average']) for(const section of ['upper-body','full-arm','full-leg','full-body','neck']) {
  const result=await page.evaluate(async({sex,physique,section})=>{
   const {StudioScene}=await import('/src/scene.ts');
   const {blankProject,humanBody,LATEST_BODY_REVISION}=await import('/src/domain.ts');
   const p=blankProject();p.body=humanBody(section);p.body.model={revision:LATEST_BODY_REVISION,sex,physique,anatomyOpacity:.85};p.body.muscularity=physique==='fit'?1:0;p.body.skin='#cfc6b8';p.layers=[];p.assets=[];
   const host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'0',top:'0',width:'480px',height:'560px',zIndex:'99999'});document.body.append(host);
   let error='';const scene=new StudioScene(host,{begin(){},move(){},end(){},stats(){},error(s){error=s;}});scene.active=false;
   try {if(!await scene.update(p))throw new Error(error);scene.floor.visible=false;scene.grid.visible=false;scene.renderer.setClearColor('#292b28');scene.view(section==='full-arm'?'three-quarter':'front');scene.zoom(.9);scene.renderer.render(scene.scene,scene.camera);return {data:scene.renderer.domElement.toDataURL('image/webp',.9),revision:LATEST_BODY_REVISION};}finally{scene.dispose();host.remove();}
  },{sex,physique,section});
  const name=`${section}-${sex}-${physique}.webp`;await fs.writeFile(`${output}/${name}`,Buffer.from(result.data.split(',')[1],'base64'));report.push({name,section,sex,physique,revision:result.revision,side:'left',pose:'neutral',build:1});console.log(name);
 }
 await fs.writeFile(`${output}/source.json`,JSON.stringify({source:'Form Studio built-in meshes and renderer; no external reference pixels',previews:report},null,2));
} finally{await browser.close();}
