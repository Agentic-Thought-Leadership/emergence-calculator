import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function safeInt(v, fallback) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function utf8ToB64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}

function b64ToUtf8(b64) {
  return decodeURIComponent(escape(window.atob(b64)));
}

function downloadTextFile(filename, text, mime) {
  const blob = new Blob([text], { type: mime });

  // Legacy / edge cases
  // eslint-disable-next-line no-undef
  if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
    // eslint-disable-next-line no-undef
    navigator.msSaveOrOpenBlob(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Delay cleanup so the download is not cancelled in some browsers.
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 800);
}

function stableId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const TOPOLOGIES = [
  { value: "bounded", label: "Bounded degree (k)" },
  { value: "mesh", label: "Full mesh" },
  { value: "hub", label: "Hub-and-spoke" },
  { value: "pipeline", label: "Pipeline" },
];

function edgesBoundedK(n, k) {
  let edges = 0;
  for (let i = 2; i <= n; i += 1) edges += Math.min(k, i - 1);
  return edges;
}

function edgesFullMesh(n) {
  return (n * (n - 1)) / 2;
}

function edgesHubAndSpoke(n, k) {
  if (k <= 0) return 0;
  let edges = 0;
  for (let i = 2; i <= n; i += 1) {
    const extra = Math.min(Math.max(0, k - 1), i - 2);
    edges += 1 + extra;
  }
  return edges;
}

function edgesPipeline(n, k) {
  if (k <= 0) return 0;
  return Math.max(0, n - 1);
}

function computeEdges(n, k, topology) {
  switch (topology) {
    case "mesh":
      return edgesFullMesh(n);
    case "hub":
      return edgesHubAndSpoke(n, k);
    case "pipeline":
      return edgesPipeline(n, k);
    case "bounded":
    default:
      return edgesBoundedK(n, k);
  }
}

function riskLinear(n, r0) {
  return n * r0;
}

function riskAgentsEdges({ n, k, topology, autonomyScore, r0, loadL, alpha, gamma }) {
  const E = computeEdges(n, k, topology);
  const A = autonomyScore;
  const coupling = E * loadL * A;
  return n * r0 + alpha * coupling + gamma * (coupling * coupling) / n;
}

function topoLabel(value) {
  return TOPOLOGIES.find((t) => t.value === value)?.label || value;
}

function scenarioToQuery(s) {
  return {
    id: s.id,
    name: s.name,
    n: s.n,
    autonomy: s.autonomy,
    k: s.k,
    topology: s.topology,
  };
}

function formatMultiple(m) {
  return `${Math.round(m).toLocaleString()}x`;
}

const DEFAULTS = {
  r0: 1,
  loadL: 1.3,
  alpha: 0.3,
  gamma: 0.12,
};

const NL = String.fromCharCode(13, 10);
const SAVED_KEY = "agents_edges_saved_scenarios_v1";

function buildShareUrl({ n, autonomy, k, topology, scenarios }) {
  const params = new URLSearchParams();
  params.set("n", String(n));
  params.set("a", String(autonomy));
  params.set("k", String(k));
  params.set("t", String(topology));

  if (scenarios?.length) {
    const payload = JSON.stringify(scenarios.map(scenarioToQuery));
    params.set("sc", utf8ToB64(payload));
  }

  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?${params.toString()}`;
}

function readInitialStateFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const n = clamp(safeInt(params.get("n"), 30), 1, 200);
  const autonomy = clamp(safeInt(params.get("a"), 5), 1, 10);
  const k = clamp(safeInt(params.get("k"), 3), 0, n - 1);

  const topologyRaw = params.get("t") || "bounded";
  const topology = TOPOLOGIES.some((t) => t.value === topologyRaw) ? topologyRaw : "bounded";

  let scenarios = [];
  const sc = params.get("sc");
  if (sc) {
    try {
      const parsed = JSON.parse(b64ToUtf8(sc));
      if (Array.isArray(parsed)) {
        scenarios = parsed
          .map((x) => ({
            id: String(x.id || stableId()),
            name: String(x.name || "Scenario"),
            n: clamp(safeInt(x.n, 30), 1, 200),
            autonomy: clamp(safeInt(x.autonomy, 5), 1, 10),
            k: clamp(safeInt(x.k, 3), 0, 199),
            topology: TOPOLOGIES.some((t) => t.value === x.topology) ? x.topology : "bounded",
          }))
          .slice(0, 8);
      }
    } catch {
      scenarios = [];
    }
  }

  scenarios = scenarios.map((s) => ({ ...s, k: clamp(s.k, 0, s.n - 1) }));

  return { n, autonomy, k, topology, scenarios };
}

function buildCsv({ rows, scenarioKeys }) {
  const header = [
    "agents",
    "baseline_linear",
    "current_connected",
    "current_multiple",
    ...scenarioKeys.flatMap((sk) => [`${sk}_connected`, `${sk}_multiple`]),
  ];

  const lines = [header.join(",")];

  for (const r of rows) {
    const baseline = r.baseline;
    const current = r.current;
    const currentMultiple = baseline > 0 && current != null ? current / baseline : "";

    const cols = [r.agents, baseline, current ?? "", currentMultiple];

    for (const sk of scenarioKeys) {
      const v = r[sk];
      if (v == null || !Number.isFinite(v)) {
        cols.push("", "");
      } else {
        cols.push(v, baseline > 0 ? v / baseline : "");
      }
    }

    lines.push(cols.join(","));
  }

  return lines.join(NL);
}

function hslColorForIndex(idx) {
  const hue = (idx * 57) % 360;
  return `hsl(${hue} 70% 40%)`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const baseline = payload.find((p) => p.dataKey === "baseline")?.value;

  return (
    <div className="rounded-xl bg-white p-3 text-xs shadow-lg ring-1 ring-slate-200">
      <div className="mb-2 text-sm font-medium text-slate-900">n = {label}</div>
      <div className="space-y-1">
        {payload
          .filter((p) => p.value != null)
          .map((p) => {
            const v = p.value;
            const mult = baseline && baseline > 0 && p.dataKey !== "baseline" ? v / baseline : null;
            return (
              <div key={p.dataKey} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  <span className="text-slate-700">{p.name}</span>
                </div>
                <div className="text-right tabular-nums text-slate-900">
                  {Number.isFinite(v) ? v.toFixed(2) : ""}
                  {mult != null ? <span className="ml-2 font-semibold text-slate-700">({formatMultiple(mult)})</span> : null}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function RiskMultiplePillLabel({ x, y, text }) {
  const px = Number(x);
  const py = Number(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

  const labelText = String(text || "");
  if (!labelText) return null;

  const fontSize = 12;
  const paddingX = 10;
  const paddingY = 6;
  const approxCharW = 7;
  const w = labelText.length * approxCharW + paddingX * 2;
  const h = fontSize + paddingY * 2;

  const rightPad = 10;
  const rectX = px - w - rightPad;
  const rectY = py - h / 2;
  const textX = rectX + w / 2;

  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={rectX} y={rectY} width={w} height={h} rx={10} ry={10} fill="#0f172a" opacity={0.95} />
      <text x={textX} y={py} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fill="#ffffff" fontWeight={700}>
        {labelText}
      </text>
    </g>
  );
}

export default function AgentsEdgesRiskCurveApp() {
  const initial = useRef(null);
  if (initial.current == null && typeof window !== "undefined") {
    initial.current = readInitialStateFromUrl();
  }

  const [nAgents, setNAgents] = useState(initial.current?.n ?? 30);
  const [autonomy, setAutonomy] = useState(initial.current?.autonomy ?? 5);
  const [k, setK] = useState(initial.current?.k ?? 3);
  const [topology, setTopology] = useState(initial.current?.topology ?? "bounded");
  const [scenarios, setScenarios] = useState(initial.current?.scenarios ?? []);

  const [savedScenarios, setSavedScenarios] = useState([]);

  const safeN = clamp(Number(nAgents) || 1, 1, 200);
  const safeAutonomy = clamp(Number(autonomy) || 1, 1, 10);
  const safeK = clamp(Number(k) || 0, 0, safeN - 1);
  const safeTopology = TOPOLOGIES.some((t) => t.value === topology) ? topology : "bounded";

  // Load saved scenarios from localStorage.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .map((x) => ({
            id: String(x.id || stableId()),
            name: String(x.name || "Saved"),
            n: clamp(safeInt(x.n, 30), 1, 200),
            autonomy: clamp(safeInt(x.autonomy, 5), 1, 10),
            k: clamp(safeInt(x.k, 3), 0, 199),
            topology: TOPOLOGIES.some((t) => t.value === x.topology) ? x.topology : "bounded",
          }))
          .map((s) => ({ ...s, k: clamp(s.k, 0, s.n - 1) }))
          .slice(0, 20);
        setSavedScenarios(cleaned);
      }
    } catch {
      // ignore
    }
  }, []);

  // Keep URL in sync for sharing.
  useEffect(() => {
    const url = buildShareUrl({
      n: safeN,
      autonomy: safeAutonomy,
      k: safeK,
      topology: safeTopology,
      scenarios,
    });
    window.history.replaceState(null, "", url);
  }, [safeN, safeAutonomy, safeK, safeTopology, scenarios]);

  const maxN = useMemo(() => {
    const scenarioMax = scenarios.reduce((m, s) => Math.max(m, s.n), 0);
    return Math.max(safeN, scenarioMax, 1);
  }, [safeN, scenarios]);

  const scenarioLineKeys = useMemo(() => scenarios.map((s) => `s_${s.id}`), [scenarios]);

  const chartRows = useMemo(() => {
    const rows = [];
    const scenarioByKey = new Map();
    scenarios.forEach((s) => scenarioByKey.set(`s_${s.id}`, s));

    for (let i = 1; i <= maxN; i += 1) {
      const baseline = riskLinear(i, DEFAULTS.r0);

      const current = i <= safeN
        ? riskAgentsEdges({
            n: i,
            k: safeK,
            topology: safeTopology,
            autonomyScore: safeAutonomy,
            ...DEFAULTS,
          })
        : null;

      const row = { agents: i, baseline, current };

      for (const key of scenarioLineKeys) {
        const s = scenarioByKey.get(key);
        row[key] = i <= s.n
          ? riskAgentsEdges({
              n: i,
              k: clamp(s.k, 0, s.n - 1),
              topology: s.topology,
              autonomyScore: s.autonomy,
              ...DEFAULTS,
            })
          : null;
      }

      rows.push(row);
    }

    return rows;
  }, [maxN, safeN, safeK, safeTopology, safeAutonomy, scenarios, scenarioLineKeys]);

  const finalRow = chartRows[Math.min(safeN, chartRows.length) - 1] || { baseline: 0, current: 0 };
  const finalBaseline = finalRow.baseline || 0;
  const finalConnected = Number.isFinite(finalRow.current) ? finalRow.current : 0;
  const finalMultiple = finalBaseline > 0 ? finalConnected / finalBaseline : 0;

  const yMax = useMemo(() => {
    let max = 0;
    for (const r of chartRows) {
      if (Number.isFinite(r.baseline)) max = Math.max(max, r.baseline);
      if (Number.isFinite(r.current)) max = Math.max(max, r.current);
      for (const key of scenarioLineKeys) {
        const v = r[key];
        if (Number.isFinite(v)) max = Math.max(max, v);
      }
    }
    return max > 0 ? max : 1;
  }, [chartRows, scenarioLineKeys]);

  // Place the risk label between the top of the y-range and the x-axis.
  const riskLabelY = yMax * 0.65;

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildShareUrl({
      n: safeN,
      autonomy: safeAutonomy,
      k: safeK,
      topology: safeTopology,
      scenarios,
    });
  }, [safeN, safeAutonomy, safeK, safeTopology, scenarios]);

  function addScenario() {
    setScenarios((prev) => {
      const nextIdx = prev.length + 1;
      const name = `Scenario ${nextIdx}`;
      return [
        ...prev,
        {
          id: stableId(),
          name,
          n: safeN,
          autonomy: safeAutonomy,
          k: safeK,
          topology: safeTopology,
        },
      ].slice(0, 8);
    });
  }

  function loadScenario(s) {
    setNAgents(s.n);
    setAutonomy(s.autonomy);
    setK(s.k);
    setTopology(s.topology);
  }

  function persistSaved(list) {
    setSavedScenarios(list);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  function saveScenario(s) {
    // Save a copy, so curve ids remain unique.
    const item = {
      id: stableId(),
      name: s.name || "Saved",
      n: s.n,
      autonomy: s.autonomy,
      k: s.k,
      topology: s.topology,
    };

    persistSaved([item, ...savedScenarios].slice(0, 20));
  }

  function applySaved(s) {
    loadScenario(s);
  }

  function addSavedToCompare(s) {
    setScenarios((prev) => {
      const name = s.name || `Scenario ${prev.length + 1}`;
      return [
        ...prev,
        { id: stableId(), name, n: s.n, autonomy: s.autonomy, k: s.k, topology: s.topology },
      ].slice(0, 8);
    });
  }

  function deleteSaved(id) {
    persistSaved(savedScenarios.filter((x) => x.id !== id));
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      const el = document.getElementById("copy-status");
      if (el) {
        el.textContent = "Copied";
        setTimeout(() => {
          el.textContent = "";
        }, 1200);
      }
    } catch {
      window.prompt("Copy this URL", shareUrl);
    }
  }

  function exportCsv() {
    const csv = buildCsv({ rows: chartRows, scenarioKeys: scenarioLineKeys });
    downloadTextFile("agents-edges-risk-curve.csv", csv, "text/csv;charset=utf-8");
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Agents + Edges Risk Curve</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Baseline is always linear (agents summed). Connected risk adds edge coupling plus cascade amplification, scaled by autonomy and topology.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-medium">Number of agents</div>
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={1} max={200} value={safeN} onChange={(e) => setNAgents(e.target.value)} className="w-full" />
              <input type="number" min={1} max={200} value={safeN} onChange={(e) => setNAgents(e.target.value)} className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
            </div>
            <div className="mt-3 text-xs text-slate-500">Range: 1 to 200</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-medium">Autonomy score (1 to 10)</div>
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={1} max={10} value={safeAutonomy} onChange={(e) => setAutonomy(e.target.value)} className="w-full" />
              <input type="number" min={1} max={10} value={safeAutonomy} onChange={(e) => setAutonomy(e.target.value)} className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
            </div>
            <div className="mt-3 text-xs text-slate-500">Higher autonomy increases effects authority and cascade intensity.</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-medium">K (max connections per new agent)</div>
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={0} max={Math.max(0, safeN - 1)} value={safeK} onChange={(e) => setK(e.target.value)} className="w-full" />
              <input type="number" min={0} max={Math.max(0, safeN - 1)} value={safeK} onChange={(e) => setK(e.target.value)} className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
            </div>
            <div className="mt-3 text-xs text-slate-500">k=0 means no edges. Higher k increases interaction density.</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm font-medium">Topology</div>
            <div className="mt-2">
              <select value={safeTopology} onChange={(e) => setTopology(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                {TOPOLOGIES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="mt-3 text-xs text-slate-500">Changes how edges E(n) are formed, affecting coupling and cascades.</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={addScenario} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm">Add scenario</button>
            <button onClick={() => setScenarios([])} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-200">Clear scenarios</button>
            <button onClick={copyShareUrl} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-200">
              Copy share URL <span id="copy-status" className="ml-2 text-xs text-slate-500" />
            </button>
            <button onClick={exportCsv} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-200">Export CSV</button>
          </div>

          <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="tabular-nums">
                <span className="text-slate-500">At n={safeN}:</span>{" "}
                <span className="font-medium">baseline {finalBaseline.toFixed(2)}</span>
              </div>
              <div className="tabular-nums">
                <span className="text-slate-500">connected:</span>{" "}
                <span className="font-medium">{finalConnected.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">risk multiple:</span>
                <span className="rounded-lg bg-slate-900 px-2 py-1 text-sm font-semibold text-white tabular-nums">
                  {formatMultiple(finalMultiple)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {scenarios.length ? (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Scenario compare</div>
                <div className="mt-1 text-xs text-slate-500">Add scenarios to overlay multiple connected curves. Load applies a scenario to the main controls. Save stores it locally.</div>
              </div>
              <div className="text-xs text-slate-500">Max scenarios: 8</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {scenarios.map((s, idx) => (
                <div key={s.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: hslColorForIndex(idx + 1) }} />
                        <input
                          value={s.name}
                          onChange={(e) => setScenarios((prev) => prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="mt-2 text-xs text-slate-600">n={s.n}, A={s.autonomy}, k={s.k}, {topoLabel(s.topology)}</div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <button onClick={() => loadScenario(s)} className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm ring-1 ring-slate-200">Load</button>
                      <button onClick={() => saveScenario(s)} className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm ring-1 ring-slate-200">Save</button>
                      <button onClick={() => setScenarios((prev) => prev.filter((x) => x.id !== s.id))} className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm ring-1 ring-slate-200">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {savedScenarios.length ? (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Saved scenarios</div>
                <div className="mt-1 text-xs text-slate-500">Stored in your browser local storage on this machine.</div>
              </div>
              <div className="text-xs text-slate-500">Max saved: 20</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {savedScenarios.map((s) => (
                <div key={s.id} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">{s.name}</div>
                      <div className="mt-1 text-xs text-slate-600">n={s.n}, A={s.autonomy}, k={s.k}, {topoLabel(s.topology)}</div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button onClick={() => applySaved(s)} className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm ring-1 ring-slate-200">Apply</button>
                      <button onClick={() => addSavedToCompare(s)} className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm ring-1 ring-slate-200">Add</button>
                      <button onClick={() => deleteSaved(s.id)} className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm ring-1 ring-slate-200">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Risk curve</div>
              <div className="mt-1 text-xs text-slate-500">Model: R(n) = n·r0 + α·(E·L·A) + γ·(E·L·A)^2 / n, where E is derived from topology and k.</div>
            </div>
            <div className="text-right text-xs text-slate-500">Assumptions: r0={DEFAULTS.r0}, L={DEFAULTS.loadL}, α={DEFAULTS.alpha}, γ={DEFAULTS.gamma}</div>
          </div>

          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={{ top: 12, right: 70, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="agents" type="number" domain={[1, maxN]} allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />

                <Line type="monotone" dataKey="baseline" name="Baseline (linear)" stroke="#0f172a" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="current" name="Current (connected)" stroke={hslColorForIndex(0)} strokeWidth={2.5} dot={false} connectNulls={false} />

                {scenarios.map((s, idx) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={`s_${s.id}`}
                    name={s.name || `Scenario ${idx + 1}`}
                    stroke={hslColorForIndex(idx + 1)}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ))}

                <ReferenceDot
                  x={safeN}
                  y={riskLabelY}
                  r={3}
                  isFront
                  fill="transparent"
                  stroke="transparent"
                  ifOverflow="extendDomain"
                  label={(p) => (
                    <RiskMultiplePillLabel
                      x={p?.viewBox?.x ?? p?.cx ?? p?.x}
                      y={p?.viewBox?.y ?? p?.cy ?? p?.y}
                      text={`Risk ${formatMultiple(finalMultiple)}`}
                    />
                  )}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-xs font-medium text-slate-700">Scenario compare</div>
              <div className="mt-1 text-xs text-slate-600">Add scenarios to overlay multiple connected curves on the same baseline.</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-xs font-medium text-slate-700">Topology selector</div>
              <div className="mt-1 text-xs text-slate-600">Choose bounded degree, mesh, hub-and-spoke, or pipeline to change edge formation.</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="text-xs font-medium text-slate-700">Export CSV and shareable URL</div>
              <div className="mt-1 text-xs text-slate-600">Export baseline and all curves to CSV. Copy the URL to reproduce the same view and scenarios.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
