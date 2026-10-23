# Lobhas Paithankar — Portfolio

An Angular single-page portfolio with responsive Home, About, and Contact pages. The About page contains an interactive D3.js tree of experience, projects, skills, and certifications.

## Features

- Responsive layouts for phone, tablet, and desktop
- Hash-based navigation for GitHub Pages compatibility
- Interactive About tree with search, expand/collapse, pan, zoom, Fit, and Reset controls
- Contact links and social profiles
- Reduced-motion support and keyboard-accessible tree controls

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

The production build is written to `docs/` and uses `/portfolio/` as its base path for GitHub Pages. Publish the contents of `docs/` to deploy the site.
