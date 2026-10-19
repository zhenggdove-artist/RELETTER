// One geometry contract for rendering, movement and server validation.
export function blockSize(b){
 const s=b.size|| (b.shape==='bar'?[6,2,2]:[2,2,2]);
 return b.rotation===1?[s[2],s[1],s[0]]:[...s];
}
export const validBlockSize=s=>Array.isArray(s)&&s.length===3&&[1,2,4,6].includes(s[0])&&[.5,1,1.5,2].includes(s[1])&&[1,2,4,6].includes(s[2]);
