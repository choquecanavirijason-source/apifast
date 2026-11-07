/* Automated local-only UI integration check. Start the in-memory API on
 * 127.0.0.1:8679 and Vite on 127.0.0.1:5179 before running this script.
 * No requests are allowed to reach a production host. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
(async()=>{
 let browser;try {browser=await chromium.launch({headless:true});}catch {browser=await chromium.launch({headless:true,channel:'msedge'});}
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const permissions=['catalog:view','catalog:manage','dashboard:view'];
  const demo={id:999,name:'Prueba local',email:'demo@example.invalid',role:{name:'SuperAdmin',permissions:permissions.map(name=>({name}))},permissions};
  await context.addInitScript(({demo,permissions})=>{
    localStorage.setItem('_tkn','local-ui-test');localStorage.setItem('user_data',JSON.stringify(demo));
    localStorage.setItem('user_roles',JSON.stringify(['SuperAdmin']));localStorage.setItem('user_permissions',JSON.stringify(permissions));
  },{demo,permissions});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='127.0.0.1'&&url.port==='5179')return route.continue();
    if(url.hostname==='127.0.0.1'&&url.port==='8679'&&url.pathname.startsWith('/catalogs/tryon/'))return route.continue();
    if(url.hostname==='127.0.0.1'&&url.port==='8679')return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(url.pathname.includes('/auth/me')?demo:[])});
    return route.abort();
  });
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const createdOptions={};
  for(const [kind,route,name,label,value] of [
    ['length','lengths','Largo de prueba','Escala respecto al largo del estilo (1 = actual)','1.4'],
    ['technique','techniques','Técnica 5D de prueba','Fibras por grupo','5'],
    ['thickness','thicknesses','Grosor de prueba','Diámetro nominal en mm','0.12']]) {
    const optionName=name+' '+Date.now();
    await page.goto('http://127.0.0.1:5179/tryon/'+route);
    await page.getByRole('button',{name:'Nueva opción',exact:true}).click();
    await page.getByRole('textbox',{name:'Nombre',exact:true}).fill(optionName);
    await page.getByRole('slider',{name:label,exact:true}).fill(value);
    const save=page.waitForResponse(r=>r.url().endsWith('/catalogs/tryon/options/'+kind)&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
    const response=await save;assert.equal(response.status(),201);const row=await response.json();
    await page.getByRole('button',{name:'Publicar',exact:true}).waitFor({state:'visible'});
    const publish=page.waitForResponse(r=>r.url().endsWith('/options/'+kind+'/'+row.option.id+'/publish'));
    await page.getByRole('button',{name:'Publicar',exact:true}).click();assert.equal((await publish).status(),200);
    createdOptions[kind]={id:row.option.id,name:optionName};
  }
  await page.goto('http://127.0.0.1:5179/designs');
  await page.getByRole('button',{name:'Nuevo estilo',exact:true}).click();
  const name='Aurora · prueba local '+Date.now();
  await page.getByRole('textbox',{name:'Nombre',exact:true}).fill(name);
  await page.getByRole('button',{name:'Forma de las pestañas',exact:true}).click();
  const slider=page.getByRole('slider',{name:'Largo zona 8',exact:true});
  const old=await slider.inputValue();await slider.focus();await slider.press('ArrowRight');
  assert.notEqual(await slider.inputValue(),old);
  const output=process.env.TRYON_ARTIFACT_DIR||path.join(os.tmpdir(),'elashes-tryon-ui');fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'editor.png'),fullPage:true});
  await page.getByRole('button',{name:'Opciones del salón',exact:true}).click();
  for(const option of Object.values(createdOptions)) await page.getByRole('checkbox',{name:option.name,exact:true}).check();
  for(const [index,kind] of ['length','technique','thickness'].entries()) await page.getByRole('combobox',{name:/Selecci.n inicial/}).nth(index).selectOption(String(createdOptions[kind].id));
  await page.screenshot({path:path.join(output,'combinations.png'),fullPage:true});
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
  await page.getByText('Borrador guardado. Publícalo cuando esté listo.',{exact:true}).waitFor();
  let response=await context.request.get('http://127.0.0.1:8679/catalogs/tryon/manifest');
  let manifest=await response.json();assert(!manifest.styles.some(s=>s.name===name));
  await page.getByRole('button',{name:'Publicar',exact:true}).click();
  await page.getByText('Publicado. Se actualizará al volver a abrir el probador.',{exact:true}).first().waitFor();
  response=await context.request.get('http://127.0.0.1:8679/catalogs/tryon/manifest');manifest=await response.json();
  const published=manifest.styles.find(s=>s.name===name);assert(published);assert.equal(published.builtin_style,null);assert(published.profile);
  for(const kind of ['length','technique','thickness']) assert.equal(published.defaults[kind],createdOptions[kind].id);
  assert.equal(manifest.schema_version,2);
  fs.writeFileSync(path.join(output,'manifest-v2.json'),JSON.stringify(manifest,null,2));
  await page.getByRole('button',{name:'Información',exact:true}).click();
  await page.getByRole('textbox',{name:'Nombre',exact:true}).fill(name+' VIP');
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();
  await page.getByRole('button',{name:'Publicar',exact:true}).click();
  await page.getByRole('button',{name:'Historial',exact:true}).click();
  await page.getByText(/^Versión 2 ·/).waitFor();
  await page.getByRole('button',{name:'Recuperar como borrador',exact:true}).last().click();
  await page.getByText('Versión recuperada como borrador. Revisa y publica.',{exact:true}).waitFor();
  response=await context.request.get('http://127.0.0.1:8679/catalogs/tryon/manifest');manifest=await response.json();
  assert.equal(manifest.styles.find(s=>s.key===published.key).name,name+' VIP');
  await page.getByRole('button',{name:'Publicar',exact:true}).click();
  await page.getByRole('button',{name:'Cerrar',exact:true}).last().click();
  await page.screenshot({path:path.join(output,'catalog.png'),fullPage:true});
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: create and publish length, 5D technique, thickness; assign to a new style; preview, publish, rename and restore.');
  console.log('Screenshots: '+output);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
