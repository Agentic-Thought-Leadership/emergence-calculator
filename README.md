# Emergence Risk Calculator

An interactive React app that estimates emergence risk using the **Agents + Edges Risk Curve**. It always shows a **linear baseline** (adding agent risks together) and overlays one or more **connected-system curves** where coupling (edges) plus autonomy amplifies risk.

Repository: `Agentic-Thought-Leadership/emergence-calculator`
<img width="1117" height="1045" alt="emergence-risk-calculator-example" src="https://github.com/user-attachments/assets/19287a28-ec11-45a4-aab8-50c41dccaf36" />

## What it does

Use the controls to set:
- **Number of agents (N)**: total agents in the system
- **Autonomy score (1–10)**: higher autonomy increases effects authority and cascade pressure
- **K (max connections per new agent)**: caps how many existing agents each newly added agent connects to
- **Topology**: changes how edges are formed (bounded degree, mesh, hub-and-spoke, pipeline)

The chart always shows:
- **Baseline (linear)**: additive risk as agents are added
- **Current (connected)**: connected-system risk based on edges, autonomy, and topology
- Optional: additional curves for pinned scenarios

The app highlights the **risk multiple** (connected divided by baseline) in the KPI area and inside the chart as `Risk ...x`.

## Key features

### Scenario compare
- **Add scenario** pins the current settings as an additional curve.
- **Load** applies a scenario back to the main controls.
- **Save** stores a scenario locally in your browser.
- Scenarios are capped at **8** for readability.

### Saved scenarios
Saved scenarios are stored in your browser **local storage** on your current machine.
- **Apply** loads it into the main controls.
- **Add** adds it to the comparison chart.
- **Delete** removes it from local storage.
- Saved scenarios are capped at **20**.

### Export CSV
Exports the full series (baseline, current curve, and scenario curves) to `emergence-risk-calculator.csv`.

### Shareable URL
The URL updates automatically with your current settings and pinned scenarios, so you can share a link that reproduces the view.

## Topology guidance

- **Bounded degree (k)**: default for production scale, caps integration per new agent
- **Full mesh**: stress test and upper bound, everyone connects to everyone
- **Hub-and-spoke**: orchestrator or control-plane pattern, hub concentrates systemic risk
- **Pipeline**: stage-gated workflow, minimal coupling and mostly downstream propagation

## Autonomy (1–10) guidance

Autonomy is effects authority, not intelligence:
1 Observe, 2 Classify, 3 Recommend, 4 Plan, 5 Coordinate, 6 Decide, 7 Execute, 8 Operate, 9 Optimise, 10 Self-direct.

## Model

Baseline:
- `R_linear(n) = n · r0`

Connected system:
- `R(n) = n · r0 + α · (E · L · A) + γ · (E · L · A)^2 / n`

Where:
- `E` is the number of edges (interactions), derived from the chosen topology and `K`
- `A` is the autonomy score (1–10)
- `L` is a load or busyness factor (fixed in this version)
- `r0`, `α`, `γ` are model parameters (fixed in this version)

## Download and run

Prereqs:
- Node.js (LTS)
- Git

Clone and run:
```bash
git clone https://github.com/Agentic-Thought-Leadership/emergence-calculator.git
cd emergence-calculator
npm install
npm run dev
