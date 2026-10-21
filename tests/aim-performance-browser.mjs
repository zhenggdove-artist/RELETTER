import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();await page.addInitScript(()=>window.__reletterTestPause=true);
 await page.goto('http://127.0.0.1:8788');await page.locator('#password').fill('rae1210');await page.locator('#login-form button').click();await page.locator('[data-character="Ely"]').click();
 await page.waitForFunction(()=>window.reletter_test?.model()&&reletter_test.threat().loaded);
 const result=await page.evaluate(()=>{
  const t=reletter_test,w=t.world(),T=t.THREE;t.explore([0,0,12]);t.model().rotation.set(0,Math.PI,0);w.camera.position.set(0,6,20);w.camera.lookAt(0,6,0);w.monsters[0].root.visible=true;w.monsters[0].root.position.set(0,0,0);
  let calls=0;const original=T.SkinnedMesh.prototype.raycast;T.SkinnedMesh.prototype.raycast=function(...args){calls++;return original.apply(this,args);};
  const start=performance.now();for(let i=0;i<30;i++)render_game_to_text();const elapsed=performance.now()-start;
  const target=JSON.parse(render_game_to_text()).aim.direction;
  w.monsters[0].root.visible=false;const sky=JSON.parse(render_game_to_text()).aim.direction;
  const block=new T.Mesh(new T.BoxGeometry(6,12,2),new T.MeshBasicMaterial());block.position.set(0,6,10);w.buildMeshes.set('perf-cover',block);
  const cover=JSON.parse(render_game_to_text()).aim.direction;
  w.buildMeshes.delete('perf-cover');block.geometry.dispose();block.material.dispose();T.SkinnedMesh.prototype.raycast=original;
  return {elapsed,calls,target,sky,cover};
 });
 assert.equal(result.calls,0,'aim must never scan deforming character meshes');
 assert.ok(result.elapsed<500,`30 aim queries exceeded generous CPU budget: ${result.elapsed}ms`);
 assert.ok(result.target[1]>.4&&result.target[2]<-.8,'aim converges on the monster gameplay volume');
 assert.ok(result.sky[2]<0,'hidden monster does not intercept aim');
 assert.ok(Math.abs(Math.atan2(result.cover[0],result.cover[2]))>3.14,'cover cannot redirect character yaw');
 console.log('PASS bounded aim cost, no skinned raycasts, visible monster targeting, hidden monster exclusion and building cover',result);
}finally{await browser.close();}
