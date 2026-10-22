// Original abyssal illustrations: individual silhouettes, engraved shells, luminous organs.
export function abyssSVG(f) {
 const [base,light,dark]=f.colors,seed=f.index-50,m=f.morphology||{};
 const jelly=f.shape==='jelly',shell=f.shape==='nautilus',ray=f.shape==='manta',seraph=f.shape==='seraph',leviathan=f.shape==='leviathan';
 let limbs='',details='',wings='';
 const count=m.limbs||(jelly?18:shell?10:seraph?12:ray?3:14);
 for(let k=0;k<count;k++){
  const side=k%2?1:-1,n=Math.floor(k/2),x=180+side*(12+n*9),y=135+n*3;
  const endX=180+side*(55+n*13),endY=220+Math.sin(k*1.8+seed)*27;
  const d=`M${x} ${y} C${x+side*42} ${y+24},${endX+side*20} ${endY+30},${endX} ${endY} S${endX-side*28} ${endY-20},${endX-side*13} ${endY+8}`;
  limbs+=`<path d="${d}" fill="none" stroke="${dark}" stroke-width="${10-n*.7}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#limb)" stroke-width="${7-n*.5}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${light}" stroke-width=".8" stroke-dasharray="1 6" opacity=".9"/>`;
 }
 if(m.wings||seraph||f.shape==='cthulhu'||ray)for(const side of [-1,1]){
  wings+=`<path d="M180 117 Q${180+side*60} 29 ${180+side*139} 58 Q${180+side*120} 109 ${180+side*145} 168 Q${180+side*84} 128 ${180+side*57} 181 L180 142Z" fill="url(#membrane)" stroke="${light}" stroke-width=".9"/>`;
  for(let k=0;k<14;k++)wings+=`<path d="M${180+side*25} 128 Q${180+side*(61+k*3)} ${74+k*4} ${180+side*(100+k*3)} ${65+k*7}" fill="none" stroke="${light}" stroke-width=".7" opacity=".6"/>`;
 }
 const extraBodies={crab:'M104 91Q180 34 256 91L241 147Q180 172 119 147Z',worm:'M165 38Q222 28 218 88T157 154Q113 206 218 227Q115 265 116 193Q126 130 181 105Q203 63 165 38Z',mask:'M124 55Q180 29 236 55L220 163 180 205 140 163Z',shrine:'M139 174L130 83 151 50 170 83 180 37 191 83 211 50 230 83 220 174Z',urchin:'M180 46L203 69 236 64 232 98 255 121 232 143 236 176 203 172 180 196 157 172 124 176 128 143 105 121 128 98 124 64 157 69Z',squid:'M180 29Q225 81 227 130L201 165 159 165 133 130Q135 78 180 29Z'};
 const body=extraBodies[f.shape]||(jelly?'M106 132C98 53 139 25 180 31C228 31 270 67 256 132Q232 151 211 135Q180 153 150 135Q126 151 106 132Z':ray?'M180 58Q223 88 228 137L180 187 133 137Q137 89 180 58Z':leviathan?'M172 48Q240 48 244 105Q251 158 192 162Q137 168 147 198Q159 219 210 191Q242 185 240 213Q205 260 153 231Q99 202 133 163Q188 126 190 110Q149 98 172 48Z':'M138 68Q180 31 222 68Q243 106 222 145Q206 176 180 181Q150 166 134 143Q117 109 138 68Z');
 for(let r=0;r<19;r++)for(let c=0;c<20;c++){const x=110+c*7+(r%2)*3.5,y=40+r*9;details+=`<path d="M${x} ${y}q4 6 8 0" fill="none" stroke="${(c+r)%3?light:dark}" stroke-width=".6" opacity=".45"/>`;}
 for(let k=0;k<18;k++){const a=k*Math.PI*2/18,x=180+Math.cos(a)*34,y=103+Math.sin(a)*39;details+=`<path d="M180 105Q${x} ${y} ${x+Math.sin(a)*14} ${y+Math.cos(a)*9}" fill="none" stroke="${light}" opacity=".4" stroke-width="1"/>`;}
 let crown='';
 for(let k=0;k<(m.crown||9);k++){const x=136+k*88/((m.crown||9)-1);crown+=`<path d="M${x} 76Q${x-7} 53 ${x-5} ${30+Math.abs(k-4)*6}Q${x+5} 56 ${x+7} 78" fill="url(#limb)" stroke="${light}" stroke-width=".8"/>`;}
 let eyes='';
 for(let k=0;k<(m.eyes??(f.shape==='oracle'?7:3));k++){const n=m.eyes??(f.shape==='oracle'?7:3),a=(k-(n-1)/2)*.43,x=180+Math.sin(a)*49,y=100+Math.cos(a)*15;eyes+=`<ellipse cx="${x}" cy="${y}" rx="${k===Math.floor(n/2)?10:6}" ry="${k===Math.floor(n/2)?8:5}" fill="${dark}" stroke="${light}" stroke-width="1.3"/><ellipse cx="${x}" cy="${y}" rx="3.8" ry="4.3" fill="${light}"/><ellipse cx="${x}" cy="${y}" rx="1.2" ry="3.7" fill="#101327"/><circle cx="${x-1.2}" cy="${y-1.8}" r="1" fill="#fff"/>`;}
 let spiral='';
 if(shell){for(let k=0;k<160;k++){const a=k*.13,r=1+k*.4,x=180+Math.cos(a)*r,y=99+Math.sin(a)*r;spiral+=`${k?'L':'M'}${x.toFixed(2)} ${y.toFixed(2)} `;}spiral=`<circle cx="180" cy="99" r="66" fill="url(#shell)" stroke="${light}" stroke-width="2"/><path d="${spiral}" fill="none" stroke="${dark}" stroke-width="3"/><path d="${spiral}" fill="none" stroke="${light}" stroke-width="1" stroke-dasharray="2 5"/>`;}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="800" viewBox="0 0 360 280" role="img" aria-label="${f.name}"><defs><radialGradient id="skin"><stop stop-color="${light}"/><stop offset=".25" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/></radialGradient><linearGradient id="limb"><stop stop-color="${base}"/><stop offset=".5" stop-color="${light}"/><stop offset="1" stop-color="${base}"/></linearGradient><linearGradient id="membrane" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset=".6" stop-color="${base}" stop-opacity=".65"/><stop offset="1" stop-color="${light}" stop-opacity=".25"/></linearGradient><radialGradient id="shell"><stop stop-color="${dark}"/><stop offset=".5" stop-color="${base}"/><stop offset=".85" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></radialGradient><clipPath id="body"><path d="${body}"/></clipPath></defs>${wings}${limbs}${jelly||shell?'':crown}<path d="${body}" fill="url(#skin)" stroke="${light}" stroke-width="1.3"/><g clip-path="url(#body)">${details}</g>${spiral}${eyes}<path d="M168 138q12 10 24 0" fill="none" stroke="${light}" stroke-width="1.5"/><g fill="${light}">${Array.from({length:36},(_,k)=>`<circle cx="${180+Math.sin(k*2.4+seed)*(38+k%3*5)}" cy="${60+k*2.6}" r="${.6+k%3*.3}" opacity=".8"/>`).join('')}</g></svg>`;
}
