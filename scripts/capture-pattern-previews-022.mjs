import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const out='qa/ui-022/patterns';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:1420');
await page.getByRole('button',{name:'Fashion',exact:true}).click();
await page.getByRole('button',{name:/Browse .* drafted patterns/}).click();
await page.getByRole('img',{name:/Teagan.*drafted preview/}).waitFor();
for(const [width,height] of [[1440,940],[1080,720]]) {
 await page.setViewportSize({width,height});
 await page.screenshot({path:`${out}/${width}-gallery.png`});
}
await page.getByRole('button',{name:'Construction lines',exact:true}).click();
await page.screenshot({path:`${out}/1080-construction.png`});
await page.getByRole('button',{name:'Close pattern library'}).click();
await page.getByRole('combobox',{name:'Appearance',exact:true}).selectOption('dark');
await page.getByRole('button',{name:/Browse .* drafted patterns/}).click();
await page.getByRole('img',{name:/Teagan.*drafted preview/}).waitFor();
for(const [width,height] of [[1440,940],[1080,720]]) {
 await page.setViewportSize({width,height});
 await page.screenshot({path:`${out}/${width}-gallery-dark.png`});
}
const previews=await page.evaluate(async()=>{
 const [{patternPreview},{designIds,patternCatalog}]=await Promise.all([import('/src/pattern-preview.ts'),import('/src/pattern-catalog.ts')]);
 return designIds.map(id=>({id,name:patternCatalog[id].name,...patternPreview(id,'male-m')}));
});
await fs.writeFile(`${out}/audit.json`,JSON.stringify(previews.map(({id,name,pieces,error})=>({id,name,pieces,error})),null,2));
await page.setViewportSize({width:1500,height:1000});
await page.setContent(`<html><style>body{margin:0;padding:20px;background:#f4f1e9;font:13px system-ui;color:#242521}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}.card{background:#fbf9f4;padding:16px;border:1px solid #d5d1c7}.art{height:180px;background:#eeeae1}.art img{width:100%;height:100%;object-fit:contain}p{margin:12px 0 2px}small{font-size:11px;color:#66665d}</style><h1>65 pattern studies — cleaned seam outlines</h1><div class="grid">${previews.map(p=>`<div class="card"><div class="art"><img src="${p.url}"></div><p>${p.name}</p><small>${p.pieces} pieces</small></div>`).join('')}</div></html>`);
await page.screenshot({path:`${out}/all-65.png`,fullPage:true});
await browser.close();
