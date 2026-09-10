import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { loadModel, createGame } from "./game.mjs";
const { StreetLevel } = await import("../.test-work/bremerton.mjs");
const data = JSON.parse(await fs.readFile("public/assets/bremerton/level.json", "utf8"));
const models = await Promise.all(data.tiles.map((t) => loadModel("bremerton/" + t.id)));
console.time("navigation");
const level = new StreetLevel(data, models, false);
console.timeEnd("navigation");
assert.equal(level.spawns.length, 24);
assert.equal(level.polygons.length, 433);
for (const p of [level.start, ...level.spawns]) {
  assert(level.clear(p.x, p.z, 0.48));
  assert(level.surface(p.x, p.z).road);
  assert(Math.abs(p.y - level.height(p.x, p.z)) < 0.00001);
  assert(level.path(level.start, p).length);
}
for (let i = 0; i < 24; i++)
  for (let j = i + 1; j < 24; j++) assert(level.spawns[i].distanceTo(level.spawns[j]) > 0.96);
const g = createGame();
g.level = level;
g.routes = new Map();
g.colliders = level.colliders;
g.restart();
assert(g.marv.root.position.distanceTo(level.start) < 0.00001);
// Walk every nav path across the map using the same collision and height queries as runtime.
let samples = 0;
for (const end of level.spawns) {
  const path = level.path(level.start, end);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    for (let t = 0; t <= 1; t += 0.1) {
      const x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t;
      assert(level.canMove(x, z, 0.48, a.x, a.z), "route passes through building or steep ledge");
      samples++;
    }
  }
}
// Active pursuit navigates and stays on actual terrain with supplied animated characters.
const before = g.zombies.map((z) => z.root.position.clone());
for (let i = 0; i < 100; i++) g.tick(0.05);
assert(g.zombies.every((z, i) => z.root.position.distanceTo(before[i]) > 0.05));
assert(g.zombies.every((z) => level.clear(z.root.position.x, z.root.position.z, 0.47)));
assert(
  g.zombies.every(
    (z) =>
      Math.abs(z.root.position.y - level.height(z.root.position.x, z.root.position.z)) < 0.00001,
  ),
);
assert(!level.clear(level.bounds[0] - 0.1, level.start.z, 0.42));
console.log(
  JSON.stringify({
    buildings: level.polygons.length + 1,
    facades: models.reduce((n, m) => {
      m.scene.traverse((o) => {
        if (o.name.includes("facade")) n++;
      });
      return n;
    }, 0),
    spawns: level.spawns.length,
    connectedRoadNodes: level.roadNodes.map((n) => n.length),
    routeSamples: samples,
    start: level.start.toArray(),
  }),
);
console.log(
  "PASS: four real blocks, road spawns, connected routes, footprint collision, slope grounding, moving zombies and boundaries.",
);
