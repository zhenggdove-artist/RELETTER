const collections=[
 ['pajamas',['Candy Stripe','Moon Stars','Cloud Nap','Teddy Dreams','Midnight Constellation'],['#cda9ba','#9badd3','#b3ced5','#ccb599','#a79abe'],'hp',1,'defense',.025],
 ['silk',['Cherry Picnic','Garden Silk','Mint Tartan','Rainbow Slumber','Koi Dreams'],['#d5a8a9','#b5c7a3','#97beb5','#c3aed3','#c2a580'],'jump',.035,'hp',1],
 ['fuzzy',['Marshmallow Feet','Alpaca Hug','Lynx Paws','Yeti Snow','Aurora Fur'],['#c5b6a7','#cdb8a0','#b7a98c','#c1d2d7','#aea2cf'],'defense',.035,'hp',1],
 ['pig',['Peach Piglet','Bubble Pig','Truffle Pig','Royal Pig','Dream Boar'],['#d3a3a7','#c4a0b8','#ad9290','#d5b1a0','#c3a0c6'],'hp',2,'attack',.025],
 ['angel',['Little Cherub','Dawn Wings','Moon Seraph','Solar Angel','Celestial Choir'],['#e0d6bc','#dcc3b1','#b8c6d8','#dfc88f','#d4c2df'],'jump',.055,'defense',.025],
 ['centaur',['Moss Visitor','Lunar Centaur','Coral Voyager','Nebula Runner','Astral Stallion'],['#a2c5ac','#a8bfd0','#d1adbb','#b1a0d0','#c7b68c'],'speed',.045,'hp',1],
 ['dinosaur',['Fern Raptor','Peach Triceratops','Lake Stegosaur','Amber Dragon','Violet Tyrant'],['#a3bd91','#d0b095','#8fb5bd','#c4ab77','#ad94bd'],'attack',.045,'defense',.02],
 ['skater',['Sidewalk Kid','Mint Kickflip','Sunset Street','Neon Halfpipe','Starlight Pro'],['#b3a698','#94b6ab','#c99599','#9c9fc7','#b9a9d3'],'speed',.035,'jump',.035],
 ['witch',['Herbal Apprentice','Rose Spell','Tidal Oracle','Golden Coven','Dream Sorcerer'],['#a9b39a','#c4a0af','#99b9c7','#c3b286','#b19dc8'],'attack',.035,'hp',1],
 ['astronaut',['Milk Rocket','Sea Explorer','Mars Walker','Golden Orbit','Void Pioneer'],['#d5d1c7','#a3bacb','#c7a49a','#c9b688','#aca6c5'],'defense',.04,'speed',.02]
];
export const OUTFITS=collections.flatMap(([design,names,colors,key,gain,second,secondary])=>names.map((name,i)=>{const tier=i+1,bonuses={[key]:+(gain*tier).toFixed(3),[second]:+(secondary*tier).toFixed(3)};return {id:`outfit-${design}-${tier}`,name,slot:'outfit',family:'outfit',design,pattern:i,tier,color:colors[i],price:[20,45,90,160,260][i],bonuses,description:Object.entries(bonuses).map(([k,v])=>`${k==='hp'?'+'+v:'+'+Math.round(v*100)+'%'} ${k==='hp'?'max HP':k==='defense'?'damage reduction':k==='speed'?'movement speed':k==='jump'?'jump height':'attack'}`).join(' · ')};}));
