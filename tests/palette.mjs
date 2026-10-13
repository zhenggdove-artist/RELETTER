import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:720}});
await page.addInitScript(()=>window.__reletterTestPause=true);
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:3002');
 await page.waitForFunction(()=>window.reletter_test?.model());
 await page.locator('#password').fill('rae1210');await page.locator('#login-form button').click();
 assert.equal((await page.locator('#characters').innerText()).replace(/\s+/g,' ').trim(),'Ely Rae');
 await page.locator('[data-character="Rae"]').click();await page.waitForSelector('#entry-gate',{state:'detached'});
 await page.evaluate(()=>advanceTime(100));
 const result=await page.evaluate(()=>{
  const {THREE:T,renderer:r}=reletter_test;
  const mat=model=>{let m;model.traverse(o=>{if(o.isMesh&&!m)m=Array.isArray(o.material)?o.material[0]:o.material;});return m;};
  const original=mat(reletter_test.original()),purple=mat(reletter_test.model());
  const c=document.createElement('canvas'),im=original.map.image;c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);
  const pixels=ctx.getImageData(0,0,c.width,c.height).data;
  let cool,warm;
  for(let y=10;y<c.height-10;y+=8)for(let x=10;x<c.width-10;x+=8){const i=(y*c.width+x)*4,[red,g,b]=pixels.slice(i,i+3);if(!cool&&g>180&&b>150&&red<80)cool=[x,y];if(!warm&&red>200&&g>140&&g<195&&b>90&&b<150)warm=[x,y];}
  if(!cool||!warm)throw Error('Missing atlas samples');
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;scene.add(new T.AmbientLight(0xffffff,3));
  const geometry=new T.PlaneGeometry(2,2),mesh=new T.Mesh(geometry,original);scene.add(mesh);
  const target=new T.WebGLRenderTarget(16,16),oldTarget=r.getRenderTarget(),tone=r.toneMapping;r.toneMapping=T.NoToneMapping;
  const sample=(material,xy)=>{const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(xy[0]+.5)/c.width,(xy[1]+.5)/c.height);uv.needsUpdate=true;mesh.material=material;r.setRenderTarget(target);r.render(scene,camera);const p=new Uint8Array(4);r.readRenderTargetPixels(target,8,8,1,1,p);return [...p].slice(0,3);};
  const result={coolOriginal:sample(original,cool),coolRae:sample(purple,cool),skinOriginal:sample(original,warm),skinRae:sample(purple,warm)};
  r.setRenderTarget(oldTarget);r.toneMapping=tone;geometry.dispose();target.dispose();return result;
 });
 assert.deepEqual(result.skinRae,result.skinOriginal,'Flesh atlas must retain its exact rendered colour');
 assert.ok(result.coolRae[2]>result.coolRae[0]&&result.coolRae[0]>result.coolRae[1],'Body must render violet');
 assert.notDeepEqual(result.coolOriginal,result.coolRae);
 const ui=await page.locator('#media-tools').innerText();assert.ok(!/\p{Script=Han}/u.test(ui));
 await page.evaluate(()=>advanceTime(1000));await page.screenshot({path:'output/verification/rae-palette.png'});
 const portrait=await page.evaluate(()=>{
  const {THREE:T,renderer:r}=reletter_test,model=reletter_test.model(),parent=model.parent;
  const scene=new T.Scene();scene.background=new T.Color('#f5efff');scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(3,5,5);scene.add(light);scene.add(model);
  const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3()),height=box.getSize(new T.Vector3()).y;
  const camera=new T.PerspectiveCamera(40,r.domElement.width/r.domElement.height,.01,100);camera.position.copy(center).add(new T.Vector3(0,0,height*1.8));camera.lookAt(center);r.render(scene,camera);
  const data=r.domElement.toDataURL('image/png');parent.add(model);return data;
 });
 await fs.writeFile('output/verification/rae-portrait.png',Buffer.from(portrait.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);console.log('PASS: English controls, minimal selection, exact preserved skin and violet body',result);
}finally{await browser.close();}
