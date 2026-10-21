export const validSurfaceId=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
export function surfaceImage(data){
 if(typeof data!=='string'||data.length>180000)throw Error('Skin must be compressed below 128 KB');
 const m=data.match(/^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);if(!m||m[2].length%4)throw Error('Invalid skin image');
 const bytes=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));if(bytes.length>131072)throw Error('Skin too large');
 const ascii=(a,n)=>String.fromCharCode(...bytes.slice(a,a+n));let w,h;
 if(m[1]==='webp'&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){
  const kind=ascii(12,4);if(kind==='VP8X'){w=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);h=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
  else if(kind==='VP8 '){w=(bytes[26]|bytes[27]<<8)&16383;h=(bytes[28]|bytes[29]<<8)&16383;}
  else if(kind==='VP8L'){const b=bytes.slice(21,25);w=1+(b[0]|(b[1]&63)<<8);h=1+((b[1]>>6)|b[2]<<2|(b[3]&15)<<10);}
 }else if(m[1]==='png'&&bytes[0]===137&&ascii(1,3)==='PNG'){const v=new DataView(bytes.buffer);w=v.getUint32(16);h=v.getUint32(20);}
 if(!w||!h||w>768||h>768)throw Error('Use a WebP or PNG skin no larger than 768 pixels');
 return bytes;
}
export async function surfaceHash(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',surfaceImage(data)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function paintAction(g,actor,body){
 const p=actor.state?.position,object=body.kind==='pond'?g.fishing?.ponds?.find(b=>b.id===body.id):g.blocks?.find(b=>b.id===body.id);
 if(!p||!actor.state.visible||!object)return {error:'Select an existing object'};
 if(Math.hypot(...object.position.map((v,i)=>v-p[i]))>18)return {error:'Move closer to paint'};
 if(!validSurfaceId(body.surface))return {error:'Upload a skin first'};
 if((object.surfaceRevision||0)!==body.expectedRevision)return {error:'This object was painted by the other player. Reopen it before painting.'};
 object.surface=body.surface;object.surfaceRevision=(object.surfaceRevision||0)+1;
 if(body.kind==='pond')g.fishing.revision++;else g.buildRevision++;return {};
}
