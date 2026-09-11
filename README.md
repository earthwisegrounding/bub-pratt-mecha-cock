# Bub Pratt: Mecha Cock Rampage

Browser game on branch `codex/bub-pratt-hilo`. Play locally at http://127.0.0.1:5185 while the server is running. Double-click `Play Bub Pratt.command` to start it again, or run `npm ci` followed by `npm run dev -- --port 5185`.

Bub starts outside **Kukuau Studio**, his home base, in a stylized Hilo bayfront arena. The environment includes tropical storefronts, palm trees, dark coastal rocks, and the ocean. It is an imagined playable layout inspired by Hilo, not a surveyed reconstruction or the studio's exact premises.

The title screen cycles through all seven supplied Bub dances. The supplied **Bub Pratt, Stand Tall** song loops across title and gameplay; the Play Music button handles browsers that block autoplay.

**Ironclaw** is a 4.8-metre killer mecha cock with 700 armor. Punches deal 38 damage; kicks deal 62. Two connected kicks knock it down (punches also accumulate stagger). It plays the supplied falling-down animation, pauses on the ground, then plays Stand Up7 before returning to combat. It cannot attack during either recovery phase. Its final defeat uses the separate Dead animation. Below half armor it moves faster. A red ground ring and message announce its attack windup; damage requires close contact at impact.

Bub's solid body collision, stamina, jumping, and health recovery are retained. Stay more than six metres clear for five seconds to start healing at five health per second. Health cannot regenerate after defeat.

Controls: WASD/arrows move; Shift run; J punch; K kick; Space jump; drag to look; Esc pause. Phones have the movement stick, camera drag, and action buttons. The minimap marks Kukuau Studio in turquoise and Ironclaw in orange.

## Validation

- `npm test`: real Bub and Ironclaw meshes/clips, seven title dances, five viewport sizes, collision/navigation, movement, contact damage and jump dodge, knockdown/get-up, victory/replay, health recovery, and audio lifecycle tests.
- `npm run build`: TypeScript validation and static output in `dist/`.
- `tests/visual.html`: local development-only animation inspection page. Not included in the production build.

The source ZIPs were processed using `tools/process-bub.py` with Blender. This combines animations per character, removes horizontal root travel, and reduces textures/geometry for browsers. All 14 Bub clips and seven Ironclaw clips are preserved in the two bundled GLBs (about 4.8 MB combined). Original archives and music in Downloads are unchanged.

This branch is separate from the Marv and Shane games and has not replaced the public website. No Unreal installation is needed.
