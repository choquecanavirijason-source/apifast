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
   await page.goto('http://127.0.0.1:5179/designs');
   await page.getByRole('button',{name:'Nuevo estilo',exact:true}).click();
   const canvas=page.locator('canvas[aria-label^="Pestaña 3D"]');await canvas.waitFor();
   const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await frame();
   assert(!(await page.getByText(/^Vista 2D:/).count()),'WebGL fallback was shown');
   const pixels=await canvas.evaluate(node=>{const gl=node.getContext('webgl');const p=new Uint8Array(node.width*node.height*4);gl.readPixels(0,0,node.width,node.height,gl.RGBA,gl.UNSIGNED_BYTE,p);let visible=0;for(let i=3;i<p.length;i+=4)if(p[i])visible++;return visible;});
   assert(pixels>50,'Mesh must render visible pixels');
   await page.getByRole('button',{name:'Frente',exact:true}).click();await frame();const front=await canvas.screenshot();await page.screenshot({path:path.join(out,'front.png')});
   await page.getByRole('button',{name:'Perfil',exact:true}).click();await frame();assert(!front.equals(await canvas.screenshot()),'Profile must change the view');
   await page.screenshot({path:path.join(out,'profile.png')});
   const inline=await canvas.screenshot(),small=await canvas.boundingBox();
   await page.getByRole('button',{name:'Ampliar vista 3D',exact:true}).click();await frame();
   await page.getByRole('dialog',{name:'Vista ampliada de la pestaña',exact:true}).waitFor();
   const large=await canvas.boundingBox();assert(large.width>small.width*2&&large.height>small.height*1.5);
   await page.screenshot({path:path.join(out,'expanded.png')});
   await page.getByRole('button',{name:'Reducir vista 3D',exact:true}).click();await frame();
   assert(inline.equals(await canvas.screenshot()),'Expanding must preserve rotation and zoom');
   await page.getByRole('button',{name:'Ampliar vista 3D',exact:true}).click();await frame();await canvas.press('Escape');await frame();
   assert.equal(await page.getByRole('dialog',{name:'Vista ampliada de la pestaña',exact:true}).count(),0);

   await page.getByRole('button',{name:'Desde arriba',exact:true}).click();await frame();const top=await canvas.screenshot();assert(!front.equals(top));
   const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+75,box.y+box.height/2-25,{steps:8});await page.mouse.up();await frame();const dragged=await canvas.screenshot();assert(!top.equals(dragged),'Dragging rotates the mesh');
   await canvas.hover();await page.mouse.wheel(0,-250);await frame();assert(!dragged.equals(await canvas.screenshot()),'Wheel changes zoom');
   await page.getByRole('button',{name:'Cerrado',exact:true}).click();await frame();await page.screenshot({path:path.join(out,'closed.png')});
   await page.getByRole('button',{name:'Abierto',exact:true}).click();await page.getByRole('button',{name:'Restablecer vista 3D',exact:true}).click();await canvas.focus();await canvas.press('ArrowRight');await frame();
   await page.getByRole('button',{name:'Forma de las pestañas',exact:true}).click();
   await page.getByRole('button',{name:'Perfil',exact:true}).click();await frame();const before=await canvas.screenshot();
   await page.getByRole('button',{name:'Acabado y distribución',exact:true}).click();
   await page.getByRole('slider',{name:'Curvatura',exact:true}).fill('1.05');await frame();assert(!before.equals(await canvas.screenshot()),'Shape edits must update the 3D mesh');
   await page.screenshot({path:path.join(out,'editor-3d.png')});
   const originals=await page.locator('input[type="number"],input[type="range"]').evaluateAll(nodes=>nodes.map(n=>n.value));
   const helpButtons=await page.getByRole('button',{name:/^Ayuda:/}).all();assert.equal(helpButtons.length,12);
   for(let i=0;i<helpButtons.length;i++) {
     console.log('Checking animated tutorial '+(i+1));
     await helpButtons[i].click();
     const help=page.getByRole('dialog').filter({has:page.getByRole('button',{name:'Entendido',exact:true})});await help.waitFor();
     const progress=help.getByRole('slider',{name:'Progreso del tutorial',exact:true});
     await help.getByRole('button',{name:'Pausar tutorial',exact:true}).click();
     const demoCanvas=help.locator('canvas');
     await progress.fill('1');await frame();const low=await demoCanvas.screenshot();
     await progress.fill('6');await frame();assert(!low.equals(await demoCanvas.screenshot()),'Animated tutorial '+i+' changes the lash');
     assert.equal(await help.locator('details').getAttribute('open'),null,'Long explanations start collapsed');
     if(i===0) {
       await page.screenshot({path:path.join(out,'help-video.png')});
       await help.getByRole('button',{name:'Perfil',exact:true}).click();await frame();
       await help.getByRole('button',{name:'Desde arriba',exact:true}).click();await frame();
       await help.getByRole('button',{name:'Frente',exact:true}).click();await frame();
       await help.getByRole('button',{name:'Repetir tutorial',exact:true}).click();
       await page.waitForFunction(()=>Number(document.querySelector('input[aria-label="Progreso del tutorial"]').value)>.4);
       await help.getByRole('button',{name:'Pausar tutorial',exact:true}).click();
       const paused=await progress.inputValue();await frame();assert.equal(await progress.inputValue(),paused,'Pause keeps the time stable');
       await progress.fill('24');await frame();await help.getByRole('button',{name:'Reproducir tutorial',exact:true}).click();
       assert(Number(await progress.inputValue())<2,'Play restarts a finished tutorial');
       await help.getByRole('button',{name:'Pausar tutorial',exact:true}).click();
       await help.getByText('Más detalles',{exact:true}).click();assert.notEqual(await help.locator('details').getAttribute('open'),null);
       await help.getByRole('button',{name:'Siguiente',exact:true}).click();await frame();await help.getByRole('button',{name:'Anterior',exact:true}).click();await frame();
     }
     await help.getByRole('button',{name:'Entendido',exact:true}).click();
   }
   assert.deepEqual(await page.locator('input[type="number"],input[type="range"]').evaluateAll(nodes=>nodes.map(n=>n.value)),originals,'Video must not edit the actual style');
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.getByRole('button',{name:'Ayuda: Curvatura',exact:true}).click();
   const reduced=page.getByRole('dialog').filter({has:page.getByRole('button',{name:'Entendido',exact:true})});
   await reduced.getByRole('button',{name:'Reproducir tutorial',exact:true}).waitFor();
   assert.equal(Number(await reduced.getByRole('slider',{name:'Progreso del tutorial'}).inputValue()),0);
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'help-video-mobile.png')});
   await reduced.press('Escape');assert.equal(await page.getByRole('button',{name:'Entendido',exact:true}).count(),0);
   await page.setViewportSize({width:390,height:844});await canvas.scrollIntoViewIfNeeded();await frame();const mobile=await canvas.boundingBox();assert(mobile.x>=0&&mobile.x+mobile.width<=390);await page.screenshot({path:path.join(out,'mobile.png')});
   await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();await page.getByRole('button',{name:'Seguir editando',exact:true}).click();await canvas.waitFor();
   await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();await page.getByRole('button',{name:'Descartar cambios',exact:true}).click();await canvas.waitFor({state:'detached'});
   assert.equal(dialogs.length,0,'No native browser dialogs');assert.equal(errors.length,0,errors.join('\n'));
   console.log('PASS: visible WebGL mesh, presets, drag, wheel, keyboard, closed view, live shape edits, mobile sizing in-app confirmation and 12 animated tutorials, play/pause/replay, three angles, seeking, mobile and reduced motion without editing the draft.');
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
