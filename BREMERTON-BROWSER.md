# Play Bremerton in the browser

Open http://127.0.0.1:5184 while the local server is running. To start it again, double-click `Play Bremerton.command`, or run `npm ci` and `npm run dev -- --port 5184` in this folder.

Branch: `codex/bremerton-browser`, based on the browser game's `5dd8974` contact/healing fixes. The original browser game's main branch and public website are unchanged. Unreal is not needed to play this version.

The default environment now uses four adjoining, geographically aligned step-6 map-to-3d exports: 434 buildings, 57 original photo facade meshes, sloping terrain, and roads at real scale. The below-ground Hampton parking structure correction is retained. Brick, concrete, stucco, glass and roof textures use building kind and storeys. Asphalt and pavement distinguish streets from surrounding ground.

Marv starts on a clear road. All 24 zombies start on connected roads (six per block). A two-metre navigation grid follows the exported surfaces; movement checks actual footprint polygons and terrain heights, including tile joins and map boundaries. Zombies route around buildings. The minimap shows the full four-block area. Existing character assets, attacks, dances, keyboard/touch controls, health recovery and solid living-body collision are retained.

Controls: WASD move, Shift run, J punch, K kick, Space jump, drag to look, Esc pause. Get six metres clear of living zombies for five seconds to begin restoring health.

Validation: `npm test` loads the actual character and map meshes, checks original gameplay, all 24 road starts and connected routes, tens of thousands of route samples, slope grounding, moving zombies and boundaries. `npm run build` type-checks and makes the static browser build in `dist/`. Browser rendering and starting gameplay were also checked locally.

To reproduce the map import from the completed source export checkout:

```sh
python3 tools/import-bremerton.py ../marv-bremerton-playable/unreal/Import
```

The four prepared GLBs and level metadata are included here; runtime needs no map API keys, server-side rendering or Unreal install. This remains a geographic blockout with photo facades, not a complete photographic reconstruction. The preview is local to this Mac; this branch has not replaced the public game.
