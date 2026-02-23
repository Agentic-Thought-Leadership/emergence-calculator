# Agents + Edges Risk Curve

An interactive React app that visualises the **Agents + Edges Risk Curve**. It always shows a **linear baseline** (adding agent risks together) and overlays a **connected-system curve** where coupling (edges) plus autonomy amplifies risk.

## What it does

Use the sliders to set:
- **Number of agents (N)**: total agents in the system
- **Autonomy score (1–10)**: higher autonomy increases effects authority and propagation pressure
- **K (max connections per new agent)**: caps how many existing agents each newly added agent connects to (interaction density)

The graph always shows:
- **Baseline (linear)**: additive risk as agents are added
- **Connected (agents + edges)**: baseline plus coupling and cascade amplification scaled by autonomy

## Model

Baseline:
- `R_linear(n) = n · r0`

Connected system:
- `R(n) = n · r0 + α · (E · L · A) + γ · (E · L · A)^2 / n`

Where:
- `E` is the number of edges (interactions) produced by a bounded-degree rule: each new agent adds up to `K` new connections
- `A` is the autonomy score (1–10)
- `L` is a load or busyness factor (fixed in this version)
- `r0`, `α`, `γ` are model parameters (fixed in this version)

## Download and run

### Option A: Clone with Git (recommended)

Prereqs:
- Node.js (LTS)
- Git

```bash
git clone https://github.com/<your-handle>/<your-repo>.git
cd <your-repo>
npm install
npm run dev
```

Open the URL printed in the terminal (typically `http://localhost:5173`).

### Option B: Download ZIP from GitHub

1. Open the repo on GitHub
2. Click **Code** then **Download ZIP**
3. Unzip it, then run:

```bash
cd <unzipped-folder>
npm install
npm run dev
```

## Build a production version

```bash
npm run build
npm run preview
```

This creates a production build in `dist/`.

## License

MIT. See `LICENSE`.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
