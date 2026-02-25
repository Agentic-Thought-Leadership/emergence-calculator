# Agents + Edges Risk Curve

An interactive React app that visualises the **Agents + Edges Risk Curve**. It always shows a **linear baseline** (adding agent risks together) and overlays one or more **connected-system curves** where coupling (edges) plus autonomy amplifies risk.

This repo is published as **emergence-calculator** under the Agentic Thought Leadership organisation.

## What it does

Use the controls to set:
- **Number of agents (N)**: total agents in the system
- **Autonomy score (1–10)**: higher autonomy increases effects authority and propagation pressure
- **K (max connections per new agent)**: caps how many existing agents each newly added agent connects to (interaction density)
- **Topology**: changes how edges are formed (bounded degree, mesh, hub-and-spoke, pipeline)

The main chart always shows:
- **Baseline (linear)**: additive risk as agents are added
- **Current (connected)**: baseline plus coupling and cascade amplification scaled by autonomy and topology
- Optional: additional curves for pinned scenarios

The app also shows the **risk multiple** (connected divided by baseline) as:
- a highlighted KPI, and
- a label inside the chart (for the current N)

## Key features

### Scenario compare
- **Add scenario** pins the current settings as an additional curve.
- **Load** applies a scenario back to the main controls.
- **Save** stores a scenario locally in your browser (local storage) on your current machine.
- Scenarios are capped at **8** for readability.

### Saved scenarios (local only)
Saved scenarios are stored in your browser **local storage** (not in GitHub, not shared across devices).

You can:
- **Apply**: load into main controls
- **Add**: add to the comparison chart
- **Delete**: remove from local storage

### Export CSV
Exports the full series (baseline, current connected curve, and scenario curves) to a CSV file.

### Shareable URL
The URL updates automatically with your current settings and pinned scenarios, so you can share a link that reproduces the view.

## Model

Baseline:
- `R_linear(n) = n · r0`

Connected system:
- `R(n) = n · r0 + α · (E · L · A) + γ · (E · L · A)^2 / n`

Where:
- `E` is the number of edges (interactions), derived from the chosen topology and `K`
- `A` is the autonomy score (1–10)
- `L` is a load/busyness factor (fixed in this version)
- `r0`, `α`, `γ` are model parameters (fixed in this version)

## Download and run

### Option A: Clone with Git (recommended)

Prereqs:
- Node.js (LTS)
- Git

```bash
git clone https://github.com/Agentic-Thought-Leadership/emergence-calculator.git
cd emergence-calculator
npm install
npm run dev
