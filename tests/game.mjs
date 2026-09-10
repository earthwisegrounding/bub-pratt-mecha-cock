import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

await fs.mkdir('.test-work',{recursive:true});
for(const name of ['game','rules']){
 let source=await fs.readFile(`lib/${name}.ts`,'utf8');
 source=source.replace("'./rules.ts'","'./rules.mjs'");
 await fs.writeFile(`.test-work/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
}
const {BremertonGame}=await import('../.test-work/game.mjs');
const {canOccupy,meleeHits,stepToward}=await import('../.test-work/rules.mjs');
// Keep all real meshes, skeletons and animation data; omit textures for this non-browser test.
async function loadModel(name){
 const data=await fs.readFile(`public/assets/${name}.glb`);
 const length=data.readUInt32LE(12),g=JSON.parse(data.subarray(20,20+length).toString());
 const binary=data.subarray(20+length+8);
 for(const mesh of g.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 delete g.images;delete g.textures;delete g.materials;
 const json=Buffer.from(JSON.stringify(g));const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
 const result=Buffer.alloc(12+8+padded.length+8+binary.length);
 result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);result.writeUInt32LE(binary.length,20+padded.length);result.writeUInt32LE(0x004e4942,24+padded.length);binary.copy(result,28+padded.length);
 const model=await new GLTFLoader().parseAsync(result.buffer.slice(result.byteOffset,result.byteOffset+result.byteLength),'');
 assert(model.animations.every(c=>c.duration>0&&c.tracks.every(t=>Array.from(t.values).every(Number.isFinite))),`${name} animation data`);
 return model;
}
const templates=await Promise.all(['marv','zombie','zombie2'].map(loadModel));
assert.deepEqual(templates[0].animations.map(c=>c.name).sort(),['walk','run','punch','kick','jump','death','hit','dance1','dance2','dance3'].sort());
for(const model of templates.slice(1))assert.deepEqual(model.animations.map(c=>c.name).sort(),['death','scream','stagger']);
function createGame(){
 const g=Object.create(BremertonGame.prototype);
 Object.assign(g,{scene:new T.Scene(),camera:new T.PerspectiveCamera(52,1,.1,500),mount:{clientWidth:1280,clientHeight:800},renderer:{setSize(){}},templates,mobile:true,active:false,paused:false,loaded:true,keys:new Set(),joystick:new T.Vector2(),running:false,yaw:Math.PI,pitch:.28,health:100,stamina:100,kills:0,lock:0,invulnerable:0,strike:0,strikeType:'',jumpVelocity:0,elevation:0,recoil:0,time:0,shake:0,wonAt:0,deadAt:0,message:'',messageUntil:0,titleDanceIndex:0,titleDanceTime:0,titleDances:['dance1','dance2','dance3'],animationElapsed:new Map(),colliders:[],zombies:[],particles:[],sound(){},burst(){},unlockAudio(){},hud(){},status(){}});
 g.marv=g.actor(templates[0],new T.Vector3(0,0,6),-1);g.play(g.marv,'dance1');g.spawn();return g;
}
const g=createGame();
assert.equal(g.zombies.length,24);
const sequence=[];
for(let i=0;i<5;i++){
 sequence.push(g.marv.current);
 const duration=g.marv.actions[g.marv.current].getClip().duration;
 for(let t=0;t<duration+.025;t+=.025)g.tickTitle(.025);
}
assert.deepEqual(sequence,['dance1','dance2','dance3','dance1','dance2']);
g.start();assert.equal(g.active,true);assert.equal(g.marv.current,'walk');assert.equal(!!g.camera.view?.enabled,false);
for(const name of g.titleDances)assert.equal(g.marv.actions[name].isRunning(),false);
const titleTime=g.titleDanceTime;g.tickTitle(2);assert.equal(g.titleDanceTime,titleTime);
// A kill never grants a dance, extra combat lock, or dance immunity.
g.marv.root.position.set(0,0,0);g.marv.root.rotation.y=0;
for(const z of g.zombies)z.root.position.set(70,0,70);
const victim=g.zombies[0];victim.root.position.set(0,0,1);victim.health=30;
g.attack('punch');assert.equal(g.stamina,87);assert.equal(g.lock,.72);g.hit();assert.equal(g.kills,1);assert(victim.dead);assert.equal(g.lock,.72);assert.equal(g.invulnerable,0);
g.strike=0;for(let i=0;i<30;i++)g.tick(.05);assert.equal(g.marv.current,'walk');assert.equal(g.lock,0);assert.equal(g.invulnerable,0);
// Victory, replay, title return, and a new start retain clean state.
for(const z of g.zombies){z.dead=true;}victim.dead=false;victim.health=1;victim.root.position.set(0,0,1);g.kills=23;g.hit();assert.equal(g.kills,24);
g.tick(.05);assert(!g.marv.current.startsWith('dance'));
g.restart();assert.equal(g.kills,0);assert.equal(g.health,100);assert(g.zombies.every(z=>!z.dead));assert.equal(g.marv.current,'walk');
g.title();assert.equal(g.active,false);assert.equal(g.marv.current,'dance1');g.tickTitle(.2);g.start();assert.equal(g.marv.current,'walk');assert.equal(g.kills,0);
// Keep Marv's supplied hit reaction and original damage/recovery timing.
const hurt=createGame();hurt.start();
for(const z of hurt.zombies)z.root.position.set(70,0,70);
const attacker=hurt.zombies[0];attacker.root.position.copy(hurt.marv.root.position).add(new T.Vector3(0,0,.9));attacker.root.rotation.y=Math.PI;hurt.play(attacker,'scream',true,1.4);attacker.timer=.9;attacker.hitDone=false;
hurt.tick(.05);assert.equal(hurt.health,87);assert.equal(hurt.marv.current,'hit');assert.equal(hurt.lock,.55);assert.equal(hurt.invulnerable,1.2);
// Holding Run at exhaustion must walk steadily while stamina recovers.
for(const touch of [false,true]){
 const tired=createGame();tired.start();tired.zombies=[];tired.stamina=.5;
 tired.keys.add('KeyW');if(touch)tired.setRun(true);else tired.keys.add('ShiftLeft');
 const before=tired.marv.root.position.clone();tired.tick(.05);
 assert.equal(tired.stamina,0);assert.equal(tired.runExhausted,true);assert.equal(tired.marv.current,'walk');
 assert(Math.abs(tired.marv.root.position.distanceTo(before)-2.8*.05)<1e-8);
 for(let frame=0;frame<33;frame++){tired.tick(.05);assert.equal(tired.marv.current,'walk');}
 assert(tired.stamina>=24);tired.tick(.05);tired.tick(.05);assert.equal(tired.marv.current,'run');
 // The same recovery applies if an attack or jump spends the last stamina.
 tired.stamina=0;tired.runExhausted=false;tired.tick(.05);assert.equal(tired.marv.current,'walk');assert(tired.runExhausted);
 tired.restart();assert.equal(tired.runExhausted,false);assert.equal(tired.stamina,100);
}
// Correct camera-relative movement at cardinal and rotated camera angles, for keys and stick.
g.zombies=[];
for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5,.71])for(const sign of [-1,1])for(const touch of [false,true]){
 g.yaw=yaw;g.marv.root.position.set(0,0,0);g.keys.clear();g.joystick.set(0,0);g.lock=0;
 if(touch)g.joystick.x=sign;else g.keys.add(sign>0?'KeyD':'KeyA');
 g.camera.position.set(Math.sin(yaw)*6.5,3.6,Math.cos(yaw)*6.5);g.camera.lookAt(0,1.25,0);g.camera.updateMatrixWorld();
 const before=g.marv.root.position.clone().project(g.camera);g.tick(.05);const after=g.marv.root.position.clone().project(g.camera);assert((after.x-before.x)*sign>0);
}
const walls=[{x:10,z:10,w:10,d:10}];assert(!canOccupy(10,10,.5,walls));assert(canOccupy(0,0,.5,walls));assert(!canOccupy(84,0,.5,[]));assert(meleeHits({x:0,z:0},{x:0,z:2},0,2.1));assert(!meleeHits({x:0,z:0},{x:0,z:-1},0,2.1));
const step=stepToward({x:4.4,z:10},{x:20,z:10},.1,walls,.5);assert(canOccupy(4.4+step.x,10+step.z,.5,walls));
// Project actual animated, skinned geometry into portrait and landscape title cameras.
const stage=createGame();stage.marv.root.rotation.y=.23;
for(const [w,h] of [[390,844],[375,667],[320,568],[844,390],[1280,800]]){
 stage.mount={clientWidth:w,clientHeight:h};stage.resize();
 const p=stage.marv.root.position;
 stage.camera.position.copy(p).add(new T.Vector3(1.2,1.9,w/h<.8?5.8:5.6));stage.camera.lookAt(p.clone().add(new T.Vector3(0,1,0)));stage.camera.updateMatrixWorld();
 let minX=1,maxX=-1,minY=1,maxY=-1;
 for(const name of stage.titleDances){stage.marv.mixer.stopAllAction();stage.marv.current='';stage.play(stage.marv,name);const duration=stage.marv.actions[name].getClip().duration;
  for(let frame=0;frame<8;frame++){
   stage.marv.mixer.setTime(duration*frame/8);stage.scene.updateMatrixWorld(true);
   stage.marv.root.traverse(o=>{if(!o.isSkinnedMesh)return;o.computeBoundingBox();const b=o.boundingBox;
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const q=new T.Vector3(x,y,z).applyMatrix4(o.matrixWorld).project(stage.camera);minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);}
   });
  }
 }
 assert(minX>-1&&maxX<1&&minY>-1&&maxY<1,`Title character fits ${w}x${h}: ${[minX,maxX,minY,maxY]}`);
 console.log(`Title framing ${w}x${h}: X ${minX.toFixed(2)}..${maxX.toFixed(2)}, Y ${minY.toFixed(2)}..${maxY.toFixed(2)}`);
}
console.log('PASS: 10 Marv clips; three title dances; no combat dances; damage, victory and replay; keyboard/touch direction; collisions; animated title framing.');

// Solid bodies block large steps, normal movement, and jumps; corpses do not.
const solid=createGame();solid.start();solid.marv.root.position.set(0,0,0);
for(const z of solid.zombies)z.root.position.set(70,0,70);
const blocker=solid.zombies[0];blocker.root.position.set(0,0,2);
solid.move(solid.marv.root,new T.Vector3(0,0,5));
assert(solid.marv.root.position.z<=1.100001);assert(solid.marv.root.position.z>1.05);
solid.marv.root.position.set(0,1,0);solid.elevation=1;
solid.move(solid.marv.root,new T.Vector3(0,0,5));assert(solid.marv.root.position.z<=1.100001);
solid.marv.root.position.set(0,0,0);solid.move(blocker.root,new T.Vector3(0,0,-5),.48);assert(blocker.root.position.z>=.899999);
blocker.dead=true;solid.move(solid.marv.root,new T.Vector3(0,0,5));assert(Math.abs(solid.marv.root.position.z-5)<1e-8);
// Damage uses contact at impact, facing, and jump height, not the old scream radius.
function contactCase(distance,yaw=Math.PI,elevation=0){
 const c=createGame();c.start();for(const z of c.zombies)z.root.position.set(70,0,70);
 const z=c.zombies[0];z.root.position.copy(c.marv.root.position).add(new T.Vector3(0,0,distance));z.root.rotation.y=yaw;
 c.elevation=elevation;c.marv.root.position.y=elevation;
 c.play(z,'scream',true,1.4);z.timer=.9;z.hitDone=false;c.tick(.05);return c;
}
assert.equal(contactCase(2.5).health,100);assert.equal(contactCase(1).health,100);
assert.equal(contactCase(.91).health,87);assert.equal(contactCase(.91,0).health,100);
assert.equal(contactCase(.91,Math.PI,1).health,100);
// Zombies close the former gap and reach contact without overlapping the player.
const chase=createGame();chase.start();for(const z of chase.zombies)z.root.position.set(70,0,70);
const chaser=chase.zombies[0];chaser.root.position.copy(chase.marv.root.position).add(new T.Vector3(0,0,2.4));
for(let i=0;i<80;i++)chase.tick(.05);
const gap=chaser.root.position.distanceTo(chase.marv.root.position);
assert(gap>=.899999&&gap<=.93);assert(chase.health<100);
// Healing waits five safe seconds, resets near threats, caps at 100, and cannot revive.
const recovery=createGame();recovery.start();recovery.health=50;
for(const z of recovery.zombies)z.root.position.set(70,0,70);
for(let i=0;i<100;i++)recovery.tick(.05);assert(Math.abs(recovery.health-50)<1e-8);
for(let i=0;i<20;i++)recovery.tick(.05);assert(Math.abs(recovery.health-55)<1e-8);assert(recovery.healing);
recovery.paused=true;recovery.tick(1);assert(Math.abs(recovery.health-55)<1e-8);recovery.paused=false;
recovery.zombies[0].root.position.copy(recovery.marv.root.position).add(new T.Vector3(0,0,5));recovery.tick(.05);assert.equal(recovery.safeTime,0);assert(!recovery.healing);
recovery.zombies[0].root.position.set(70,0,70);recovery.health=99;
for(let i=0;i<130;i++)recovery.tick(.05);assert.equal(recovery.health,100);
recovery.health=0;for(let i=0;i<130;i++)recovery.tick(.05);assert.equal(recovery.health,0);
recovery.restart();assert.equal(recovery.safeTime,0);assert.equal(recovery.healing,false);
console.log('PASS: solid bodies, contact/facing/jump damage checks, close pursuit, safe health recovery and reset.');
