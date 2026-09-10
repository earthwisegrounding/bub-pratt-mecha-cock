import {useEffect, useRef, useState, type PointerEvent} from 'react';
import type {BremertonGame, Hud} from '../lib/game';
import {registerGameTools} from '../lib/game-tools';
import {Soundtrack, type MusicStatus} from '../lib/music';

const initialHud:Hud={health:100,stamina:100,kills:0,total:24,district:'Downtown',message:'',dead:false,won:false,paused:false,healing:false};
export default function Home(){
 const mount=useRef<HTMLDivElement>(null);
 const game=useRef<BremertonGame|null>(null);
 const music=useRef<Soundtrack|null>(null);
 const mutePreference=useRef(false);
 const [musicStatus,setMusicStatus]=useState<MusicStatus>('loading');
 const stickPointer=useRef<number|null>(null);
 const [status,setStatus]=useState('Preparing Bremerton…');
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
  const track=new Soundtrack(new URL('music/marv-reeves-hold-the-line.mp3',document.baseURI).href,setMusicStatus);music.current=track;
  return()=>{track.dispose();music.current=null;};
 },[]);
 useEffect(()=>{
  let disposed=false;let removeTools=()=>{};
  import('../lib/game').then(async({BremertonGame})=>{
   if(disposed)return;
   try{
    const g=new BremertonGame(mount.current!,s=>{if(!disposed){setStatus(s);if(s.startsWith('Graphics'))setError(true);}},h=>{if(!disposed)setHud(h);});
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
  <div className="viewport" ref={mount} aria-label="3D Bremerton waterfront"/><div className="vignette"/>
  <header className="topline">
   <div className="wordmark">MR<span>LAST MAN<br/>IN BREMERTON</span></div>
   <div className="coordinates">BREMERTON, WA <span>47.5673° N · 122.6326° W</span></div>
   <button className="small-button sound-button" data-sound-toggle onClick={()=>{const next=!muted&&musicStatus==='playing';mutePreference.current=next;setMuted(next);game.current?.setMuted(next);music.current?.setMuted(next);}} aria-label={muted?'Enable music and sound':musicStatus==='playing'?'Mute music and sound':'Play music'}>{muted?'SOUND OFF':musicStatus==='playing'?'SOUND ON':'PLAY MUSIC'}</button>
   {playing&&<button className="small-button" onClick={()=>game.current?.pause()} aria-label={hud.paused?'Resume game':'Pause game'}>Ⅱ</button>}
  </header>
  {!playing?<section className="start-panel">
   <div className="eyebrow">DAY ONE · THE SILENCE BROKE</div>
   <h1>MARV<br/>REEVES<span>ZOMBIE KILLER</span></h1>
   <p>His hometown. Their worst mistake.</p>
   <div className="intro">Bremerton has fallen. Marv hasn’t.<br/>Take back the waterfront with nothing but your bare hands.</div>
   <button className="start-button" disabled={!ready||error} onClick={start}>{ready?'TAKE BACK BREMERTON':'LOADING THE WATERFRONT…'}<span aria-hidden="true">↗</span></button>
   <div className="healing-help">Get 6 meters clear of zombies for 5 seconds to heal.</div>
   <div className="loading-status" role="status">{status}</div>
   <div className="controls-brief"><span><kbd>W A S D</kbd> MOVE</span><span><kbd>J</kbd> PUNCH</span><span><kbd>K</kbd> KICK</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>SHIFT</kbd> RUN</span><span><kbd>DRAG</kbd> LOOK</span></div>
   <div className="mobile-help">Left thumb to move. Drag the view to look.<br/>Hold RUN while moving. Landscape gives you more room.</div>
  </section>:<>
   <aside className="vitals"><div className="label-row"><b>MARV REEVES</b><span>{Math.ceil(hud.health)} / 100</span></div><div className="health-track" role="meter" aria-label="Health" aria-valuenow={hud.health} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${hud.health}%`}}/></div><div className="stamina-track" role="meter" aria-label="Stamina" aria-valuenow={Math.round(hud.stamina)} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${hud.stamina}%`}}/></div><span className="secondary-label recovery-label">{hud.healing?'HEALING · +5 GRIT / SEC':hud.health<100?'GET CLEAR · 5 SEC TO HEAL':'GRIT / STAMINA'}</span></aside>
   <aside className="mission"><div className="eyebrow">TAKE BACK THE TOWN</div><strong>{hud.kills}<span> / {hud.total}</span></strong><p>ZOMBIES PUT DOWN</p><div className="district">⌖ {hud.district}</div></aside>
   <div className="toast" role="status">{hud.message}</div><div className="reticle" aria-hidden="true">·</div>
   <div className="desktop-help">WASD move <b>·</b> Shift run <b>·</b> J punch <b>·</b> K kick <b>·</b> Space jump <b>·</b> Drag look <b>·</b> Esc pause</div>
   <canvas id="minimap" className="minimap" width="200" height="200" aria-label="Map showing Marv, buildings, and remaining zombies"/>
   <div className="touch-controls" inert={overlay}>
    <div className="joystick" aria-label="Movement joystick" onPointerDown={e=>{if(stickPointer.current!==null)return;e.preventDefault();stickPointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);updateStick(e);}} onPointerMove={e=>{if(stickPointer.current===e.pointerId)updateStick(e);}} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}><span className="stick-knob" style={{transform:`translate(${stick.x}px,${stick.y}px)`}}>MOVE</span></div>
    <div className="action-pad">
     {(['punch','kick','jump'] as const).map(action=><button key={action} onPointerDown={e=>{e.preventDefault();action==='jump'?game.current?.jump():game.current?.attack(action);}} onClick={e=>{if(e.detail===0){action==='jump'?game.current?.jump():game.current?.attack(action);}}}>{action.toUpperCase()}</button>)}
     <button className={running?'is-held':''} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);game.current?.setRun(true);setRunning(true);}} onPointerUp={releaseRun} onPointerCancel={releaseRun} onLostPointerCapture={releaseRun} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){game.current?.setRun(true);setRunning(true);}}} onKeyUp={releaseRun} onBlur={releaseRun}>RUN</button>
    </div>
   </div>
   {overlay&&<section className="pause-screen" role="dialog" aria-modal="true" aria-labelledby="pause-heading">
    <div className="eyebrow">{hud.dead?'BREMERTON STILL NEEDS YOU':hud.won?'ONE MAN. ONE TOWN. NO MORE ZOMBIES.':'TAKE A BREATH'}</div>
    <h2 id="pause-heading">{hud.dead?'DOWN, NOT DONE.':hud.won?'THIS IS MARV’S TOWN.':'PAUSED'}</h2>
    <p>{hud.dead?`${hud.kills} zombies defeated. Get back out there.`:hud.won?'Every district is clear. Bremerton is yours again.':'Your hometown can wait a moment.'}</p>
    <button className="start-button" onClick={()=>hud.paused&&!hud.dead&&!hud.won?game.current?.pause():game.current?.restart()}>{hud.paused&&!hud.dead&&!hud.won?'BACK TO BREMERTON':'PLAY AGAIN'}<span aria-hidden="true">↗</span></button>
    <button className="title-button" onClick={title}>TITLE SCREEN</button>
   </section>}
  </>}
  {error&&<section className="pause-screen" role="alert"><h2>LET’S TRY THAT AGAIN.</h2><p>{status}</p><button className="start-button" onClick={()=>location.reload()}>RELOAD GAME</button></section>}
  <footer className="bottomline"><span>THE PACIFIC NORTHWEST FIGHTS BACK.</span><span>BARE HANDS. NO BACKUP.</span></footer>
 </main>;
}
