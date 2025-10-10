HexGL
=========

This directory hosts the LakeRide Pros branded integration of [HexGL](https://github.com/BKcore/HexGL).

## Local asset policy

Large upstream assets (audio, textures, fonts, geometry caches, etc.) are **not tracked** to keep the repository binary-free. When you need the offline build, download the upstream HexGL archive and copy the missing folders into `public/games/hexgl/`.

See [`docs/setup-hexgl-assets.md`](../../docs/setup-hexgl-assets.md) for step-by-step instructions.

## Customized files

Keep the following repo-managed files when updating HexGL assets:

- `index.html` — LRP launch overlay + branding (reuses `public/Color logo with background.svg`)
- `launch.js` — launch overlay dismissal logic
- `bkcore/hexgl/HexGL.js` — posts `HEXGL_SCORE` messages to the React portal
- `.gitignore` — prevents accidental commits of upstream binaries

After copying upstream files into this folder, run:

```bash
git restore public/games/hexgl/index.html \
  public/games/hexgl/launch.js \
  public/games/hexgl/bkcore/hexgl/HexGL.js
```

to bring back the custom branding.
