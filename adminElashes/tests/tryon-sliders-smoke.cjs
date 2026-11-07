const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const permissions=['catalog:view','catalog:manage','dashboard:view'];
 const demo={id:999,name:'Prueba local',email:'demo@example.invalid',role:{name:'SuperAdmin',permissions:permissions.map(name=>({name}))},permissions};
 const fixture=JSON.parse(fs.readFileSync(process.env.TRYON_V2_FIXTURE,'utf8'));
 await context.addInitScript(({demo,permissions})=>{localStorage.setItem('_tkn','local-ui-test');localStorage.setItem('user_data',JSON.stringify(demo));localStorage.setItem('user_roles',JSON.stringify(['SuperAdmin']));localStorage.setItem('user_permissions',JSON.stringify(permissions));},{demo,permissions});
 await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='127.0.0.1'&&url.port==='5179')return route.continue();
   if(url.hostname!=='127.0.0.1'||url.port!=='8679')return route.abort();
   let data=[];
   if(url.pathname==='/catalogs/tryon/styles')data=fixture.styles.map(s=>{const {revision,engine_version,...style}=s;return {style,revision,published_revision:revision};});
   else if(url.pathname.startsWith('/catalogs/tryon/options/'))data=fixture.options[url.pathname.split('/').pop()].map(option=>({option,published:option,revision:option.revision,published_revision:option.revision}));
   else if(url.pathname.includes('/auth/me'))data=demo;
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 const page=await context.newPage(),errors=[],dialogs=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.type());void d.dismiss();});
 const out=process.env.TRYON_ARTIFACT_DIR;fs.mkdirSync(out,{recursive:true});
 try {
   const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.goto('http://127.0.0.1:5179/designs');await page.getByRole('button',{name:'Nuevo estilo',exact:true}).click();
   await page.getByRole('button',{name:'Acabado y distribución',exact:true}).click();
   assert.equal(await page.getByRole('slider').count(),12);
   const canvas=page.locator('canvas[aria-label^="Pestaña 3D"]');await canvas.waitFor();await frame();
   const curl=page.getByRole('slider',{name:'Curvatura',exact:true}),before=await canvas.screenshot();
   await curl.fill('1.02');await frame();assert(!before.equals(await canvas.screenshot()));
   await curl.focus();await curl.press('ArrowLeft');assert.equal(Number(await curl.inputValue()),1);
   await curl.press('Home');assert.equal(Number(await curl.inputValue()),0);await curl.press('End');assert.equal(Number(await curl.inputValue()),1.2);
   await page.screenshot({path:path.join(out,'style-sliders.png')});
   for(const [route,label,value] of [
    ['lengths','Escala respecto al largo del estilo (1 = actual)','1.37'],
    ['thicknesses','Diámetro nominal en mm','0.12'],
    ['techniques','Fibras por grupo','6']]) {
    await page.goto('http://127.0.0.1:5179/tryon/'+route);await page.getByRole('button',{name:'Nueva opción',exact:true}).click();
    const model=page.locator('canvas[aria-label^="Pestaña 3D"]');await model.waitFor();await frame();const old=await model.screenshot();
    const slider=page.getByRole('slider',{name:label,exact:true});await slider.fill(value);await frame();
    assert.equal(Number(await slider.inputValue()),Number(value));assert(!old.equals(await model.screenshot()));
    assert.equal(Number(await slider.locator('..').locator('output').innerText()),Number(value));
    assert.equal(await page.getByRole('spinbutton',{name:'Orden',exact:true}).count(),1,'Order stays a numeric metadata field');
    const initial=await slider.inputValue();await page.getByRole('button',{name:'Ayuda: '+label,exact:true}).click();
    await page.getByRole('button',{name:'Entendido',exact:true}).click();assert.equal(await slider.inputValue(),initial);
    await page.screenshot({path:path.join(out,'sliders-'+route+'.png')});
   }
   assert.equal(errors.length,0,errors.join('\n'));assert.equal(dialogs.length,0);
   console.log('PASS: 12 style sliders, keyboard increments/bounds, length/thickness/technique sliders, value badges, live geometry and unchanged tutorial values.');
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
