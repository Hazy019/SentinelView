"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#F8F9FC] text-[#0F172A] font-sans p-6 md:p-12 relative overflow-y-auto mesh-canvas">
      {/* Background Glow */}
      <div
        className="fixed inset-0 pointer-events-none select-none z-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 50% 10%, rgba(37, 99, 235, 0.05) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* Header Navigation */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <img
              src="/SentinelView_logo.png"
              alt="SentinelView Logo"
              className="w-8 h-8 object-contain rounded-md"
            />
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 font-sans">
              Sentinel<span className="text-[#2563EB]">_View</span>
              <span className="font-display italic font-normal text-slate-500 text-lg ml-2">{"// Documentation"}</span>
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm uppercase tracking-wider font-sans"
          >
            ← Console
          </Link>
        </div>


        {/* Introduction */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bento-card p-6 md:p-8 bg-white border border-slate-900/[0.06] rounded-2xl shadow-lg shadow-slate-200/50"
        >
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600 mb-3 font-mono">
            01. System Abstract
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 mb-4 font-sans">
            SentinelView is a real-time cybersecurity threat visualiser designed as a portfolio platform. 
            It models log packet flows, processes them against an active deterministic security rules engine, 
            and maps threat alerts onto a WebGL 3D Attack Globe.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-xs text-slate-600">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-900 uppercase block mb-1 font-mono">Objective</span>
              Provide high-frequency, real-time cyber situational awareness through visually rich, 3D spatial representations.
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-900 uppercase block mb-1 font-mono">Target Audience</span>
              Security operations center (SOC) analysts, visual presenters, and technical portfolio reviewers.
            </div>
          </div>
        </motion.section>

        {/* Rule Signatures */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bento-card p-6 md:p-8 bg-white border border-slate-900/[0.06] rounded-2xl shadow-lg shadow-slate-200/50"
        >
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600 mb-3 font-mono">
            02. Detection Signatures (Rules Engine)
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 mb-6 font-sans">
            The backend engine processes streaming logs against three core deterministic signatures using sliding time windows:
          </p>

          <div className="space-y-4">
            <div className="p-4 border-l-4 border-red-500 bg-red-50/60 rounded-r-xl">
              <h3 className="font-bold text-xs uppercase text-red-700 font-mono mb-1">🔒 Brute Force Storms</h3>
              <p className="text-xs leading-relaxed text-slate-700 font-sans">
                Triggered when a single source IP generates <strong>6 or more failed LOGIN actions (HTTP 401)</strong> within a rolling <strong>10-second window</strong>. Evaluates to MEDIUM confidence initially, ascending to HIGH if the storm persists.
              </p>
            </div>

            <div className="p-4 border-l-4 border-amber-500 bg-amber-50/60 rounded-r-xl">
              <h3 className="font-bold text-xs uppercase text-amber-700 font-mono mb-1">🌐 Port Scan Reconnaissance</h3>
              <p className="text-xs leading-relaxed text-slate-700 font-sans">
                Triggered when a single source IP initiates requests to <strong>12 or more distinct destination IPs</strong> within a rolling <strong>5-second window</strong>. Indicates system scanning.
              </p>
            </div>

            <div className="p-4 border-l-4 border-blue-500 bg-blue-50/60 rounded-r-xl">
              <h3 className="font-bold text-xs uppercase text-blue-700 font-mono mb-1">📤 Data Exfiltration</h3>
              <p className="text-xs leading-relaxed text-slate-700 font-sans">
                Triggered on any single <strong>TRANSFER action</strong> where the payload size (<code>bytes_sent</code>) exceeds <strong>10,000,000 bytes (10MB)</strong>. Flagged instantly on occurrence.
              </p>
            </div>
          </div>
        </motion.section>

        {/* System Architecture */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bento-card p-6 md:p-8 bg-white border border-slate-900/[0.06] rounded-2xl shadow-lg shadow-slate-200/50"
        >
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-blue-600 mb-3 font-mono">
            03. System Architecture & Tech Stack
          </h2>
          
          <div className="space-y-3.5 text-xs font-sans">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase font-mono">Frontend</span>
              <span className="text-slate-600 font-medium">Next.js 14, React Three Fiber (WebGL), TailwindCSS, Framer Motion</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase font-mono">Backend REST API</span>
              <span className="text-slate-600 font-medium">FastAPI (Python), Uvicorn Server, Pydantic Schema Validation</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase font-mono">Database Layer</span>
              <span className="text-slate-600 font-medium">aiosqlite (SQLite) in WAL mode, async batch write-queue</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase font-mono">Real-time Ingest</span>
              <span className="text-slate-600 font-medium">WebSockets (client-server) & HTTP REST (generator-server)</span>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono">
            <span className="text-blue-400 font-bold block mb-2">{"// DATA PIPELINE FLOW"}</span>
            {"[Generator App] --(HTTP POST Logs)--> [FastAPI /ingest] --(WS Push)--> [Next.js Client]"}
                                                       |
                                            {"(Enqueues Write)"}
                                                       {"v"}
                                             {"[SQLite Database WAL]"}
          </div>
        </motion.section>

        {/* External Integration & Ingestion API */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bento-card p-6 md:p-8 bg-white border border-blue-200/80 rounded-2xl shadow-lg shadow-slate-200/50"
        >
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#2563EB] mb-3 font-mono">
            04. External Integrations & Ingestion API
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 mb-6 font-sans">
            SentinelView can easily ingest live traffic and security events from any external website, server, API gateway, or log shipper:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="font-bold text-slate-900 uppercase font-mono block mb-1">⚡ Single & Batch REST Ingest</span>
              <p className="text-slate-600 leading-relaxed">
                External services send logs to <code>POST /api/v1/ingest</code> or bulk arrays up to 500 events to <code>POST /api/v1/ingest/batch</code>. Authenticated via JWT or static <code>X-API-Key</code> header.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="font-bold text-slate-900 uppercase font-mono block mb-1">🔔 Outbound Webhooks</span>
              <p className="text-slate-600 leading-relaxed">
                Configure <code>ALERT_WEBHOOK_URL</code> in backend <code>.env</code> to automatically push incident JSON payloads to Slack, Discord, PagerDuty, or SOAR playbooks.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="font-bold text-slate-900 uppercase font-mono block mb-1">📦 Log Shippers (Vector / Fluent Bit)</span>
              <p className="text-slate-600 leading-relaxed">
                Ship live NGINX, HAProxy, Envoy, or Kubernetes Ingress access logs directly into the SentinelView ingestion pipeline.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70">
              <span className="font-bold text-slate-900 uppercase font-mono block mb-1">🌐 Iframe & SOC Wallboard Embed</span>
              <p className="text-slate-600 leading-relaxed">
                Embed the live 3D threat radar and HUD metrics into executive wallboards, enterprise security portals, or public trust centers.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Limitations */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bento-card p-6 md:p-8 bg-white border border-red-200/80 rounded-2xl shadow-lg shadow-slate-200/50"
        >
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-red-600 mb-3 font-mono">
            05. Constraints & Architectural Considerations
          </h2>
          
          <ul className="list-disc list-inside space-y-3 text-xs leading-relaxed text-slate-600 font-sans">
            <li>
              <strong className="text-slate-900">Single-Worker Constraint:</strong> The backend runs with 1 Uvicorn worker to maintain lock-free in-memory sliding window state for low-latency rule evaluation.
            </li>
            <li>
              <strong className="text-slate-900">Ephemeral Storage:</strong> The local SQLite WAL database file persists across container restarts but resets on fresh cloud redeployments unless mounted to a persistent volume.
            </li>
            <li>
              <strong className="text-slate-900">Deterministic Rules:</strong> Threat classification utilizes deterministic mathematical window thresholds with 100% explainability and zero probabilistic hallucinations.
            </li>
            <li>
              <strong className="text-slate-900">Session Security:</strong> In-browser user tokens live strictly in memory to prevent persistent credential harvesting attacks.
            </li>
          </ul>
        </motion.section>

        {/* Footer */}
        <footer className="text-center py-6 text-xs text-slate-500 font-sans">
          SentinelView Documentation Console · Portfolio abstract & architecture.
        </footer>

      </div>
    </main>
  );
}

