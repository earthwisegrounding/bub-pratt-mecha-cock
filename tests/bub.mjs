import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
await fs.mkdir(".test-work", { recursive: true });
for (const name of ["game", "rules", "navigation", "hilo"]) {
  let source = await fs.readFile(`lib/${name}.ts`, "utf8");
  for (const dependency of ["game", "rules", "navigation", "hilo"])
    source = source
      .replaceAll(`"./${dependency}.ts"`, `'./${dependency}.mjs'`)
      .replaceAll(`"./${dependency}"`, `'./${dependency}.mjs'`)
      .replaceAll(`'./${dependency}.ts'`, `'./${dependency}.mjs'`)
      .replaceAll(`'./${dependency}'`, `'./${dependency}.mjs'`);
  await fs.writeFile(
    `.test-work/${name}.mjs`,
    ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText,
  );
}
const { HiloGame } = await import("../.test-work/game.mjs");
const { HiloLevel } = await import("../.test-work/hilo.mjs");
async function loadModel(name) {
  const data = await fs.readFile(`public/assets/${name}.glb`);
  const length = data.readUInt32LE(12),
    g = JSON.parse(data.subarray(20, 20 + length).toString());
  const binary = data.subarray(20 + length + 8);
  for (const mesh of g.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  delete g.images;
  delete g.textures;
  delete g.materials;
  const json = Buffer.from(JSON.stringify(g));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
  json.copy(padded);
  const result = Buffer.alloc(12 + 8 + padded.length + 8 + binary.length);
  result.writeUInt32LE(0x46546c67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(padded.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(result, 20);
  result.writeUInt32LE(binary.length, 20 + padded.length);
  result.writeUInt32LE(0x004e4942, 24 + padded.length);
  binary.copy(result, 28 + padded.length);
  const model = await new GLTFLoader().parseAsync(
    result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength),
    "",
  );
  assert(
    model.animations.every(
      (c) => c.duration > 0 && c.tracks.every((t) => Array.from(t.values).every(Number.isFinite)),
    ),
    `${name} animation data`,
  );
  return model;
}
const templates = await Promise.all(["bub", "rooster"].map(loadModel));
assert.equal(templates[0].animations.length, 14);
assert.equal(templates[1].animations.length, 7);
// Canvas text needs no raster pixels for physics tests; the browser smoke test checks the real rendering.
globalThis.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }),
  }),
};
const level = new HiloLevel();
delete globalThis.document;
assert.equal(level.spawns.length, 1);
assert(level.path(level.start, level.spawns[0]).length);
assert(level.clear(level.start.x, level.start.z, 0.42));
assert(level.clear(0, -14, 1.15));
assert(!level.clear(43, 0, 1.15));
assert(!level.clear(79, 0, 0.42));
function game() {
  const g = Object.create(HiloGame.prototype);
  Object.assign(g, {
    scene: new T.Scene(),
    camera: new T.PerspectiveCamera(52, 1, 0.1, 500),
    mount: { clientWidth: 1280, clientHeight: 800 },
    renderer: { setSize() {} },
    templates,
    mobile: true,
    active: false,
    paused: false,
    loaded: true,
    keys: new Set(),
    joystick: new T.Vector2(),
    running: false,
    yaw: Math.PI,
    pitch: 0.28,
    health: 100,
    stamina: 100,
    kills: 0,
    lock: 0,
    invulnerable: 0,
    strike: 0,
    strikeType: "",
    jumpVelocity: 0,
    elevation: 0,
    recoil: 0,
    time: 0,
    shake: 0,
    wonAt: 0,
    deadAt: 0,
    message: "",
    messageUntil: 0,
    titleDanceIndex: 0,
    titleDanceTime: 0,
    titleDances: Array.from({ length: 7 }, (_, i) => "dance" + (i + 1)),
    animationElapsed: new Map(),
    routes: new Map(),
    level,
    colliders: level.colliders,
    enemies: [],
    particles: [],
    sound() {},
    burst() {},
    unlockAudio() {},
    hud() {},
    status() {},
  });
  g.bub = g.actor(templates[0], level.start.clone(), -1);
  g.play(g.bub, "dance1");
  g.spawn();
  return g;
}
const g = game();
assert.equal(g.enemies[0].health, 700);
assert.equal(g.enemies.length, 1);
const dances = [];
for (let i = 0; i < 8; i++) {
  dances.push(g.bub.current);
  const duration = g.bub.actions[g.bub.current].getClip().duration;
  for (let t = 0; t < duration + 0.03; t += 0.03) g.tickTitle(0.03);
}
assert.deepEqual(dances, [
  "dance1",
  "dance2",
  "dance3",
  "dance4",
  "dance5",
  "dance6",
  "dance7",
  "dance1",
]);
g.start();
assert.equal(g.bub.current, "walk");
assert(g.titleDances.every((n) => !g.bub.actions[n].isRunning()));
const start = g.bub.root.position.clone();
g.keys.add("KeyW");
g.tick(0.05);
assert(g.bub.root.position.distanceTo(start) > 0.1);
g.keys.clear();
g.bub.root.position.set(0, 0, 0);
const boss = g.enemies[0];
boss.root.position.set(0, 0, 3);
g.move(g.bub.root, new T.Vector3(0, 0, 10));
assert(g.bub.root.position.z <= 1.43001);
g.bub.root.position.set(0, 0, 0);
g.move(boss.root, new T.Vector3(0, 0, -10), 1.15);
assert(boss.root.position.z >= 1.56999);
function strike(distance, jump = 0) {
  const c = game();
  c.start();
  c.bub.root.position.set(0, jump, 0);
  c.elevation = jump;
  const z = c.enemies[0];
  z.root.position.set(0, 0, distance);
  z.root.rotation.y = Math.PI;
  c.play(z, "attack", true, 1.4);
  z.timer = 0.9;
  z.hitDone = false;
  c.tick(0.05);
  return c;
}
assert.equal(strike(3).health, 100);
assert.equal(strike(1.65).health, 78);
assert.equal(strike(1.65, 1).health, 100);
const chase = game();
chase.start();
chase.bub.root.position.set(0, 0, 0);
chase.enemies[0].root.position.set(0, 0, 4);
for (let i = 0; i < 85; i++) chase.tick(0.05);
assert(chase.health < 100);
assert(chase.enemies[0].root.position.distanceTo(chase.bub.root.position) >= 1.5699);
const fight = game();
fight.start();
fight.bub.root.position.set(0, 0, 0);
fight.bub.root.rotation.y = 0;
fight.enemies[0].root.position.set(0, 0, 1.65);
fight.attack("kick");
fight.hit();
assert.equal(fight.enemies[0].health, 638);
fight.strike = 0;
fight.enemies[0].health = 60;
fight.hit();
assert(fight.enemies[0].dead);
assert.equal(fight.kills, 1);
assert.equal(fight.enemies[0].current, "death");
fight.restart();
assert.equal(fight.enemies[0].health, 700);
assert.equal(fight.health, 100);
assert.equal(fight.kills, 0);
const recovery = game();
recovery.start();
recovery.health = 50;
recovery.enemies[0].root.position.set(65, 0, -60);
for (let i = 0; i < 120; i++) recovery.tick(0.05);
assert(Math.abs(recovery.health - 55) < 0.0001);
recovery.paused = true;
recovery.tick(1);
assert(Math.abs(recovery.health - 55) < 0.0001);
recovery.health = 0;
recovery.paused = false;
for (let i = 0; i < 40; i++) recovery.tick(0.05);
assert.equal(recovery.health, 0);
// Ensure all seven title dances fit in desktop and phone frames using actual skinned bounds.
const stage = game();
stage.bub.root.rotation.y = 0.23;
for (const [w, h] of [
  [390, 844],
  [375, 667],
  [320, 568],
  [844, 390],
  [1280, 800],
]) {
  stage.mount = { clientWidth: w, clientHeight: h };
  stage.resize();
  const p = stage.bub.root.position;
  stage.camera.position.copy(p).add(new T.Vector3(1.2, 1.9, w / h < 0.8 ? 5.8 : 5.6));
  stage.camera.lookAt(p.clone().add(new T.Vector3(0, 1, 0)));
  stage.camera.updateMatrixWorld();
  let minX = 1,
    maxX = -1,
    minY = 1,
    maxY = -1;
  for (const name of stage.titleDances) {
    stage.bub.mixer.stopAllAction();
    stage.bub.current = "";
    stage.play(stage.bub, name);
    const duration = stage.bub.actions[name].getClip().duration;
    for (let frame = 0; frame < 12; frame++) {
      stage.bub.mixer.setTime((duration * frame) / 12);
      stage.scene.updateMatrixWorld(true);
      stage.bub.root.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        o.computeBoundingBox();
        const b = o.boundingBox;
        for (const x of [b.min.x, b.max.x])
          for (const y of [b.min.y, b.max.y])
            for (const z of [b.min.z, b.max.z]) {
              const q = new T.Vector3(x, y, z).applyMatrix4(o.matrixWorld).project(stage.camera);
              minX = Math.min(minX, q.x);
              maxX = Math.max(maxX, q.x);
              minY = Math.min(minY, q.y);
              maxY = Math.max(maxY, q.y);
            }
      });
    }
  }
  assert(
    minX > -1 && maxX < 1 && minY > -1 && maxY < 1,
    `Bub title fits ${w}x${h}: ${[minX, maxX, minY, maxY]}`,
  );
}
console.log(
  "PASS: 14 Bub clips, seven title dances, seven rooster clips, Hilo collision/navigation, movement, giant boss body contact, dodge, damage, victory/replay, healing, and five title viewport sizes.",
);

// Two kicks knock the living boss down. It cannot attack while down or getting up.
const down = game();
down.start();
down.bub.root.position.set(0, 0, 0);
down.bub.root.rotation.y = 0;
down.enemies[0].root.position.set(0, 0, 1.65);
down.strikeType = "kick";
down.hit();
down.hit();
assert.equal(down.enemies[0].current, "stumble");
assert(!down.enemies[0].dead);
const health = down.health;
for (let i = 0; i < 64; i++) down.tick(0.05);
assert.equal(down.enemies[0].current, "intro");
assert.equal(down.health, health);
for (let i = 0; i < 54; i++) down.tick(0.05);
assert.equal(down.health, health);
assert(["walk", "attack"].includes(down.enemies[0].current));
console.log(
  "PASS: two-kick knockdown, authored falling/get-up clips, no damage during recovery, and return to combat.",
);
