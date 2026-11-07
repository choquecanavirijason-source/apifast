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
   for(const [kind,route,label,value] of [
     ['length','lengths','Escala respecto al largo del estilo (1 = actual)','1.4'],
     ['thickness','thicknesses','Diámetro nominal en mm','0.15'],
     ['technique','techniques','Fibras por grupo','6']]) {
     console.log('Checking live preview: '+kind);
     await page.goto('http://127.0.0.1:5179/tryon/'+route);
     await page.getByRole('button',{name:'Nueva opción',exact:true}).click();
     const canvas=page.locator('canvas[aria-label^="Pestaña 3D"]');await canvas.waitFor();await frame();
     const before=await canvas.screenshot();await page.getByRole('slider',{name:label,exact:true}).fill(value);await frame();
     assert(!before.equals(await canvas.screenshot()),kind+' changes the live mesh');
     await page.getByRole('combobox',{name:'Estilo de prueba',exact:true}).selectOption('foxyeye');await frame();
     assert(!before.equals(await canvas.screenshot()),'Preview supports another style');
     await page.screenshot({path:path.join(out,'option-'+kind+'.png')});
     if(kind==='technique'){
       const old=await canvas.screenshot();await page.getByRole('checkbox',{name:'Conservar distribución original del estilo',exact:true}).check();await frame();
       assert.equal(await page.getByRole('slider',{name:'Fibras por grupo',exact:true}).count(),0);assert(!old.equals(await canvas.screenshot()));
       await page.getByRole('checkbox',{name:'Conservar distribución original del estilo',exact:true}).uncheck();
     }
     const originals=await page.locator('input[type="number"],input[type="range"]').evaluateAll(nodes=>nodes.map(n=>n.value));
     await page.getByRole('button',{name:'Ver demostración animada',exact:true}).click();
     let help=page.getByRole('dialog').filter({has:page.getByRole('button',{name:'Entendido',exact:true})});await help.waitFor();await help.getByRole('button',{name:'Entendido',exact:true}).click();
     const buttons=await page.getByRole('button',{name:/^Ayuda:/}).all();assert.equal(buttons.length,kind==='technique'?6:1);
     for(let i=0;i<buttons.length;i++){
       await buttons[i].click();help=page.getByRole('dialog').filter({has:page.getByRole('button',{name:'Entendido',exact:true})});await help.getByRole('button',{name:'Pausar tutorial',exact:true}).click();
       const progress=help.getByRole('slider',{name:'Progreso del tutorial',exact:true}),demo=help.locator('canvas');
       await progress.fill('1');await frame();const low=await demo.screenshot();await progress.fill('6');await frame();assert(!low.equals(await demo.screenshot()),kind+' tutorial '+i+' changes the mesh');
       if(i===0)await page.screenshot({path:path.join(out,'option-video-'+kind+'.png')});
       await help.getByRole('button',{name:'Entendido',exact:true}).click();
     }
     assert.deepEqual(await page.locator('input[type="number"],input[type="range"]').evaluateAll(nodes=>nodes.map(n=>n.value)),originals,'Tutorial leaves the option unchanged');
     await page.getByRole('button',{name:'Ampliar vista 3D',exact:true}).click();await page.getByRole('button',{name:'Reducir vista 3D',exact:true}).click();
     await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();await page.getByRole('button',{name:'Descartar cambios',exact:true}).click();
   }
   assert.equal(errors.length,0,errors.join('\n'));assert.equal(dialogs.length,0);
   console.log('PASS: live length/thickness/technique previews, styles, original distribution, expansion, 8 animated lessons and unchanged draft values.');
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
