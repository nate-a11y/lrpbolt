# HexGL Asset Setup

The Hyperloop (3D) panel embeds a locally hosted copy of [HexGL](https://github.com/BKcore/HexGL). The original build ships a large number of binary textures, audio files, and font bundles that we **do not** commit to this repository. Follow the steps below to fetch them into `public/games/hexgl/` before running a local build or deploying.

## 1. Download the HexGL bundle

1. Visit [https://github.com/BKcore/HexGL/archive/refs/heads/gh-pages.zip](https://github.com/BKcore/HexGL/archive/refs/heads/gh-pages.zip).
2. Extract the archive locally. The contents of the `gh-pages/` directory contain the game files.

## 2. Copy assets into the project

Copy the upstream folders listed below into `public/games/hexgl/`:

- `audio/`
- `css/`
- `geometries/`
- `bkcore/`
- `bkcore.coffee/`
- `libs/`
- `replays/`
- `textures/`
- `textures.full/`

The `.gitignore` in this directory prevents those assets from being committed.

## 3. Restore LakeRide Pros customizations

After copying the upstream files, restore our branded files so the launch overlay and score bridge stay intact:

```bash
git restore public/games/hexgl/index.html \
  public/games/hexgl/launch.js \
  public/games/hexgl/bkcore/hexgl/HexGL.js
```

The launch overlay pulls the logo from `public/Color logo with background.svg`, which already ships with the portal.

## 4. Verify the install marker

The React portal will only load the local iframe if the HexGL scripts are present. It probes `bkcore/hexgl/HUD.js` to confirm the bundle exists; if the file is missing it automatically streams the hosted demo and surfaces a development alert with a link back to this guide.

## 5. Test locally

Start the Vite dev server as usual:

```bash
npm install
npm run dev
```

Open the Hyperloop tab. If the local assets are present, the iframe will load `/games/hexgl/index.html`. If assets are missing, the app automatically streams the upstream build from `bkcore.github.io` and shows an alert in development mode.

## 6. Deploying

Before deploying to Hostinger/Firebase Hosting, verify that `public/games/hexgl/` contains the full asset set. Some hosting providers skip empty directories, so double-check that all folders above include files in the final build output.

## Troubleshooting

- **The iframe still loads bkcore.github.io** — Run a clean build (`rm -rf dist && npm run build`) to ensure the copied assets are included, then redeploy.
- **Textures are missing** — Confirm that `public/games/hexgl/textures/` and `public/games/hexgl/css/` are populated with files from the upstream archive.
- **Score auto-save fails** — Ensure that `public/games/hexgl/bkcore/hexgl/HexGL.js` includes the `HEXGL_SCORE` `postMessage` block; reapply the repo version if needed.
