import * as THREE from 'three';

const mat = (color: THREE.ColorRepresentation, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness });
const grass = mat('#879f69'), rock = mat('#887d70'), wood = mat('#755340'), darkWood = mat('#553e32'), cream = mat('#e9dec1'), roof = mat('#9a5c47');
const leafMats = [mat('#627d58'), mat('#718e60'), mat('#849b68'), mat('#526f57')];
const stoneMats = [mat('#b5a897'), mat('#a59b87'), mat('#c2b6a2')];
const box = (w:number,h:number,d:number,m:THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
const cylinder = (rt:number,rb:number,h:number,m:THREE.Material,n=9) => new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,n),m);
function add(parent:THREE.Object3D, mesh:THREE.Object3D, x=0,y=0,z=0) { mesh.position.set(x,y,z); parent.add(mesh); return mesh; }
function shadow(obj:THREE.Object3D) { obj.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow=true; (o as THREE.Mesh).receiveShadow=true; } }); }
function disk(radius:number, y:number, m:THREE.Material, segments=64) { const shape = new THREE.Shape(); for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2; const r=radius*(1+0.035*Math.sin(a*5)+0.025*Math.cos(a*9)); const x=Math.cos(a)*r,z=-Math.sin(a)*r; if(i===0) shape.moveTo(x,z); else shape.lineTo(x,z); } shape.closePath(); const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),m); mesh.rotation.x=-Math.PI/2; mesh.position.y=y; return mesh; }
function island() {
 const group=new THREE.Group(), n=64; const positions:number[]=[]; const colors:number[]=[]; const indices:number[]=[];
 const rings=[{y:.02,r:4.9},{y:-.35,r:4.92},{y:-1.05,r:4.5},{y:-1.8,r:3.65},{y:-2.45,r:2.35},{y:-2.8,r:.45}];
 rings.forEach((ring,j)=>{for(let i=0;i<n;i++){const a=i/n*Math.PI*2; const noise=1+.035*Math.sin(a*5)+.025*Math.cos(a*9); const wobble=j===0?1:1+.045*Math.sin(a*7+j*2)+.025*Math.cos(a*13-j); positions.push(Math.cos(a)*ring.r*noise*wobble,j===0?.055:ring.y+.08*Math.sin(a*6+j),Math.sin(a)*ring.r*noise*wobble); const c=new THREE.Color(j===0?'#98a779':j===1?'#8c806f':j===2?'#938676':j===3?'#82786c':'#716b62'); c.multiplyScalar(.93+.09*Math.sin(a*7+j)); colors.push(c.r,c.g,c.b); }});
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=(j+1)*n+i,d=(j+1)*n+(i+1)%n; indices.push(a,b,c,b,d,c);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals(); const body=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));group.add(body);group.add(disk(4.9,.056,grass)); shadow(group); return group;
}
function tree(x:number,z:number,s:number,type:number) {
 const g=new THREE.Group();g.position.set(x,.06,z);g.scale.setScalar(s); const trunk=cylinder(.12,.19,1.35,wood,7);add(g,trunk,0,.67,0); const crown=new THREE.Group();add(g,crown,0,1.05,0);
 if(type===0){for(let i=0;i<3;i++){const cone=new THREE.Mesh(new THREE.ConeGeometry(.85-i*.13,1.25,7),leafMats[(i+1)%4]);add(crown,cone,0,.35+i*.52,0);}}
 else {const balls:[[number,number,number,number],[number,number,number,number],[number,number,number,number],[number,number,number,number]]=[[0,1,0,.85],[-.48,.78,.03,.56],[.45,.9,.08,.58],[.02,1.48,0,.57]]; balls.forEach(([x,y,z,r],i)=>{const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),leafMats[(i+type)%4]); add(crown,mesh,x,y,z);});}
 shadow(g);return {group:g,crown,phase:x+z};
}
function house() {
 const g=new THREE.Group();g.position.set(.45,.06,-.85); const walls=box(2.25,1.8,1.8,cream); add(g,walls,0,.9,0);
 // A triangular gable gives the roof a proper silhouette on both ends.
 const shape=new THREE.Shape();shape.moveTo(-1.125,0);shape.lineTo(1.125,0);shape.lineTo(0,.95);shape.closePath(); const gable=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:1.8,bevelEnabled:false}),cream);add(g,gable,0,1.8,-.9);
 const left=box(1.52,.14,2.15,roof);left.rotation.z=.70;add(g,left,-.57,2.27,0); const right=box(1.52,.14,2.15,roof);right.rotation.z=-.70;add(g,right,.57,2.27,0);
 for(let i=0;i<6;i++){const strip=box(.035,.035,2.13,mat('#b8795e'));strip.rotation.z=i<3?.70:-.70;const side=i<3?-1:1;const offset=(i%3)*.33+.18;add(g,strip,side*offset,2.72-offset*.84,0);}
 const chimney=box(.34,.8,.38,mat('#b69d84'));add(g,chimney,-.58,2.55,-.42);add(g,box(.44,.12,.47,mat('#897465')),-.58,2.95,-.42);
 // Front door and timber trim.
 add(g,box(.68,1.14,.08,darkWood),0,.57,.94);add(g,box(.54,1.02,.035,wood),0,.55,.99);add(g,new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),mat('#d6b979')),.19,.55,1.02);
 add(g,box(2.3,.1,.1,wood),0,.12,.95); add(g,box(.1,1.8,.1,wood),-1.09,.9,.95);add(g,box(.1,1.8,.1,wood),1.09,.9,.95);
 const windowMat=new THREE.MeshStandardMaterial({color:'#748c83',emissive:'#ffb65a',emissiveIntensity:0,roughness:.6});
 function window(x:number,y:number,z:number,rot=0){const frame=new THREE.Group();frame.rotation.y=rot;add(frame,box(.58,.63,.08,darkWood));add(frame,box(.46,.51,.04,windowMat),0,0,.05);add(frame,box(.035,.52,.05,cream),0,0,.08);add(frame,box(.47,.035,.05,cream),0,0,.08);add(frame,box(.69,.08,.17,wood),0,-.35,.04);add(g,frame,x,y,z);}
 window(-.76,1.08,.94);window(.76,1.08,.94);window(1.14,1.1,-.1,Math.PI/2);
 const light=new THREE.PointLight('#ffbd70',0,4,2);add(g,light,0,1,1.3);shadow(g);return {group:g,windowMat,light};
}
function windmill(){const g=new THREE.Group();g.position.set(2.7,.06,.35);const tower=cylinder(.38,.66,2.35,cream,8);add(g,tower,0,1.17,0); const cap=new THREE.Mesh(new THREE.ConeGeometry(.58,.62,8),roof);add(g,cap,0,2.63,0);add(g,box(.43,.75,.05,darkWood),0,.38,.62); const rotor=new THREE.Group();add(g,rotor,0,1.9,.48);add(rotor,new THREE.Mesh(new THREE.SphereGeometry(.14,12,8),darkWood)); for(let i=0;i<4;i++){const blade=new THREE.Group();blade.rotation.z=i*Math.PI/2;add(rotor,blade);add(blade,box(.09,1.13,.07,darkWood),0,.62,0); const sail=box(.34,.74,.045,mat('#e8dabb'));add(blade,sail,.14,.79,.025); for(let k=0;k<3;k++)add(blade,box(.32,.025,.03,wood),.14,.54+k*.24,.06);} shadow(g);return {group:g,rotor};}
function cloud(x:number,y:number,z:number,s:number){const g=new THREE.Group(); const cm=new THREE.MeshStandardMaterial({color:'#f3eee0',roughness:1}); [[-.65,0,0,.53],[0,.16,0,.7],[.68,0,0,.47],[.15,-.12,.1,.52]].forEach(([x,y,z,r])=>{const p=new THREE.Mesh(new THREE.IcosahedronGeometry(r,2),cm);p.scale.y=.65;add(g,p,x,y,z);});g.position.set(x,y,z);g.scale.setScalar(s);return {group:g,material:cm,baseX:x,phase:z};}
export function createWorld(scene:THREE.Scene){
 const root=new THREE.Group();scene.add(root);root.add(island());
 // Pond: layered irregular shoreline and translucent water surface.
 const shore=disk(1.22,.075,mat('#c9c1a5'));shore.scale.set(1.2,1,.83);shore.position.set(-2.25,.075,1.05);root.add(shore);
 const waterMat=new THREE.MeshStandardMaterial({color:'#79aab0',roughness:.25,metalness:.08});const water=disk(1.08,.09,waterMat);water.scale.set(1.2,1,.83);water.position.set(-2.25,.09,1.05);root.add(water);
 const houseObj=house();root.add(houseObj.group);const mill=windmill();root.add(mill.group);
 const trees=[tree(-3.35,-1.2,.85,0),tree(-2.45,-2.85,1.03,1),tree(-.5,-3.4,.8,0),tree(1.65,-3.05,.85,1),tree(3.65,-1.8,.7,0),tree(-4,.8,.58,1)];trees.forEach(t=>root.add(t.group));
 // Stepping stones lead from the door towards the near edge.
 for(let i=0;i<7;i++){const p=new THREE.Mesh(new THREE.CylinderGeometry(.19+(i%2)*.04,.21,.045,7),stoneMats[i%3]);p.position.set(.4+Math.sin(i*.8)*.22,.095,.35+i*.43);p.scale.z=.7;root.add(p);}
 // Small fence, arranged along the right edge.
 for(let i=0;i<5;i++){const p=cylinder(.045,.05,.55,wood,6);add(root,p,1.5+i*.43,.33,3.05);}for(const y of [.27,.49])add(root,box(1.85,.055,.055,wood),2.36,y,3.05);
 const flowerColors=['#efcf9e','#f2e7d4','#d99b83']; for(let i=0;i<28;i++){const a=i*2.399;const r=2.8+(i%4)*.34;const x=Math.cos(a)*r,z=-Math.sin(a)*r;if((x>1.4&&z>-.8&&z<1.6)||(x<-.8&&z>0&&z<2.3))continue;const stem=cylinder(.014,.014,.18,leafMats[0],5);add(root,stem,x,.16,z);const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.06,0),mat(flowerColors[i%3]));add(root,f,x,.26,z);}
 [[-3.7,2.0,.24],[3.6,1.8,.25],[-1.3,3.7,.2],[2.5,-2.4,.2],[-3.8,-2.5,.22]].forEach(([x,z,s],i)=>{const p=new THREE.Mesh(new THREE.IcosahedronGeometry(s,0),stoneMats[i%3]);p.scale.set(1.3,.7,1);add(root,p,x,.15,z);});
 const clouds=[cloud(-4.2,4,-2.7,.8),cloud(3.2,4.3,-3.8,.65),cloud(4.7,3.6,1.5,.55)];clouds.forEach(c=>root.add(c.group));
 const ripples:THREE.Mesh[]=[];for(let i=0;i<5;i++){const m=new THREE.Mesh(new THREE.RingGeometry(.18,.2,32),new THREE.MeshBasicMaterial({color:'#deefdf',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(-2.25+Math.sin(i*4)*.75,.11,1.05+Math.cos(i*4)*.5);root.add(m);ripples.push(m);}
 return {root,house:houseObj,mill,trees,clouds,ripples,waterMat};
}
