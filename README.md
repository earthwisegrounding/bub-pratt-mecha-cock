# Marv Reeves: Zombie Killer

Play: https://earthwisegrounding.github.io/marv-reeves-zombie-killer/

Marv's mobile web edition, published on GitHub Pages. Gangnam Groove, Hip Hop Dance 1, and Hip Hop Dance 2 cycle on the title screen only. Gameplay has no victory dancing, dance locks, or dance-related invulnerability.

The original character and gameplay animations, including the hit reaction, are preserved. The town, 24 enemies, three districts, movement, combat damage, stamina costs, jumps, and corrected left/right controls remain the same.

## Controls

Desktop: WASD/arrows move, Shift runs, J punches, K kicks, Space jumps, drag the view to look, Escape pauses.

Mobile: left joystick moves, drag the open view to look, tap punch/kick/jump, and hold RUN while moving. Portrait and landscape layouts respect phone safe areas. Pause, victory, and defeat screens can return to the dancing title screen.

## Build

Requires Node 22.13 or newer. GitHub Actions uses Node 24.

```sh
npm ci
npm run dev
npm test
npm run build
```

The workflow tests and builds the game, then publishes `dist` to GitHub Pages. All asset paths support the repository subdirectory. No server or Android app is required.

## Mobile improvements and validation

Reduced zombie geometry and textures, capped mobile pixel density, disabled mobile shadows/antialiasing, conservative mesh culling, and less frequent distant animation updates reduce rendering work without changing the gameplay simulation. Pointer capture supports simultaneous movement, looking, and attacks. Hidden tabs suspend rendering and pause active gameplay.

Tests load the actual meshes and animations without textures and verify all ten Marv clips, three title dances, combat without dancing, damage/replay/victory, keyboard and touch direction, collisions, and animated title framing across phone and desktop sizes. Builds include strict TypeScript checking. Physical-device frame rates and browser visual QA have not been measured. Optional WebMCP screen controls are feature-detected but have not been verified in a supported browser runtime.

## Assets

Characters and animation clips were supplied by the user. The environment is the original game's artistic interpretation of Bremerton. Surface maps are Poly Haven CC0 assets; credits are in `public/assets/texture-credits.json`. Prebuilt optimized GLBs are included; original archives are not included.
