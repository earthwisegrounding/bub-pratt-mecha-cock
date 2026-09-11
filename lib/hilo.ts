import * as T from "three";
import { StreetLevel, type LevelData } from "./navigation";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

// A deliberately stylized arena inspired by Hilo's bayfront, not a surveyed reconstruction.
export class HiloLevel extends StreetLevel {
  constructor() {
    const scene = new T.Group(),
      buildings: LevelData["tiles"][number]["buildings"] = [];
    const mats: Record<string, T.MeshStandardMaterial> = {};
    for (const [name, color] of Object.entries({
      pavement: "#c9c5ab",
      road: "#58615b",
      sand: "#d9c698",
      water: "#25989c",
      grass: "#478754",
      leaf: "#247145",
      leaf2: "#6d9b4f",
      trunk: "#74533b",
      lava: "#333b38",
      coral: "#db927e",
      mint: "#9cc9b0",
      yellow: "#ead296",
      blue: "#7db6c0",
      roof: "#804b3e",
      trim: "#eee9d1",
      glass: "#2b686e",
      metal: "#496967",
    }))
      mats[name] = new T.MeshStandardMaterial({ color, roughness: name === "water" ? 0.28 : 0.87 });
    let serial = 1;
    const box = (
      name: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      mat: string,
    ) => {
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mats[mat]);
      mesh.name = name;
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return mesh;
    };
    const collider = (x: number, z: number, w: number, d: number, h = 5) => {
      const id = serial++;
      buildings.push({
        id,
        kind: "retail",
        storeys: 1,
        heightM: h,
        footprint: [
          [x - w / 2, -z + d / 2],
          [x + w / 2, -z + d / 2],
          [x + w / 2, -z - d / 2],
          [x - w / 2, -z - d / 2],
          [x - w / 2, -z + d / 2],
        ],
      });
      return id;
    };
    const ground = new T.Mesh(new T.PlaneGeometry(156, 140), mats.pavement);
    ground.rotation.x = -Math.PI / 2;
    ground.name = "ground";
    ground.position.y = -.025;
    scene.add(ground);
    // Walkable roads and plaza share a continuous zero-height surface.
    const road = new T.Mesh(new T.PlaneGeometry(42, 124), mats.road);
    road.rotation.x = -Math.PI / 2;
    road.name = "roads";
    scene.add(road);
    box("cross street", 0, 0.005, -30, 150, 0.01, 14, "road");
    box("bayfront promenade", 0, 0.007, -59, 154, 0.01, 14, "sand");
    box("Hilo Bay", 0, -0.7, -175, 600, 0.3, 210, "water");
    for (let i = 0; i < 28; i++) {
      const wave = box(
        "ocean whitecaps",
        Math.sin(i * 7) * 170,
        -0.48,
        -80 - i * 5,
        10 + (i % 7),
        0.02,
        0.23,
        "trim",
      );
      wave.rotation.y = 0.08;
    }
    for (let z = -48; z < 65; z += 8) {
      box("road stripe", 0, 0.015, z, 0.18, 0.01, 3, "yellow");
    }
    for (const z of [-40, -20])
      for (let x = -8; x <= 8; x += 2) box("crosswalk", x, 0.02, z, 1.1, 0.01, 3, "trim");
    const sign = (title: string, x: number, y: number, z: number, w: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 160;
      const c = canvas.getContext("2d")!;
      c.fillStyle = "#214f4b";
      c.fillRect(0, 0, 1024, 160);
      c.strokeStyle = "#e8d8a2";
      c.lineWidth = 6;
      c.strokeRect(8, 8, 1008, 144);
      c.fillStyle = "#fff2ca";
      c.font = "bold 68px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(title, 512, 80, 970);
      const tex = new T.CanvasTexture(canvas);
      tex.colorSpace = T.SRGBColorSpace;
      const mesh = new T.Mesh(
        new T.PlaneGeometry(w, (w * 160) / 1024),
        new T.MeshBasicMaterial({ map: tex }),
      );
      mesh.position.set(x, y, z);
      scene.add(mesh);
    };
    const labels = [
      "HILO BAY MARKET",
      "BAYFRONT COFFEE",
      "KUKUAU STUDIO",
      "ISLAND SHAVE ICE",
      "ALOHA RECORDS",
      "RAIN TOWN FLOWERS",
    ];
    for (const side of [-1, 1])
      for (let row = 0; row < 3; row++) {
        const x = side * 43,
          z = -40 + row * 37,
          w = 28,
          d = 21,
          h = 6 + (row % 2) * 2;
        const id = collider(x, z, w, d, h);
        box(
          "bldg_" + id,
          x,
          h / 2,
          z,
          w,
          h,
          d,
          ["coral", "mint", "yellow", "blue"][(row + (side + 1)) % 4],
        );
        box("roof", x, h + 0.25, z, w + 1, 0.5, d + 1, "roof");
        box("veranda", x, 3.2, z + d / 2 + 1, w + 1, 0.2, 3, "trim");
        for (let dx = -10; dx <= 10; dx += 5) {
          box("storefront window", x + dx, 1.7, z + d / 2 + 0.04, 3.5, 2.3, 0.08, "glass");
          box("porch column", x + dx, 1.5, z + d / 2 + 2, 0.16, 3, 0.16, "trim");
        }
        sign(
          labels[(side === -1 ? 0 : 3) + row],
          x,
          4.5,
          z + d / 2 + 0.1,
          side === -1 && row === 2 ? 11 : 22,
        );
      }
    function palm(x: number, z: number, h: number) {
      const trunk = new T.Mesh(new T.CylinderGeometry(0.17, 0.3, h, 7), mats.trunk);
      trunk.position.set(x, h / 2, z);
      scene.add(trunk);
      collider(x, z, 0.65, 0.65, h);
      for (let k = 0; k < 9; k++) {
        const angle = (k * Math.PI * 2) / 9,
          verts = [];
        for (let j = 0; j < 5; j++) {
          const a = j / 4,
            r = a * 4.5,
            y = h + Math.sin(a * Math.PI) * 1.2 - a * 1.4,
            wide = Math.sin(a * Math.PI) * 0.6;
          for (const side of [-1, 1])
            verts.push(
              x + Math.cos(angle) * r + Math.sin(angle) * wide * side,
              y,
              z + Math.sin(angle) * r - Math.cos(angle) * wide * side,
            );
        }
        const geometry = new T.BufferGeometry();
        geometry.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
        geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6, 5, 7, 6, 6, 7, 8, 7, 9, 8]);
        geometry.computeVertexNormals();
        const leaf = new T.Mesh(geometry, mats[k % 2 ? "leaf" : "leaf2"]);
        (leaf.material as T.Material).side = T.DoubleSide;
        scene.add(leaf);
      }
    }
    for (const x of [-70, -25, 25, 70])
      for (const z of [-61, 4, 57]) palm(x, z, 7 + (Math.abs(x) % 3));
    for (let i = 0; i < 26; i++) {
      const mesh = new T.Mesh(new T.DodecahedronGeometry(1.2 + (i % 3) * 0.4, 0), mats.lava);
      mesh.position.set(-76 + i * 6, -0.3, -69);
      mesh.scale.y = 0.65;
      scene.add(mesh);
    }
    for (const x of [-65, 65])
      for (const z of [-5, 32]) {
        box("garden bed", x, 0.12, z, 9, 0.24, 9, "grass");
        for (let i = 0; i < 5; i++) {
          const shrub = new T.Mesh(new T.IcosahedronGeometry(1.4, 1), mats.leaf);
          shrub.position.set(x + Math.sin(i * 3) * 2, 1, z + Math.cos(i * 3) * 2);
          scene.add(shrub);
        }
        collider(x, z, 7, 7, 2);
      }
    for (let i = 0; i < 6; i++) {
      const hill = new T.Mesh(new T.SphereGeometry(1, 12, 8), mats.leaf);
      hill.position.set(-150 + i * 60, -8, 155);
      hill.scale.set(60, 25 + (i % 3) * 8, 55);
      scene.add(hill);
    }
    sign("HILO · HAWAI‘I", 0, 5.2, 66, 15);
    sign("BUB’S HOME BASE", -43, 2.8, 44.65, 6);
    box("studio welcome mat", -43, 0.025, 48, 8, 0.04, 3, "blue");
    const data: LevelData = {
      tiles: [{ id: "hilo", offset: [0, 0, 0], scale: 1, bounds: [-78, -70, 78, 70], buildings }],
    };
    super(data, [{ scene } as GLTF], false, 1.3);
    this.start.set(-43, 0, 50);
    this.spawns = [new T.Vector3(0, 0, -14)];
  }
}
