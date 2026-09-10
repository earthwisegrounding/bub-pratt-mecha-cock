import * as T from 'three';
import {StreetLevel, type LevelData} from './bremerton.ts';
import {GLTFLoader, type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {canOccupy, meleeHits, stepToward, type Collider} from './rules.ts';
export type Hud={health:number;stamina:number;kills:number;total:number;district:string;message:string;dead:boolean;won:boolean;paused:boolean;healing:boolean};
type Actor={root:T.Group;visual:T.Object3D;mixer:T.AnimationMixer;actions:Record<string,T.AnimationAction>;current:string;health:number;timer:number;attackAt:number;hitDone:boolean;dead:boolean;home:T.Vector3;phase:number;district:number};
export class BremertonGame{
 level?:StreetLevel; routes=new Map<Actor,{points:T.Vector3[];until:number}>();
 renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.PerspectiveCamera(52,1,.1,500);clock=new T.Clock();mount:HTMLElement;raf=0;disposed=false;loaded=false;active=false;paused=false;muted=false;audio:AudioContext|null=null;
 colliders:Collider[]=[];zombies:Actor[]=[];marv!:Actor;world!:T.Object3D;keys=new Set<string>();joystick=new T.Vector2();running=false;runExhausted=false;yaw=Math.PI;pitch=.28;drag=false;pointerX=0;pointerY=0;health=100;safeTime=0;healing=false;stamina=100;kills=0;lock=0;invulnerable=0;strike=0;strikeType='';jumpVelocity=0;elevation=0;titleDanceIndex=0;titleDanceTime=0;readonly titleDances=['dance1','dance2','dance3'];mobile=matchMedia('(pointer:coarse)').matches;recoil=0;cameraPointer:number|null=null;animationElapsed=new Map<Actor,number>();message='';messageUntil=0;time=0;lastHud=0;shake=0;wonAt=0;deadAt=0;templates:GLTF[]=[];cleanup:(()=>void)[]=[];ring:T.Mesh;particles:{mesh:T.Mesh;v:T.Vector3;life:number}[]=[];
 constructor(mount:HTMLElement,private status:(s:string)=>void,private hud:(h:Hud)=>void){
  this.mount=mount;this.renderer=new T.WebGLRenderer({antialias:!this.mobile,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobile?1.25:1.7));this.renderer.setSize(mount.clientWidth,mount.clientHeight);this.renderer.shadowMap.enabled=!this.mobile;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;mount.appendChild(this.renderer.domElement);
  this.scene.background=new T.Color('#809999');this.scene.fog=new T.FogExp2('#809999',.006);
  this.scene.add(new T.HemisphereLight('#bed9dc','#304437',2.5));const sun=new T.DirectionalLight('#ffe5ad',3.1);sun.position.set(-35,55,25);sun.castShadow=!this.mobile;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.far=160;sun.shadow.normalBias=.035;this.scene.add(sun,sun.target);
  const fill=new T.DirectionalLight('#86c4d2',1.1);fill.position.set(90,20,-60);this.scene.add(fill);
  this.ring=new T.Mesh(new T.RingGeometry(.75,.84,40),new T.MeshBasicMaterial({color:'#e7c267',transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false}));this.ring.rotation.x=-Math.PI/2;this.scene.add(this.ring);
  this.camera.position.set(9,5,12);this.camera.lookAt(0,1,0);this.bind();this.resize();this.loop();
 }
 async load(){
  const loader=new GLTFLoader();let done=0;
  const data:LevelData=await fetch(new URL('assets/bremerton/level.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('Bremerton map unavailable');return r.json();});
  const paths=[...data.tiles.map(t=>'bremerton/'+t.id),'marv','zombie','zombie2'];
  const assets=await Promise.all(paths.map(async p=>{const a=await loader.loadAsync(new URL('assets/'+p+'.glb',document.baseURI).href);this.status(`${++done} / ${paths.length} assets ready`);return a;}));if(this.disposed){assets.forEach(a=>this.disposeObject(a.scene));return;}
  this.status('Finding safe routes through Bremerton…');await new Promise(resolve=>setTimeout(resolve,30));if(this.disposed){assets.forEach(a=>this.disposeObject(a.scene));return;}
  this.level=new StreetLevel(data,assets.slice(0,data.tiles.length));this.colliders=this.level.colliders;this.world=this.level.root;this.scene.add(this.world);this.templates=assets.slice(data.tiles.length);
  this.marv=this.actor(this.templates[0],this.level.start.clone(),-1);this.play(this.marv,this.titleDances[0]);
  this.spawn();this.loaded=true;this.camera.position.copy(this.level.start).add(new T.Vector3(1.2,1.9,5.6));this.status('Bremerton is ready.');this.emit();
 }

 actor(g:GLTF,pos:T.Vector3,district:number):Actor{
  const visual=clone(g.scene);const root=new T.Group();root.add(visual);root.position.copy(pos);const box=new T.Box3().setFromObject(visual);const height=box.max.y-box.min.y;visual.scale.setScalar(1.85/height);visual.position.y=-box.min.y*(1.85/height);
  visual.traverse(o=>{if((o as T.Mesh).isMesh){o.castShadow=!this.mobile;o.receiveShadow=true;const mesh=o as T.SkinnedMesh;if(mesh.isSkinnedMesh){mesh.computeBoundingSphere();mesh.boundingSphere!.radius*=2.5;}o.frustumCulled=true;}});this.scene.add(root);const mixer=new T.AnimationMixer(visual);const actions:Record<string,T.AnimationAction>={};g.animations.forEach(source=>{const c=source.clone();if(district===-1){const track=c.tracks.find(t=>t.name==='spine.position');const spine=visual.getObjectByName('spine');if(track&&spine)for(let i=0;i<track.values.length;i+=3){track.values[i]=spine.position.x;track.values[i+2]=spine.position.z;}}actions[c.name]=mixer.clipAction(c);});return {root,visual,mixer,actions,current:'',health:100,timer:0,attackAt:0,hitDone:false,dead:false,home:pos.clone(),phase:Math.random()*6.28,district};
 }
 spawn(){
  const points=[[-3,0],[-4,-9],[3,-18],[-4,-31],[0,28],[-11,36],[-28,36],[-35,28],[35,3],[36,15],[37,29],[45,36],[59,36],[72,25],[73,8],[65,0],[72,-18],[72,-33],[65,-36],[47,-36],[36,-48],[36,-63],[58,-72],[73,-60]];
  this.routes?.clear();
  this.zombies=(this.level?.spawns||points.map(([x,z])=>new T.Vector3(x,0,z))).map((p,i)=>{const a=this.actor(this.templates[1+i%2],p.clone(),Math.floor(i/6));this.play(a,'stagger');a.actions.stagger.time=Math.random()*4;a.mixer.update(0);return a;});
 }
 play(a:Actor,name:string,once=false,speed=1){
  if(a.current===name)return;const next=a.actions[name];if(!next)return;const prev=a.actions[a.current];next.reset().setEffectiveTimeScale(speed).setEffectiveWeight(1);next.paused=false;next.setLoop(once?T.LoopOnce:T.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.play();if(prev)next.crossFadeFrom(prev,.16,true);a.current=name;
 }
 start(){if(!this.loaded||this.active)return;this.restart();this.active=true;this.paused=false;this.keys.clear();this.releaseStick();this.marv.mixer.stopAllAction();this.marv.current='';this.play(this.marv,'walk');this.marv.actions.walk.paused=true;this.marv.actions.walk.time=0;this.marv.mixer.update(0);this.marv.root.rotation.y=0;this.resize();this.unlockAudio();this.announce('Clear the streets of downtown Bremerton.',5);this.emit();}
 restart(){this.zombies.forEach(z=>{this.scene.remove(z.root);z.mixer.stopAllAction();z.root.traverse(o=>{if((o as T.SkinnedMesh).isSkinnedMesh)(o as T.SkinnedMesh).skeleton.dispose();});});this.animationElapsed.clear();this.spawn();this.marv.root.position.copy(this.level?.start||new T.Vector3(0,0,6));this.marv.root.rotation.set(0,0,0);this.health=100;this.safeTime=0;this.healing=false;this.stamina=100;this.runExhausted=false;this.kills=0;this.wonAt=0;this.deadAt=0;this.lock=0;this.strike=0;this.elevation=0;this.jumpVelocity=0;this.invulnerable=0;this.recoil=0;this.paused=false;this.active=true;this.keys.clear();this.releaseStick();this.cameraPointer=null;this.drag=false;this.marv.mixer.stopAllAction();this.marv.current='';this.play(this.marv,'walk');this.marv.actions.walk.paused=true;this.marv.actions.walk.time=0;this.marv.mixer.update(0);this.announce('One man. Bare hands. Let’s go.',3);this.emit();}
 title(){if(!this.loaded)return;this.keys.clear();this.releaseStick();this.cameraPointer=null;this.drag=false;this.active=false;this.paused=false;this.recoil=0;this.shake=0;this.marv.root.position.copy(this.level?.start||new T.Vector3(0,0,6));this.marv.visual.rotation.z=0;this.titleDanceIndex=0;this.titleDanceTime=0;this.marv.mixer.stopAllAction();this.marv.current='';this.play(this.marv,this.titleDances[0]);this.resize();}
 pause(){if(!this.active||this.health<=0||this.kills===this.zombies.length)return;this.paused=!this.paused;this.keys.clear();this.releaseStick();this.cameraPointer=null;this.drag=false;this.emit();}
 setMuted(v:boolean){this.muted=v;}
 setRun(v:boolean){this.running=v;}
 stick(x:number,y:number,r:DOMRect){this.joystick.set((x-r.left-r.width/2)/(r.width*.4),-(y-r.top-r.height/2)/(r.height*.4));if(this.joystick.length()>1)this.joystick.normalize();}
 releaseStick(){this.joystick.set(0,0);this.running=false;}
 tickTitle(dt:number){if(this.active)return;this.titleDanceTime+=dt;const clip=this.marv.actions[this.titleDances[this.titleDanceIndex]].getClip();if(this.titleDanceTime>=clip.duration){this.titleDanceTime=0;this.titleDanceIndex=(this.titleDanceIndex+1)%this.titleDances.length;this.play(this.marv,this.titleDances[this.titleDanceIndex]);}this.marv.mixer.update(dt);}
 animateZombie(z:Actor,dt:number){if(z.dead&&z.timer>z.actions.death.getClip().duration+1)return;const elapsed=(this.animationElapsed.get(z)||0)+dt;const distance=z.root.position.distanceToSquared(this.marv.root.position);const interval=this.mobile?(distance>400?.1:distance>100?1/30:0):0;if(elapsed>=interval){z.mixer.update(elapsed);this.animationElapsed.set(z,0);}else this.animationElapsed.set(z,elapsed);}
 bind(){
  const on=(target:EventTarget,event:string,fn:any)=>{target.addEventListener(event,fn);this.cleanup.push(()=>target.removeEventListener(event,fn));};
  on(this.renderer.domElement,'webglcontextlost',(e:Event)=>{e.preventDefault();this.paused=true;this.keys.clear();this.releaseStick();this.status('Graphics were interrupted. Reload to continue.');this.emit();});
  on(window,'resize',()=>this.resize());on(window,'keydown',(e:KeyboardEvent)=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();this.keys.add(e.code);if(e.repeat)return;if(e.code==='KeyJ')this.attack('punch');if(e.code==='KeyK')this.attack('kick');if(e.code==='Space')this.jump();if(e.code==='Escape')this.pause();});on(window,'keyup',(e:KeyboardEvent)=>this.keys.delete(e.code));on(window,'blur',()=>{this.keys.clear();this.releaseStick();this.cameraPointer=null;this.drag=false;if(this.active&&!this.paused&&this.health>0&&this.kills<this.zombies.length){this.paused=true;this.emit();}});
  on(document,'visibilitychange',()=>{if(document.hidden&&this.active&&this.health>0&&this.kills<this.zombies.length){this.paused=true;this.keys.clear();this.releaseStick();this.cameraPointer=null;this.drag=false;this.emit();}});
  on(this.renderer.domElement,'pointerdown',(e:PointerEvent)=>{if(!this.active||this.paused||this.cameraPointer!==null)return;this.cameraPointer=e.pointerId;this.drag=true;this.pointerX=e.clientX;this.pointerY=e.clientY;this.renderer.domElement.setPointerCapture(e.pointerId);});
  on(this.renderer.domElement,'pointermove',(e:PointerEvent)=>{if(this.drag&&this.cameraPointer===e.pointerId){this.yaw-=(e.clientX-this.pointerX)*.006;this.pitch=T.MathUtils.clamp(this.pitch+(e.clientY-this.pointerY)*.003,.06,.7);this.pointerX=e.clientX;this.pointerY=e.clientY;}});
  const releaseCamera=(e:PointerEvent)=>{if(this.cameraPointer===e.pointerId){this.drag=false;this.cameraPointer=null;}};
  on(this.renderer.domElement,'pointerup',releaseCamera);on(this.renderer.domElement,'pointercancel',releaseCamera);on(this.renderer.domElement,'lostpointercapture',releaseCamera);on(this.renderer.domElement,'contextmenu',(e:Event)=>e.preventDefault());
 }
 attack(kind:string){if(!this.active||this.paused||this.health<=0||this.lock>0||this.elevation>.1||this.kills===this.zombies.length)return;const cost=kind==='kick'?24:13;if(this.stamina<cost){this.announce('Catch your breath.',1);return;}this.stamina-=cost;
  const nearby=this.zombies.filter(z=>!z.dead&&z.root.position.distanceTo(this.marv.root.position)<3.3).sort((a,b)=>a.root.position.distanceToSquared(this.marv.root.position)-b.root.position.distanceToSquared(this.marv.root.position))[0];if(nearby){const d=nearby.root.position.clone().sub(this.marv.root.position);this.marv.root.rotation.y=Math.atan2(d.x,d.z);}
  this.lock=kind==='kick'?.85:.72;this.strike=kind==='kick'?.38:.26;this.strikeType=kind;this.play(this.marv,kind,true,kind==='kick'?1.65:2.9);this.sound('swing');
 }
 jump(){if(!this.active||this.paused||this.health<=0||this.lock>0||this.elevation>0||this.stamina<12)return;this.stamina-=12;this.jumpVelocity=6;this.lock=.65;this.play(this.marv,'jump',true,1.1);this.sound('jump');}
 hit(){const p=this.marv.root.position;let count=0;for(const z of this.zombies){if(z.dead||(this.level&&!this.level.direct(p,z.root.position,.05))||!meleeHits(p,z.root.position,this.marv.root.rotation.y,this.strikeType==='kick'?2.5:2.1))continue;z.health-=this.strikeType==='kick'?62:38;count++;this.burst(z.root.position.clone().add(new T.Vector3(0,1.3,0)),'#d7bb72');this.move(z.root,z.root.position.clone().sub(p).normalize().multiplyScalar(this.strikeType==='kick'?.65:.22),.5);if(z.health<=0){z.dead=true;z.timer=0;this.play(z,'death',true);this.kills++;this.announce(['STAY DOWN.','NOT IN MY HOMETOWN.','BREMERTON BITES BACK.'][this.kills%3],2);this.sound('kill');} }
  if(count){this.shake=.15;this.sound('punch');}if(this.kills===this.zombies.length){this.wonAt=this.time;this.announce('BREMERTON IS OURS.',20);this.lock=0;}
 }
 // Substeps prevent sprinting or knockback from tunneling through a body.
 move(root:T.Object3D,delta:T.Vector3,r=.42){
  const p=root.position,steps=Math.max(1,Math.ceil(Math.hypot(delta.x,delta.z)/.025));
  const bodies=[this.marv,...this.zombies].filter(a=>a.root!==root&&!a.dead&&(a!==this.marv||this.health>0));
  const radius=root===this.marv.root ? .42 : .48;
  const clear=(x:number,z:number)=>(this.level?this.level.canMove(x,z,r,p.x,p.z):canOccupy(x,z,r,this.colliders))&&bodies.every(a=>{
   const q=a.root.position,limit=radius+(a===this.marv ? .42 : .48);
   const next=Math.hypot(x-q.x,z-q.z),current=Math.hypot(p.x-q.x,p.z-q.z);
   return next>=limit-1e-8||(current<limit&&next>current+1e-8);
  });
  for(let i=0;i<steps;i++){if(clear(p.x+delta.x/steps,p.z))p.x+=delta.x/steps;if(clear(p.x,p.z+delta.z/steps))p.z+=delta.z/steps;}
 }
 tick(dt:number){
  if(!this.active||this.paused)return;
  this.time+=dt;this.recoil=Math.max(0,this.recoil-dt);this.invulnerable=Math.max(0,this.invulnerable-dt);this.lock=Math.max(0,this.lock-dt);this.shake=Math.max(0,this.shake-dt);
  if(this.strike>0){this.strike-=dt;if(this.strike<=0&&this.health>0)this.hit();}
  if(this.health>0){let x=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.joystick.x;let y=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)+this.joystick.y;const moving=Math.hypot(x,y)>.12;// After exhaustion, recover a useful reserve before allowing another sprint.
   if(this.stamina<=0)this.runExhausted=true;
   else if(this.stamina>=25)this.runExhausted=false;
   let run=moving&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||this.running)&&!this.runExhausted&&this.lock<=0;
   this.stamina=T.MathUtils.clamp(this.stamina+(run?-19:15)*dt,0,100);
   if(run&&this.stamina===0){this.runExhausted=true;run=false;}
   if(moving&&this.lock<=0){const delta=new T.Vector3(-Math.sin(this.yaw)*y+Math.cos(this.yaw)*x,0,-Math.cos(this.yaw)*y-Math.sin(this.yaw)*x).normalize();this.move(this.marv.root,delta.multiplyScalar((run?6:2.8)*dt));this.marv.root.rotation.y=Math.atan2(delta.x,delta.z);if(this.elevation===0){this.play(this.marv,run?'run':'walk');this.marv.actions[this.marv.current].paused=false;}}
   else if(this.lock<=0&&this.elevation===0){this.play(this.marv,'walk');this.marv.actions.walk.paused=true;this.marv.actions.walk.time=0;}
   if(this.elevation>0||this.jumpVelocity>0){this.elevation=Math.max(0,this.elevation+this.jumpVelocity*dt);this.jumpVelocity-=16*dt;if(this.elevation===0)this.jumpVelocity=0;this.marv.root.position.y=(this.level?.height(this.marv.root.position.x,this.marv.root.position.z)||0)+this.elevation;}
  }
  if(this.level)this.marv.root.position.y=this.level.height(this.marv.root.position.x,this.marv.root.position.z)+this.elevation;
  this.marv.mixer.update(dt);
  for(const z of this.zombies){this.animateZombie(z,dt);if(z.dead){z.timer+=dt;continue;}if(this.health<=0)continue;z.timer=Math.max(0,z.timer-dt);const d=Math.hypot(z.root.position.x-this.marv.root.position.x,z.root.position.z-this.marv.root.position.z);
   if(z.current==='scream'&&z.timer>0){if(!z.hitDone&&z.timer<1.0){z.hitDone=true;this.burst(z.root.position.clone().add(new T.Vector3(0,1.6,0)),'#90b3a4');if(meleeHits(z.root.position,this.marv.root.position,z.root.rotation.y,.93)&&this.invulnerable===0&&this.elevation<.6&&(!this.level||this.level.direct(z.root.position,this.marv.root.position,.05))){this.health=Math.max(0,this.health-13);if(this.health<=0)this.deadAt=this.time;this.invulnerable=1.2;this.shake=.3;this.strike=0;if(this.health<=0)this.play(this.marv,'death',true);else{this.play(this.marv,'hit',true,3.5);}this.lock=this.health<=0?99:.55;this.sound('hurt');this.announce(this.health<=0?'Marv is down.':'CONTACT HIT · −13 GRIT',1.3);}}continue;}
   if(d<=.93&&z.timer<=0){z.root.rotation.y=Math.atan2(this.marv.root.position.x-z.root.position.x,this.marv.root.position.z-z.root.position.z);this.play(z,'scream',true,1.4);z.timer=2;z.hitDone=false;this.sound('scream');}
   else{this.play(z,'stagger');let target:T.Vector3;if(d<18){target=this.marv.root.position;}else{target=z.home.clone().add(new T.Vector3(Math.sin(this.time*.18+z.phase)*3,0,Math.cos(this.time*.13+z.phase)*3));}const delta=this.level?this.streetStep(z,target,dt*(d<18?.95:.38)):stepToward(z.root.position,target,dt*(d<18?.95:.38),this.colliders,.48);if(delta.x||delta.z){this.move(z.root,new T.Vector3(delta.x,0,delta.z),.48);z.root.rotation.y=Math.atan2(delta.x,delta.z)+Math.sin(this.time*2+z.phase)*.12;}
    for(const other of this.zombies){if(other===z||other.dead)continue;const sep=z.root.position.clone().sub(other.root.position);sep.y=0;const dist=sep.length();if(dist>.01&&dist<.85)this.move(z.root,sep.multiplyScalar((.85-dist)*dt*2/dist),.48);}}
  }
  if(this.level)for(const z of this.zombies)z.root.position.y=this.level.height(z.root.position.x,z.root.position.z);
  const threatened=this.zombies.some(z=>!z.dead&&Math.hypot(z.root.position.x-this.marv.root.position.x,z.root.position.z-this.marv.root.position.z)<=6);
  const previousSafeTime=this.safeTime;
  this.safeTime=threatened||this.health<=0?0:this.safeTime+dt;
  this.healing=this.health>0&&this.health<100&&this.safeTime>5;
  if(this.healing)this.health=Math.min(100,this.health+5*(Math.max(0,this.safeTime-5)-Math.max(0,previousSafeTime-5)));

 }
 loop=()=>{if(this.disposed)return;this.raf=requestAnimationFrame(this.loop);const dt=Math.min(this.clock.getDelta(),.05);if(document.hidden)return;if(this.loaded){if(this.active&&!this.paused)this.tick(dt);else if(!this.active){this.tickTitle(dt);}
   for(const z of this.zombies)z.root.visible=this.active;
   const p=this.marv.root.position;this.ring.position.set(p.x,p.y-this.elevation+.07,p.z);this.ring.visible=this.active&&this.health>0;
   let target:T.Vector3,look:T.Vector3;if(this.active){const distance=6.5;target=new T.Vector3(p.x+Math.sin(this.yaw)*distance,p.y+2.2+this.pitch*5,p.z+Math.cos(this.yaw)*distance);look=p.clone().add(new T.Vector3(0,1.25,0));
    // Pull camera in when its ground projection would enter a building.
    for(let t=.15;t<=1;t+=.05){const c=look.clone().lerp(target,t);if(this.level?!this.level.clear(c.x,c.z,.3):this.colliders.some(b=>Math.abs(c.x-b.x)<b.w/2+.3&&Math.abs(c.z-b.z)<b.d/2+.3)){target=look.clone().lerp(target,Math.max(.15,t-.1));target.y=Math.max(target.y,p.y+2.4);break;}}
   }else{const portrait=this.camera.aspect<.8;target=p.clone().add(new T.Vector3(1.2,1.9,portrait?5.8:5.6));look=p.clone().add(new T.Vector3(0,1,0));this.marv.root.rotation.y=.23;}
   this.camera.position.lerp(target,1-Math.exp(-dt*7));if(this.shake>0)this.camera.position.add(new T.Vector3((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake,0));this.camera.lookAt(look);this.marv.visual.rotation.z=this.recoil>0?Math.sin(this.recoil*24)*this.recoil*.22:0;
   for(let i=this.particles.length-1;i>=0;i--){const e=this.particles[i];if(!this.paused){e.life-=dt;e.mesh.position.addScaledVector(e.v,dt);e.v.y-=5*dt;(e.mesh.material as T.MeshBasicMaterial).opacity=Math.max(0,e.life*2);}if(e.life<=0){this.scene.remove(e.mesh);e.mesh.geometry.dispose();(e.mesh.material as T.Material).dispose();this.particles.splice(i,1);}}
   if(this.time-this.lastHud>.1){this.emit();this.drawMap();this.lastHud=this.time;}
  }this.renderer.render(this.scene,this.camera);
 }
 emit(){const p=this.marv?.root.position;this.hud({health:this.health,stamina:this.stamina,kills:this.kills,total:this.zombies.length||24,district:this.level?(p&&p.x<-120?(p.z<-214?'Northwest Bremerton':'West Downtown'):(p&&p.z<-214?'North Downtown':'Downtown')):p&&p.x>45?(p.z>0?'Ferry Terminal':'Harborside'):'Downtown',message:this.time<this.messageUntil?this.message:'',dead:this.health<=0&&this.time-this.deadAt>2.9,won:this.kills>0&&this.kills===this.zombies.length&&this.time-this.wonAt>4,paused:this.paused,healing:this.healing});}
 announce(s:string,seconds:number){this.message=s;this.messageUntil=this.time+seconds;}
 streetStep(actor:Actor,target:T.Vector3,step:number){
  const level=this.level!,p=actor.root.position;let destination=target;
  if(!level.direct(p,target)){let route=this.routes.get(actor);if(!route||this.time>route.until){route={points:level.path(p,target),until:this.time+1.5};this.routes.set(actor,route);}while(route.points.length&&Math.hypot(route.points[0].x-p.x,route.points[0].z-p.z)<.35)route.points.shift();if(!route.points.length)return {x:0,z:0};destination=route.points[0];}
  const dx=destination.x-p.x,dz=destination.z-p.z,d=Math.hypot(dx,dz);return d<.01?{x:0,z:0}:{x:dx/d*Math.min(step,d),z:dz/d*Math.min(step,d)};
 }
 drawMap(){const c=document.querySelector<HTMLCanvasElement>('#minimap');if(!c)return;const g=c.getContext('2d');if(!g)return;const bounds=this.level?.bounds||[-100,-100,100,100],scale=184/Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);const x=(v:number)=>100+(v-(bounds[0]+bounds[2])/2)*scale,z=(v:number)=>100+(v-(bounds[1]+bounds[3])/2)*scale;
  g.clearRect(0,0,200,200);g.fillStyle='#14272a';g.fillRect(0,0,200,200);g.fillStyle='#3a5250';if(this.level){for(const p of this.level.polygons){g.beginPath();p.points.forEach(([px,pz],i)=>i?g.lineTo(x(px),z(pz)):g.moveTo(x(px),z(pz)));g.closePath();g.fill();}}else for(const b of this.colliders)g.fillRect(x(b.x-b.w/2),z(b.z-b.d/2),b.w*scale,b.d*scale);
  for(const enemy of this.zombies){if(enemy.dead)continue;g.fillStyle=enemy.current==='scream'?'#ffb85f':'#e0826b';g.beginPath();g.arc(x(enemy.root.position.x),z(enemy.root.position.z),2.5,0,7);g.fill();}g.save();g.translate(x(this.marv.root.position.x),z(this.marv.root.position.z));g.rotate(-this.marv.root.rotation.y);g.fillStyle='#f3d173';g.beginPath();g.moveTo(0,5);g.lineTo(-3,-3);g.lineTo(3,-3);g.fill();g.restore();g.fillStyle='#dae0c8';g.font='11px monospace';g.fillText('N',7,14);
 }

 burst(p:T.Vector3,color:string){for(let i=0;i<9;i++){const mesh=new T.Mesh(new T.BoxGeometry(.055,.055,.055),new T.MeshBasicMaterial({color,transparent:true}));mesh.position.copy(p);this.scene.add(mesh);this.particles.push({mesh,v:new T.Vector3((Math.random()-.5)*4,Math.random()*3,(Math.random()-.5)*4),life:.4+Math.random()*.25});}}
 unlockAudio(){try{this.audio??=new AudioContext();void this.audio.resume();}catch{}}
 sound(kind:string){if(this.muted||!this.audio)return;const a=this.audio;const osc=a.createOscillator(),gain=a.createGain();const values:Record<string,number[]>={punch:[100,35,.12,.18],swing:[220,70,.09,.025],kill:[160,55,.3,.1],hurt:[70,25,.22,.12],jump:[150,260,.12,.035],scream:[230,75,.7,.025]};const [f,to,duration,vol]=values[kind]||values.punch;osc.type=kind==='scream'?'sawtooth':'triangle';osc.frequency.setValueAtTime(f,a.currentTime);osc.frequency.exponentialRampToValueAtTime(to,a.currentTime+duration);gain.gain.setValueAtTime(vol,a.currentTime);gain.gain.exponentialRampToValueAtTime(.001,a.currentTime+duration);osc.connect(gain);gain.connect(a.destination);osc.start();osc.stop(a.currentTime+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
 resize(){const w=this.mount.clientWidth,h=this.mount.clientHeight;this.camera.aspect=w/h;this.camera.clearViewOffset();if(!this.active){if(w/h<.8)this.camera.setViewOffset(w,h,0,h*.20,w,h);else this.camera.setViewOffset(w,h,-w*.23,0,w,h);}this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
 disposeObject(root:T.Object3D){root.traverse(o=>{if((o as T.Mesh).isMesh){const m=o as T.Mesh;m.geometry.dispose();for(const material of Array.isArray(m.material)?m.material:[m.material]){for(const v of Object.values(material))if(v instanceof T.Texture)v.dispose();material.dispose();}}});}
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.cleanup.forEach(f=>f());this.disposeObject(this.scene);this.renderer.dispose();this.renderer.domElement.remove();void this.audio?.close();}
}
