import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const phase=process.argv[2]||'before';
const browser=await chromium.launch({headless:true});
const out=`qa/ui-021/${phase}`;await fs.mkdir(out,{recursive:true});
for(const [width,height] of [[1440,940],[1080,720]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 const capture=async name=>{await page.waitForTimeout(450);await page.screenshot({path:`${out}/${width}-${name}.png`});console.log(`${width}-${name}`)};
 await page.goto('http://127.0.0.1:1420');await page.getByRole('heading',{name:'Solar botanical'}).waitFor();await page.locator('.canvas-host[data-rendered-body]').waitFor();
 await capture('tattoo');
 await page.getByRole('button',{name:'Studio home',exact:true}).click();await capture('home');await page.getByRole('button',{name:'Close studio home'}).click();
 await page.getByRole('button',{name:/Choose body/}).click();await capture('body-library');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/Edit source in image studio/}).click();await capture('artwork');
 const art=page.getByRole('dialog',{name:'Tattoo image studio'});await art.getByRole('button',{name:'Stencil output'}).click();await capture('stencil');await page.getByRole('button',{name:'Close stencil studio'}).click();await art.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Fashion',exact:true}).click();await page.locator('[data-piece="front"] g path').first().waitFor();await capture('fashion');
 await page.getByRole('button',{name:/Browse .* drafted patterns/}).click();await capture('pattern-library');await page.getByRole('button',{name:'Close pattern library'}).click();
 await page.getByRole('button',{name:/Vector packs/}).click();await capture('vectors');
 await page.close();
}
await browser.close();
