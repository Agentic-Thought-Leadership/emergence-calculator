import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function edgesBoundedK(n, k) {
  // Each new agent (2..n) connects to up to k existing agents.
  let edges = 0;
  for (let i = 2; i <= n; i += 1) edges += Math.min(k, i - 1);
  return edges;
}

function riskLinear(n, r0 = 1) {
  return n * r0;
}

function riskAgentsEdges({ n, k, autonomyScore, r0, loadL, alpha, gamma }) {
  const E = edgesBoundedK(n, k);
  const A = autonomyScore; // 1..10 scaling factor
  const coupling = E * loadL * A;
  return n * r0 + alpha * coupling + gamma * (coupling * coupling) / n;
}

const DEFAULTS = {
  r0: 1,
  loadL: 1.3,
  alpha: 0.3,
  gamma: 0.12,
};

export default function AgentsEdgesRiskCurveApp() {
  const [nAgents, setNAgents] = useState(30);
  const [autonomy, setAutonomy] = useState(5);
  const [k, setK] = useState(3);
  const [showRatio, setShowRatio] = useState(false);

  const safeN = clamp(Number(nAgents) || 1, 1, 200);
  const safeAutonomy = clamp(Number(autonomy) || 1, 1, 10);
  const safeK = clamp(Number(k) || 0, 0, safeN - 1);

  const data = useMemo(() => {
    const rows = [];
    for (let i = 1; i <= safeN; i += 1) {
      const linear = riskLinear(i, DEFAULTS.r0);
      const connected = riskAgentsEdges({
        n: i,
        k: safeK,
        autonomyScore: safeAutonomy,
        ...DEFAULTS,
      });
      rows.push({
        agents: i,
        linear,
        connected,
        ratio: connected / (linear || 1),
      });
    }
    return rows;
  }, [safeN, safeK, safeAutonomy]);

  const final = data[data.length - 1] || {
    linear: 0,
    connected: 0,
    ratio: 0,
  };

  const yKeyLinear = showRatio ? "baseline" : "linear";
  const yKeyConnected = showRatio ? "ratio" : "connected";

  const chartData = useMemo(() => {
    if (!showRatio) return data;
    return data.map((d) => ({
      agents: d.agents,
      baseline: 1,
      ratio: d.ratio,
    }));
  }, [data, showRatio]);

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Agents + Edges Risk Curve
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Baseline is always linear (agents summed). Connected risk adds edge
            coupling plus cascade amplification, scaled by autonomy.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-medium">Number of agents</div>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={200}
                value={safeN}
                onChange={(e) => setNAgents(e.target.value)}
                className="w-full"
              />
              <input
                type="number"
                min={1}
                max={200}
                value={safeN}
                onChange={(e) => setNAgents(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
            </div>
            <div className="mt-3 text-xs text-slate-500">Range: 1 to 200</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-medium">Autonomy score (1 to 10)</div>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={10}
                value={safeAutonomy}
                onChange={(e) => setAutonomy(e.target.value)}
                className="w-full"
              />
              <input
                type="number"
                min={1}
                max={10}
                value={safeAutonomy}
                onChange={(e) => setAutonomy(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Higher autonomy increases effects authority and cascade intensity.
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-medium">K (max connections per new agent)</div>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={Math.max(0, safeN - 1)}
                value={safeK}
                onChange={(e) => setK(e.target.value)}
                className="w-full"
              />
              <input
                type="number"
                min={0}
                max={Math.max(0, safeN - 1)}
                value={safeK}
                onChange={(e) => setK(e.target.value)}
                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
            </div>
            <div className="mt-3 text-xs text-slate-500">
              k=0 means no edges. k=n-1 approximates dense coupling.
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showRatio}
              onChange={(e) => setShowRatio(e.target.checked)}
            />
            Show ratio vs baseline (baseline fixed at 1)
          </label>

          <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div>
                <span className="text-slate-500">At n={safeN}:</span>{" "}
                <span className="font-medium">
                  baseline {final.linear.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">connected:</span>{" "}
                <span className="font-medium">
                  {final.connected.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500">multiple:</span>{" "}
                <span className="font-medium">{final.ratio.toFixed(2)}x</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Risk curve</div>
              <div className="mt-1 text-xs text-slate-500">
                Model: R(n) = n·r0 + α·(E·L·A) + γ·(E·L·A)^2 / n, where E is bounded by k.
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              Assumptions: r0={DEFAULTS.r0}, L={DEFAULTS.loadL}, α={DEFAULTS.alpha}, γ={DEFAULTS.gamma}
            </div>
          </div>

          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="agents" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={yKeyLinear}
                  name={showRatio ? "Baseline (fixed at 1)" : "Baseline (linear)"}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={yKeyConnected}
                  name={showRatio ? "Connected multiple" : "Connected (agents + edges)"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-xs font-medium text-slate-700">Interpretation</div>
              <div className="mt-1 text-xs text-slate-600">
                Baseline is additive. Connected risk rises with edges (E) and autonomy (A), and can accelerate under load via the cascade term.
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-xs font-medium text-slate-700">What k does</div>
              <div className="mt-1 text-xs text-slate-600">
                k constrains interaction density. Lower k approximates routed or hub topologies. Higher k approximates dense peer coupling.
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-xs font-medium text-slate-700">What autonomy does</div>
              <div className="mt-1 text-xs text-slate-600">
                Autonomy scales effects authority and propagation. Higher autonomy makes the same topology riskier, especially under load.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
