import * as T from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Collider } from "./rules.ts";
type Building = {
  id: number;
  kind: string;
  storeys: number;
  heightM: number;
  footprint: number[][];
};
type Tile = {
  id: string;
  offset: number[];
  scale: number;
  bounds: number[];
  buildings: Building[];
};
export type LevelData = { tiles: Tile[] };
type Triangle = { a: T.Vector3; b: T.Vector3; c: T.Vector3; road: boolean; tile: number };
type Polygon = { points: number[][]; box: Collider };
const bucket = (x: number, z: number) => `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
export class StreetLevel {
  root = new T.Group();
  colliders: Collider[] = [];
  polygons: Polygon[] = [];
  surfaces = new Map<string, Triangle[]>();
  walls = new Map<string, Polygon[]>();
  bounds: number[];
  start = new T.Vector3();
  spawns: T.Vector3[] = [];
  roadNodes: number[][] = [];
  readonly cell = 2;
  nx: number;
  nz: number;
  walk: Uint8Array;
  heights: Float32Array;
  component: Uint8Array;
  constructor(
    readonly data: LevelData,
    models: GLTF[],
    decorate = true,
    readonly clearance = 0.75,
  ) {
    this.bounds = [
      Math.min(...data.tiles.map((t) => t.bounds[0])),
      Math.min(...data.tiles.map((t) => t.bounds[1])),
      Math.max(...data.tiles.map((t) => t.bounds[2])),
      Math.max(...data.tiles.map((t) => t.bounds[3])),
    ];
    const seen = new Set<number>();
    const materials = decorate ? makeMaterials() : null;
    data.tiles.forEach((tile, ti) => {
      const model = models[ti].scene;
      model.position.fromArray(tile.offset);
      model.scale.x = tile.scale;
      this.root.add(model);
      model.updateMatrixWorld(true);
      const buildings = new Map(tile.buildings.map((b) => [b.id, b]));
      const duplicates = new Set(tile.buildings.filter((b) => seen.has(b.id)).map((b) => b.id));
      for (const b of tile.buildings) {
        if (seen.has(b.id)) continue;
        seen.add(b.id);
        if (b.id === 560819354) continue;
        const points = b.footprint.map(([x, n]) => [
          x * tile.scale + tile.offset[0],
          -n + tile.offset[2],
        ]);
        const xs = points.map((p) => p[0]),
          zs = points.map((p) => p[1]);
        const box = {
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          z: (Math.min(...zs) + Math.max(...zs)) / 2,
          w: Math.max(...xs) - Math.min(...xs),
          d: Math.max(...zs) - Math.min(...zs),
        };
        const polygon = { points, box };
        this.polygons.push(polygon);
        this.colliders.push(box);
        this.insert(
          this.walls,
          polygon,
          box.x - box.w / 2 - 1,
          box.z - box.d / 2 - 1,
          box.x + box.w / 2 + 1,
          box.z + box.d / 2 + 1,
        );
      }
      model.traverse((o) => {
        const mesh = o as T.Mesh;
        if (!mesh.isMesh) return;
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        const match = mesh.name.match(/^bldg_(\d+)/);
        if (match) {
          const id = Number(match[1]);
          if (duplicates.has(id)) {
            mesh.visible = false;
            return;
          }
          if (id === 560819354) {
            mesh.position.y -= (buildings.get(id)?.heightM || 20.4) + 0.5;
            return;
          }
          if (materials && !mesh.name.includes("facade")) {
            const b = buildings.get(id);
            if (b) tileBuilding(mesh, materials[materialKind(b)], materials.Roof);
          }
          return;
        }
        if (mesh.name !== "ground" && mesh.name !== "roads") return;
        if (materials)
          mesh.material = mesh.name === "roads" ? materials.Asphalt : materials.Pavement;
        const pos = mesh.geometry.attributes.position,
          index = mesh.geometry.index;
        for (let i = 0; i < (index?.count || pos.count); i += 3) {
          const p = [0, 1, 2].map((k) =>
            new T.Vector3()
              .fromBufferAttribute(pos, index ? index.getX(i + k) : i + k)
              .applyMatrix4(mesh.matrixWorld),
          );
          const tri = { a: p[0], b: p[1], c: p[2], road: mesh.name === "roads", tile: ti };
          this.insert(
            this.surfaces,
            tri,
            Math.min(...p.map((v) => v.x)),
            Math.min(...p.map((v) => v.z)),
            Math.max(...p.map((v) => v.x)),
            Math.max(...p.map((v) => v.z)),
          );
        }
      });
    });
    this.nx = Math.ceil((this.bounds[2] - this.bounds[0]) / this.cell);
    this.nz = Math.ceil((this.bounds[3] - this.bounds[1]) / this.cell);
    this.walk = new Uint8Array(this.nx * this.nz);
    this.component = new Uint8Array(this.walk.length);
    this.heights = new Float32Array(this.walk.length);
    this.roadNodes = data.tiles.map(() => []);
    for (let i = 0; i < this.walk.length; i++) {
      const p = this.point(i),
        hit = this.surface(p.x, p.z);
      if (hit && this.clear(p.x, p.z, this.clearance)) {
        this.walk[i] = 1;
        this.heights[i] = hit.y;
        if (hit.road) this.roadNodes[hit.tile].push(i);
      }
    }
    const candidates = this.roadNodes[0]
      .filter((i) => {
        const p = this.point(i);
        return (
          this.walk[i] &&
          this.clear(p.x, p.z, 4) &&
          this.direct(p, p.clone().add(new T.Vector3(0, 0, -6.5)), 0.4)
        );
      })
      .sort((a, b) => this.point(a).lengthSq() - this.point(b).lengthSq());
    if (!candidates.length) throw Error("No clear road for the player");
    const first = candidates[0];
    this.start.copy(this.point(first));
    const queue = [first];
    this.component[first] = 1;
    for (let head = 0; head < queue.length; head++)
      for (const n of this.neighbors(queue[head]))
        if (!this.component[n]) {
          this.component[n] = 1;
          queue.push(n);
        }
    this.roadNodes = this.roadNodes.map((nodes) => nodes.filter((i) => this.component[i]));
    // Six well-separated road starts in each rectangle, all reachable from the player.
    for (const nodes of this.roadNodes) {
      let choices = nodes.filter((i) => this.point(i).distanceTo(this.start) > 12);
      for (let count = 0; count < 6; count++) {
        if (!choices.length) throw Error("Insufficient connected road spawn positions");
        const index = choices[Math.floor((choices.length * (count + 0.5)) / 6) % choices.length];
        const p = this.point(index);
        this.spawns.push(p);
        choices = choices.filter((i) => this.point(i).distanceTo(p) > 12);
      }
    }
  }
  insert<V>(map: Map<string, V[]>, value: V, x0: number, z0: number, x1: number, z1: number) {
    for (let x = Math.floor(x0 / 16); x <= Math.floor(x1 / 16); x++)
      for (let z = Math.floor(z0 / 16); z <= Math.floor(z1 / 16); z++) {
        const key = `${x},${z}`;
        const list = map.get(key) || [];
        list.push(value);
        map.set(key, list);
      }
  }
  surface(x: number, z: number) {
    let result: { y: number; road: boolean; tile: number } | null = null;
    for (const t of this.surfaces.get(bucket(x, z)) || []) {
      const { a, b, c } = t;
      const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(det) < 1e-9) continue;
      const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det,
        v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det;
      if (u < -0.00001 || v < -0.00001 || u + v > 1.00001) continue;
      const y = u * a.y + v * b.y + (1 - u - v) * c.y;
      if (!result || y > result.y) result = { y, road: t.road, tile: t.tile };
    }
    return result;
  }
  clear(x: number, z: number, r: number) {
    const b = this.bounds;
    if (x < b[0] + r || x > b[2] - r || z < b[1] + r || z > b[3] - r) return false;
    return !(this.walls.get(bucket(x, z)) || []).some((p) => insideOrNear(x, z, r, p.points));
  }
  canMove(x: number, z: number, r: number, fromX = x, fromZ = z) {
    if (!this.clear(x, z, r)) return false;
    const next = this.surface(x, z),
      prev = this.surface(fromX, fromZ);
    return (
      !!next && !!prev && Math.abs(next.y - prev.y) < 0.6 + Math.hypot(x - fromX, z - fromZ) * 0.7
    );
  }
  height(x: number, z: number) {
    return this.surface(x, z)?.y ?? 0;
  }
  point(i: number) {
    return new T.Vector3(
      this.bounds[0] + ((i % this.nx) + 0.5) * this.cell,
      this.heights?.[i] || 0,
      this.bounds[1] + (Math.floor(i / this.nx) + 0.5) * this.cell,
    );
  }
  index(p: T.Vector3) {
    const x = Math.floor((p.x - this.bounds[0]) / this.cell),
      z = Math.floor((p.z - this.bounds[1]) / this.cell);
    return x < 0 || z < 0 || x >= this.nx || z >= this.nz ? -1 : z * this.nx + x;
  }
  neighbors(i: number) {
    const result: number[] = [];
    for (const n of [i - 1, i + 1, i - this.nx, i + this.nx]) {
      if (
        n < 0 ||
        n >= this.walk.length ||
        !this.walk[n] ||
        Math.abs((n % this.nx) - (i % this.nx)) > 1 ||
        Math.abs(this.heights[n] - this.heights[i]) > 1.4
      )
        continue;
      const a = this.point(i),
        b = this.point(n);
      if (this.canMove((a.x + b.x) / 2, (a.z + b.z) / 2, this.clearance, a.x, a.z)) result.push(n);
    }
    return result;
  }
  nearest(p: T.Vector3) {
    const index = this.index(p);
    if (index >= 0 && this.component[index]) return index;
    let best = -1,
      distance = Infinity;
    for (let z = -3; z <= 3; z++)
      for (let x = -3; x <= 3; x++) {
        const n = this.index(p.clone().add(new T.Vector3(x * this.cell, 0, z * this.cell)));
        if (n < 0 || !this.component[n]) continue;
        const d = this.point(n).distanceToSquared(p);
        if (d < distance) {
          best = n;
          distance = d;
        }
      }
    return best;
  }
  path(from: T.Vector3, to: T.Vector3) {
    const start = this.nearest(from),
      goal = this.nearest(to);
    if (start < 0 || goal < 0) return [];
    const open = [start],
      cost = new Map([[start, 0]]),
      parent = new Map<number, number>();
    const target = this.point(goal);
    const score = (i: number) =>
      (cost.get(i) ?? Infinity) +
      Math.abs(this.point(i).x - target.x) / this.cell +
      Math.abs(this.point(i).z - target.z) / this.cell;
    for (let attempts = 0; open.length && attempts < 20000; attempts++) {
      let best = 0;
      for (let j = 1; j < open.length; j++) if (score(open[j]) < score(open[best])) best = j;
      const current = open.splice(best, 1)[0];
      if (current === goal) {
        const route = [goal];
        while (route[route.length - 1] !== start) route.push(parent.get(route[route.length - 1])!);
        return route.reverse().map((i) => this.point(i));
      }
      for (const n of this.neighbors(current)) {
        const next = cost.get(current)! + 1;
        if (next >= (cost.get(n) ?? Infinity)) continue;
        parent.set(n, current);
        cost.set(n, next);
        if (!open.includes(n)) open.push(n);
      }
    }
    return [];
  }
  direct(a: T.Vector3, b: T.Vector3, r = 0.5) {
    const distance = Math.hypot(a.x - b.x, a.z - b.z),
      steps = Math.ceil(distance / 0.5);
    let x = a.x,
      z = a.z;
    for (let i = 1; i <= steps; i++) {
      const nx = T.MathUtils.lerp(a.x, b.x, i / steps),
        nz = T.MathUtils.lerp(a.z, b.z, i / steps);
      if (!this.canMove(nx, nz, r, x, z)) return false;
      x = nx;
      z = nz;
    }
    return true;
  }
}
function insideOrNear(x: number, z: number, r: number, points: number[][]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[j],
      [bx, bz] = points[i];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
    const dx = bx - ax,
      dz = bz - az,
      t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < r) return true;
  }
  return inside;
}
function materialKind(b: Building) {
  if (["parking", "industrial", "warehouse", "roof"].includes(b.kind)) return "Concrete";
  if (["commercial", "office"].includes(b.kind) && b.storeys >= 5) return "Glass";
  if (["house", "detached", "residential"].includes(b.kind) && b.storeys <= 3) return "Stucco";
  if (["retail", "theatre", "amenity"].includes(b.kind) || b.storeys <= 3) return "Brick";
  return b.storeys >= 5 ? "Concrete" : "Stucco";
}
function makeMaterials() {
  const result: Record<string, T.MeshStandardMaterial> = {};
  for (const [kind, color] of Object.entries({
    Brick: "#86604e",
    Concrete: "#90938d",
    Stucco: "#c5baa2",
    Glass: "#5c7c82",
    Roof: "#444b4b",
    Asphalt: "#3d4447",
    Pavement: "#999a90",
  })) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const c = canvas.getContext("2d")!;
    c.fillStyle = color;
    c.fillRect(0, 0, 256, 256);
    if (kind === "Brick") {
      c.strokeStyle = "#b39c84";
      c.lineWidth = 2;
      for (let y = 0; y < 256; y += 16) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(256, y);
        c.stroke();
        for (let x = ((y / 16) % 2) * 32; x < 256; x += 64) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x, y + 16);
          c.stroke();
        }
      }
    }
    if (!["Roof", "Asphalt", "Pavement"].includes(kind)) {
      c.fillStyle = "#384f55";
      c.fillRect(35, 66, 70, 116);
      c.fillRect(151, 66, 70, 116);
      c.strokeStyle = "#d3cbb8";
      c.lineWidth = 5;
      c.strokeRect(35, 66, 70, 116);
      c.strokeRect(151, 66, 70, 116);
    }
    if (["Asphalt", "Pavement", "Roof"].includes(kind)) {
      for (let i = 0; i < 3500; i++) {
        c.fillStyle = i % 2 ? "#ffffff0b" : "#0000000b";
        c.fillRect((i * 73) % 256, (i * 137 + Math.floor(i / 256) * 31) % 256, 2, 2);
      }
    }
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = 4;
    result[kind] = new T.MeshStandardMaterial({
      map: texture,
      roughness: kind === "Glass" ? 0.4 : 0.95,
    });
  }
  return result;
}
function tileBuilding(mesh: T.Mesh, wall: T.Material, roof: T.Material) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const p = geometry.attributes.position,
    n = geometry.attributes.normal,
    uv = new Float32Array(p.count * 2);
  geometry.clearGroups();
  let groupStart = 0,
    last = -1;
  for (let i = 0; i < p.count; i += 3) {
    const up = Math.abs(n.getY(i)) > 0.7,
      mat = up ? 1 : 0;
    if (mat !== last) {
      if (i) geometry.addGroup(groupStart, i - groupStart, last);
      groupStart = i;
      last = mat;
    }
    for (let j = i; j < i + 3; j++) {
      uv[j * 2] = (up ? p.getX(j) : Math.abs(n.getX(j)) > 0.7 ? p.getZ(j) : p.getX(j)) / 4;
      uv[j * 2 + 1] = (up ? p.getZ(j) : p.getY(j)) / 3.4;
    }
  }
  geometry.addGroup(groupStart, p.count - groupStart, last);
  geometry.setAttribute("uv", new T.BufferAttribute(uv, 2));
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  mesh.material = [wall, roof];
}
