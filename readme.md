# Lobhas Paithankar — Portfolio

An Angular single-page portfolio with responsive Home, About, and Contact pages. The About page contains an interactive D3.js tree of experience, projects, skills, and certifications.

## Features

- Home with the two-column desktop layout on wide screens and adaptive layouts for phones, tablets, and portrait monitors
- Interactive About tree with search, expand/collapse, pan, zoom, Fit, and Reset controls
- Contact links and social profiles
- Hash-based navigation for GitHub Pages compatibility
- Reduced-motion support and keyboard-accessible tree controls

## Responsive behavior

The layout is tuned for modern aspect ratios, not just 16:9:

- **Desktop and ultrawide (16:9, 16:10, 21:9, 32:9):** Home keeps its original two-column composition; the About tree stays centred with evenly spaced levels.
- **Phones and tall phones (16:9 through 24:9):** Home switches to a single readable column; the About header, search bar, and instructions stay clear of the tree.
- **Portrait tablets and portrait monitors (4:3, 16:10, 9:16, 5:8):** Home uses a centred single column with viewport-scaled type and a subdued background illustration instead of a side-by-side split.
- **Short landscape windows (phones held sideways, split-screen, short ultrawide):** Home lets the intro scroll instead of clipping, and About trims supporting copy so the tree keeps a usable area.

The About tree keeps sibling levels uniform and prevents label overlap at every depth by measuring the rendered text, widening only the gaps that need it, and measuring header/toolbar heights at runtime before fitting the diagram.

## Requirements

- Node.js and npm
- A modern browser

## Run locally

```sh
npm install
npm start
```

Open the local URL printed by Angular CLI (usually `http://localhost:4200/portfolio/`).

## Checks

```sh
npm run build
npm test -- --watch=false
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.spec.json
```

## Build and deploy

```sh
npm run build
```

The production build is written to `docs/` and uses `/portfolio/` as its base path for GitHub Pages. Commit the rebuilt `docs/` output and publish it from the `master` branch to deploy at <https://lobhasap.github.io/portfolio/>.
