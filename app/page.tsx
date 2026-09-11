import {useEffect, useRef, useState, type PointerEvent} from 'react';
import type {HiloGame, Hud} from '../lib/game';
import {registerGameTools} from '../lib/game-tools';
import {Soundtrack, type MusicStatus} from '../lib/music';

const initialHud:Hud={health:100,stamina:100,kills:0,total:1,district:'Downtown',message:'',dead:false,won:false,paused:false,healing:false,bossHealth:700,bossMax:700};
export default function Home(){
 const mount=useRef<HTMLDivElement>(null);
 const game=useRef<HiloGame|null>(null);
 const music=useRef<Soundtrack|null>(null);
 const mutePreference=useRef(false);
 const [musicStatus,setMusicStatus]=useState<MusicStatus>('loading');
 const stickPointer=useRef<number|null>(null);
 const [status,setStatus]=useState('Preparing Hilo…');
 const [ready,setReady]=useState(false);
 const [playing,setPlaying]=useState(false);
 const [hud,setHud]=useState(initialHud);
 const [muted,setMuted]=useState(false);
 const [error,setError]=useState(false);
 const [stick,setStick]=useState({x:0,y:0});
 const [running,setRunning]=useState(false);
 const start=()=>{if(!game.current?.loaded)return;game.current.start();setPlaying(true);};
 const title=()=>{game.current?.title();setPlaying(false);setRunning(false);setStick({x:0,y:0});};
 useEffect(()=>{
  const track=new Soundtrack(new URL('music/bub-pratt-stand-tall.mp3',document.baseURI).href,setMusicStatus);music.current=track;
  return()=>{track.dispose();music.current=null;};
 },[]);
 useEffect(()=>{
  let disposed=false;let removeTools=()=>{};
  import('../lib/game').then(async({HiloGame})=>{
   if(disposed)return;
   try{
    const g=new HiloGame(mount.current!,s=>{if(!disposed){setStatus(s);if(s.startsWith('Graphics'))setError(true);}},h=>{if(!disposed)setHud(h);});
    game.current=g;g.setMuted(mutePreference.current);
    await g.load();
    if(!disposed){setReady(true);setStatus('The waterfront is ready.');removeTools=registerGameTools(g,setPlaying);}
   }catch(e){if(!disposed){setError(true);setStatus('The game could not load. Check your connection and try again.');}console.error(e);}
  }).catch(e=>{if(!disposed){setError(true);setStatus('This game needs a browser with WebGL 2 support.');}console.error(e);});
  return()=>{disposed=true;removeTools();game.current?.dispose();};
 },[]);
 useEffect(()=>{if(hud.paused||hud.dead||hud.won){setRunning(false);setStick({x:0,y:0});stickPointer.current=null;}},[hud.paused,hud.dead,hud.won]);
 const updateStick=(e:PointerEvent<HTMLDivElement>)=>{
  const g=game.current;if(!g)return;
  g.stick(e.clientX,e.clientY,e.currentTarget.getBoundingClientRect());
  setStick({x:g.joystick.x*32,y:-g.joystick.y*32});
 };
 const releaseStick=(e:PointerEvent<HTMLDivElement>)=>{
  if(stickPointer.current!==e.pointerId)return;
  stickPointer.current=null;game.current?.releaseStick();setStick({x:0,y:0});setRunning(false);
 };
 const releaseRun=()=>{game.current?.setRun(false);setRunning(false);};
 const overlay=hud.dead||hud.won||hud.paused;
 return <main className={`game-shell ${playing?'is-playing':'is-title'}`}>
  <div className="viewport" ref={mount} aria-label="3D Hilo waterfront"/><div className="vignette"/>
  <header className="topline">
   <div className="wordmark">BP<span>LAST MAN<br/>IN HILO</span></div>
   <div className="coordinates">HILO, HAWAI‘I <span>BAYFRONT · HAWAI‘I ISLAND</span></div>
   <button className="small-button sound-button" data-sound-toggle onClick={()=>{const next=!muted&&musicStatus==='playing';mutePreference.current=next;setMuted(next);game.current?.setMuted(next);music.current?.setMuted(next);}} aria-label={muted?'Enable music and sound':musicStatus==='playing'?'Mute music and sound':'Play music'}>{muted?'SOUND OFF':musicStatus==='playing'?'SOUND ON':'PLAY MUSIC'}</button>
   {playing&&<button className="small-button" onClick={()=>game.current?.pause()} aria-label={hud.paused?'Resume game':'Pause game'}>Ⅱ</button>}
  </header>
  {!playing?<section className="start-panel">
   <div className="eyebrow">BIG ISLAND · BIGGER TROUBLE</div>
   <h1>BUB<br/>PRATT<span>MECHA COCK RAMPAGE</span></h1>
   <p>Stand tall. Hit hard. Save Hilo.</p>
   <div className="intro">A giant killer mecha cock is tearing up Hilo.<br/>Bub steps out of Kukuau Studio to ruffle some steel feathers.</div>
   <button className="start-button" disabled={!ready||error} onClick={start}>{ready?'TAKE BACK HILO':'LOADING THE WATERFRONT…'}<span aria-hidden="true">↗</span></button>
   <div className="healing-help">Two solid kicks knock the cock down. Get 6 meters clear for 5 seconds to heal.</div>
   <div className="loading-status" role="status">{status}</div>
   <div className="controls-brief"><span><kbd>W A S D</kbd> MOVE</span><span><kbd>J</kbd> PUNCH</span><span><kbd>K</kbd> KICK</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>SHIFT</kbd> RUN</span><span><kbd>DRAG</kbd> LOOK</span></div>
   <div className="mobile-help">Left thumb to move. Drag the view to look.<br/>Hold RUN while moving. Landscape gives you more room.</div>
  </section>:<>
   <aside className="vitals"><div className="label-row"><b>BUB PRATT</b><span>{Math.ceil(hud.health)} / 100</span></div><div className="health-track" role="meter" aria-label="Health" aria-valuenow={hud.health} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${hud.health}%`}}/></div><div className="stamina-track" role="meter" aria-label="Stamina" aria-valuenow={Math.round(hud.stamina)} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${hud.stamina}%`}}/></div><span className="secondary-label recovery-label">{hud.healing?'HEALING · +5 GRIT / SEC':hud.health<100?'GET CLEAR · 5 SEC TO HEAL':'GRIT / STAMINA'}</span></aside>
   <aside className="mission"><div className="eyebrow">IRONCLAW · MECHA COCK</div><strong>{Math.ceil(hud.bossHealth)}<span> / {hud.bossMax}</span></strong><div className="boss-track" role="meter" aria-label="Ironclaw armor" aria-valuenow={hud.bossHealth} aria-valuemin={0} aria-valuemax={hud.bossMax}><div style={{width:`${hud.bossHealth/hud.bossMax*100}%`}}/></div><p>{hud.bossHealth<=0?'SCRAPPED':hud.bossHealth<350?'OVERDRIVE':'ARMOR'}</p><div className="district">⌖ {hud.district}</div></aside>
   <div className="toast" role="status">{hud.message}</div><div className="reticle" aria-hidden="true">·</div>
   <div className="desktop-help">WASD move <b>·</b> Shift run <b>·</b> J punch <b>·</b> K kick <b>·</b> Space jump <b>·</b> Drag look <b>·</b> Esc pause</div>
   <canvas id="minimap" className="minimap" width="200" height="200" aria-label="Map showing Bub, buildings, and Ironclaw"/>
   <div className="touch-controls" inert={overlay}>
    <div className="joystick" aria-label="Movement joystick" onPointerDown={e=>{if(stickPointer.current!==null)return;e.preventDefault();stickPointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);updateStick(e);}} onPointerMove={e=>{if(stickPointer.current===e.pointerId)updateStick(e);}} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}><span className="stick-knob" style={{transform:`translate(${stick.x}px,${stick.y}px)`}}>MOVE</span></div>
    <div className="action-pad">
     {(['punch','kick','jump'] as const).map(action=><button key={action} onPointerDown={e=>{e.preventDefault();action==='jump'?game.current?.jump():game.current?.attack(action);}} onClick={e=>{if(e.detail===0){action==='jump'?game.current?.jump():game.current?.attack(action);}}}>{action.toUpperCase()}</button>)}
     <button className={running?'is-held':''} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);game.current?.setRun(true);setRunning(true);}} onPointerUp={releaseRun} onPointerCancel={releaseRun} onLostPointerCapture={releaseRun} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){game.current?.setRun(true);setRunning(true);}}} onKeyUp={releaseRun} onBlur={releaseRun}>RUN</button>
    </div>
   </div>
   {overlay&&<section className="pause-screen" role="dialog" aria-modal="true" aria-labelledby="pause-heading">
    <div className="eyebrow">{hud.dead?'HILO STILL NEEDS YOU':hud.won?'ONE BUB. ONE BIRD. SCRAP METAL.':'TAKE A BREATH'}</div>
    <h2 id="pause-heading">{hud.dead?'DOWN, NOT DONE.':hud.won?'HILO STANDS TALL.':'PAUSED'}</h2>
    <p>{hud.dead?'Ironclaw is still standing. Take another shot.':hud.won?'Ironclaw is scrap. Hilo can breathe again.':'Your hometown can wait a moment.'}</p>
    <button className="start-button" onClick={()=>hud.paused&&!hud.dead&&!hud.won?game.current?.pause():game.current?.restart()}>{hud.paused&&!hud.dead&&!hud.won?'BACK TO HILO':'PLAY AGAIN'}<span aria-hidden="true">↗</span></button>
    <button className="title-button" onClick={title}>TITLE SCREEN</button>
   </section>}
  </>}
  {error&&<section className="pause-screen" role="alert"><h2>LET’S TRY THAT AGAIN.</h2><p>{status}</p><button className="start-button" onClick={()=>location.reload()}>RELOAD GAME</button></section>}
  <footer className="bottomline"><span>BIG ISLAND. BARE KNUCKLES.</span><span>BUB PRATT · STAND TALL.</span></footer>
 </main>;
}
