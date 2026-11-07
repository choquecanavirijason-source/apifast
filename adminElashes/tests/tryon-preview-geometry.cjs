const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'elashes-preview-geometry-'));
try {
 for(const name of ['profilePreview','previewGeometry','styleHelpTopics','styleTutorialTimeline','optionPreview']) {
  const source=fs.readFileSync(path.join(root,'src/pages/admin/tryon',name+'.ts'),'utf8');
  fs.writeFileSync(path.join(temp,name+'.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText);
 }
 const {buildPreviewMesh}=require(path.join(temp,'previewGeometry.js'));
 const data=JSON.parse(fs.readFileSync(path.join(root,'src/core/config/tryon-templates.json'),'utf8'));
 const options={length:[],technique:[],thickness:[]};let combinations=0;
 for(const profile of Object.values(data.templates))for(let length=0;length<3;length++)for(let technique=0;technique<4;technique++)for(let thickness=0;thickness<4;thickness++) {
  const mesh=buildPreviewMesh(profile,{length,technique,thickness},options);
  assert(mesh.fibers<=240);assert.equal(mesh.vertices.length,mesh.fibers*108*7);
  assert(mesh.vertices.every(Number.isFinite));assert(mesh.guide.every(Number.isFinite));assert(mesh.radius>0);combinations++;
 }
 const profile=data.templates.cateye,selection={length:1,technique:0,thickness:3};
 const open=buildPreviewMesh(profile,selection,options),closed=buildPreviewMesh(profile,selection,options,true);
 assert.notDeepEqual(open.vertices,closed.vertices);assert.deepEqual(open.vertices,buildPreviewMesh(profile,selection,options).vertices);
 const custom={length:[{option:{id:9},published:{parameters:{scale:1.6}}}],thickness:[{option:{id:9},published:{parameters:{diameter:.12}}}],technique:[{option:{id:9},published:{parameters:{base_technique:2,fibers_per_group:8,single_every:2,density:1.5,spread:20}}}]};
 const mesh=buildPreviewMesh(profile,{length:9,technique:9,thickness:9},custom);assert(mesh.fibers<=240);assert(mesh.vertices.every(Number.isFinite));
 assert.throws(()=>buildPreviewMesh({...profile,curl:NaN},selection,options));
 const {styleHelpTopics,helpProfile,helpValue}=require(path.join(temp,'styleHelpTopics.js'));
 const source=JSON.stringify(profile);assert.equal(styleHelpTopics.length,12);
 for(const topic of styleHelpTopics){const a=helpProfile(profile,topic.key,topic.low),b=helpProfile(profile,topic.key,topic.high);const selection={length:1,technique:topic.technique,thickness:3};assert.notDeepEqual(buildPreviewMesh(a,selection,options).vertices,buildPreviewMesh(b,selection,options).vertices,topic.key);assert.equal(helpValue(a,topic.key),topic.low);assert.equal(JSON.stringify(profile),source);}
 const {tutorialFrame,tutorialDuration}=require(path.join(temp,'styleTutorialTimeline.js'));
 for(const topic of styleHelpTopics){
  assert.equal(tutorialFrame(topic,0).value,topic.low);assert.equal(tutorialFrame(topic,6).value,topic.high);assert.equal(tutorialFrame(topic,tutorialDuration).value,topic.high);
  assert.equal(new Set([1,9,17].map(t=>tutorialFrame(topic,t).view)).size,3);
  for(const second of [0,1,3.5,6,7.5,8,11.5,14,15.5,16,19.5,22,24]){const frame=tutorialFrame(topic,second);assert(frame.value>=topic.min&&frame.value<=topic.max);assert(Object.values(frame.camera).every(Number.isFinite));assert(buildPreviewMesh(helpProfile(profile,topic.key,frame.value),{length:1,technique:topic.technique,thickness:3},options).fibers<=240);}
 }
 const {optionDefaults,optionPreviewDemo,optionHelpDemo,optionHelpKeys,optionHelpTopics}=require(path.join(temp,'optionPreview.js'));
 for(const kind of ['length','thickness','technique']) {
   const parameters={...optionDefaults,...(kind==='length'?{scale:1}:kind==='thickness'?{diameter:.07}:{base_technique:1,fibers_per_group:3,spread:10})};
   const untouched=JSON.stringify(parameters);
   const live=optionPreviewDemo(profile,kind,parameters,'Cat Eye');assert(buildPreviewMesh(live.profile,live.selection,live.options).vertices.every(Number.isFinite));
   for(const key of optionHelpKeys(kind)){
     const topic=optionHelpTopics[key],low=optionHelpDemo(profile,kind,parameters,key,topic.low,'Cat Eye'),high=optionHelpDemo(profile,kind,parameters,key,topic.high,'Cat Eye');
     assert.notDeepEqual(buildPreviewMesh(low.profile,low.selection,low.options).vertices,buildPreviewMesh(high.profile,high.selection,high.options).vertices,key);
     for(const seconds of [0,3,6,11,14,19,22,24]){const frame=tutorialFrame(topic,seconds),demo=optionHelpDemo(profile,kind,parameters,key,frame.value,'Cat Eye');assert(buildPreviewMesh(demo.profile,demo.selection,demo.options).fibers<=240);}
   }
   assert.equal(JSON.stringify(parameters),untouched);
 }
 console.log('PASS: length/thickness/technique live meshes and 8 animated option lessons, immutable parameters.');
 console.log('PASS: 12 animated tutorials, three views, bounded values and stable end frame.');
 console.log('PASS: 12 tutorial comparisons change the demo mesh and leave the original profile untouched.');
 console.log(`PASS: ${combinations} combinations, 3D depth, open/closed, deterministic geometry, dynamic options, bounded fibers.`);
}finally{const relative=path.relative(path.resolve(os.tmpdir()),path.resolve(temp));assert(!path.isAbsolute(relative)&&!relative.startsWith('..')&&relative.startsWith('elashes-preview-geometry-'));fs.rmSync(temp,{recursive:true,force:true});}
