// Anatomies deliberately use different skeletons, not a shared hanging mantle.
export function buildAbyssAnatomy(T,s,api){
 const {root,sphere,tube,fin,skin,luminous,black,membrane,swimmers}=api,shape=s.shape,v=(s.index%5)/4;
 const eye=(p,r=.07)=>{sphere(root,p,[r,r,r*.65],luminous);sphere(root,[p[0],p[1],p[2]+r*.5],[r*.32,r*.7,r*.25],black);};
 const bone=(pts,r=.05)=>tube(root,pts,r,skin);
 const ribs=(x,y,z,n=9)=>{for(let i=0;i<n;i++)for(const side of [-1,1])tube(root,[[x,y-i*.1,z],[x+side*.35,y-i*.1-.08,z+.1],[x+side*.24,y-i*.1-.15,z+.24]],.016,luminous);};
 const jaw=(p,r=.3)=>{sphere(root,p,[r,r*.8,.08],black);for(let i=0;i<16;i++){const a=i*Math.PI/8;bone([[p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r*.8,p[2]+.05],[p[0]+Math.cos(a)*r*.63,p[1]+Math.sin(a)*r*.5,p[2]+.11]],.018);}};
 const wing=(side,span,y=0)=>{const g=new T.Group();root.add(g);fin(g,Array.from({length:33},(_,i)=>{const t=i/32;return [side*(.15+Math.sin(t*Math.PI)*span),y+.8-t*1.65,Math.sin(t*Math.PI*4)*.1];}),[0,y,0]);swimmers.push({part:g,axis:'y',amount:.13,phase:side});};
 if(['worm','leviathan'].includes(shape)){
  const n=shape==='worm'?18:13;for(let i=0;i<n;i++){const t=i/(n-1),x=-1.8+t*3.6,y=Math.sin(t*7+v)*.38,r=(.12+Math.sin(t*Math.PI)*.19);sphere(root,[x,y,0],[.2,r,r],skin);if(shape==='worm')for(const side of [-1,1])bone([[x,y,side*r],[x+.1,y-.3,side*.5],[x-.12,y-.4,side*.62]],.025);else if(i%2===0)fin(root,[[x-.2,y+.18,0],[x,y+.6,0],[x+.2,y+.18,0]],[x,y,0]);}sphere(root,[1.9,Math.sin(7+v)*.38,0],[.43,.28,.3],skin);eye([2,.15,.27]);jaw([2.15,-.08,.26],.21);
 }else if(shape==='crab'){
  sphere(root,[0,0,0],[.9,.28,.65]);for(const side of [-1,1]){for(let i=0;i<4;i++){const z=(i-1.5)*.3;bone([[side*.65,0,z],[side*(1.1+i*.1),.2,z-.15],[side*1.65,-.48,z+.1]],.065);}bone([[side*.7,.1,.4],[side*1.2,.45,.7],[side*1.4,.6,.9]],.09);for(const k of [-1,1])bone([[side*1.4,.6,.9],[side*(1.5+k*.2),.82,.9],[side*1.4,1,.9]],.065);eye([side*.28,.3,.5]);}
 }else if(shape==='moth'||shape==='seraph'){
  sphere(root,[0,0,0],[.14,.78,.15]);for(const side of [-1,1]){wing(side,shape==='moth'?1.65:1.1,.15);if(shape==='seraph'){wing(side,1.35,-.5);wing(side,.85,.65);}bone([[side*.08,.65,0],[side*.3,1.1,0],[side*.55,1.25,.05]],.018);}eye([0,.55,.16],.12);
 }else if(shape==='hydra'){
  sphere(root,[0,-.55,0],[.65,.25,.4]);for(let i=0;i<5+Math.round(v*3);i++){const x=(i-3)*.35,y=.65+(i%3)*.3,z=Math.sin(i*3)*.2;bone([[x*.4,-.5,0],[x*.8,.05,z],[x,y,z]],.09);sphere(root,[x,y,z],[.17,.13,.18]);jaw([x,y,z+.16],.11);eye([x-.06,y+.08,z+.16],.035);}
 }else if(shape==='coral'||shape==='shrine'){
  for(let i=0;i<7;i++){const x=(i-3)*.3,h=.6+Math.sin(i*1.7+v)*.5;bone([[x,-.8,0],[x,.1,0],[x*.9,h,0]],shape==='shrine'?.09:.045);for(const side of [-1,1])bone([[x,.1,0],[x+side*.2,h-.2,.1],[x+side*.28,h+.1,.15]],.024);if(shape==='shrine'){sphere(root,[x,h,.05],[.09,.19,.08],luminous);ribs(x,h-.1,0,4);}}if(shape==='shrine')jaw([0,-.45,.15],.35);else sphere(root,[0,-.8,0],[.85,.15,.38]);
 }else if(shape==='mask'){
  sphere(root,[0,.25,0],[.68,.83,.14]);for(const side of [-1,1]){eye([side*.28,.5,.13],.16);bone([[side*.5,.5,0],[side*.9,.9,0],[side*.55,1.4,0]],.065);bone([[side*.5,0,0],[side*.7,-.4,0],[side*.35,-1.1,0]],.035);}jaw([0,-.2,.17],.24);
 }else if(shape==='nautilus'){
  sphere(root,[0,.1,0],[.88,.9,.35]);const pts=[];for(let i=0;i<90;i++){const a=i*.17,r=.02+i*.009;pts.push([Math.cos(a)*r,.1+Math.sin(a)*r,.34]);}tube(root,pts,.04,luminous);for(let i=0;i<22;i++){const a=i*6.283/22;bone([[Math.cos(a)*.65,.1+Math.sin(a)*.65,.25],[Math.cos(a)*.97,.1+Math.sin(a)*.97,0]],.025);}for(let i=0;i<5;i++)bone([[.5,-.45,0],[.9,-.6+i*.1,.15],[1.5,-.3+i*.16,.2]],.035);eye([.7,-.4,.22]);
 }else if(shape==='urchin'){
  sphere(root,[0,0,0],[.45,.45,.45]);for(let i=0;i<42;i++){const y=1-2*i/41,a=i*2.39996,r=Math.sqrt(1-y*y),len=.9+(i%4)*.14;bone([[r*Math.cos(a)*.4,y*.4,r*Math.sin(a)*.4],[r*Math.cos(a)*len,y*len,r*Math.sin(a)*len]],.03);}jaw([0,0,.45],.22);
 }else if(shape==='jelly'){
  const dome=new T.Mesh(new T.SphereGeometry(.8,28,16,0,6.283,0,1.7),membrane);root.add(dome);for(let i=0;i<10;i++){const a=i*6.283/10;bone([[Math.cos(a)*.6,0,Math.sin(a)*.6],[Math.cos(a)*.65,-.65,Math.sin(a)*.65],[Math.cos(a+.4)*.45,-1.5,Math.sin(a+.4)*.45]],.025);}sphere(root,[0,.2,0],[.24,.3,.24],luminous);
 }else if(shape==='squid'){
  sphere(root,[0,.65,0],[.28,1,.28]);for(const side of [-1,1])fin(root,[[side*.2,.9,0],[side*.85,1.5,0],[side*.3,-.1,0]],[0,.5,0]);for(let i=0;i<8;i++){const a=i*6.283/8;bone([[Math.cos(a)*.2,-.2,Math.sin(a)*.2],[Math.cos(a)*.55,-.85,Math.sin(a)*.55],[Math.cos(a+.7)*.8,-1.4,Math.sin(a+.7)*.8]],.035);}eye([.14,.1,.25]);
 }else if(shape==='lantern'){
  sphere(root,[0,0,0],[.8,.55,.65]);jaw([0,0,.57],.53);for(const side of [-1,1]){eye([side*.47,.4,.4],.09);wing(side,.8,-.25);}bone([[0,.45,0],[0,1.15,.1],[0,1.3,.65],[0,.95,.9]],.035);sphere(root,[0,.95,.9],[.12,.15,.12],luminous);
 }else if(shape==='oracle'){
  const ring=new T.Mesh(new T.TorusGeometry(.8,.12,10,40),skin);root.add(ring);eye([0,0,0],.42);for(let i=0;i<12;i++){const a=i*6.283/12;bone([[Math.cos(a)*.8,Math.sin(a)*.8,0],[Math.cos(a)*1.1,Math.sin(a)*1.1,.15]],.025);eye([Math.cos(a)*1.1,Math.sin(a)*1.1,.15],.045);}
 }else{
  // Upright ribcage, shoulders, articulated arms and two load-bearing legs.
  sphere(root,[0,.1,0],[.43,.65,.25]);ribs(0,.55,.2,9);sphere(root,[0,.85,0],[.3,.32,.26]);for(const side of [-1,1]){bone([[side*.35,.45,0],[side*.8,.05,.1],[side*.7,-.5,.3]],.1);for(let j=0;j<3;j++)bone([[side*.7,-.5,.3],[side*(.65+j*.09),-.8,.35]],.025);bone([[side*.2,-.4,0],[side*.37,-.85,0],[side*.5,-1.25,.2]],.12);eye([side*.12,.9,.24]);}for(let i=0;i<4;i++)bone([[(i-1.5)*.1,.72,.2],[(i-1.5)*.15,.4,.4],[(i-1.5)*.2,.25,.35]],.025);
 }
 root.userData.anatomy=shape;root.scale.x=1+(v-.5)*.18;
}
