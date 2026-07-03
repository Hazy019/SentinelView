"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function DocsPage() {
  return (
    <main className="scanlines min-h-screen bg-[var(--color-bg)] cyber-grid-overlay text-slate-300 font-mono p-6 md:p-12 relative overflow-y-auto">
      {/* Background Glow */}
      <div
        className="absolute inset-0 pointer-events-none select-none z-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 50% 10%, rgba(0, 229, 255, 0.05) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* Header Navigation */}
        <div className="flex justify-between items-center pb-4 border-b border-white/10">
          <h1 className="text-xl font-bold uppercase tracking-wider text-white">
            <span className="gradient-text">Sentinel</span>_View // Documentation
          </h1>
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded border border-cyan-500/20 hover:border-cyan-400 text-cyan-400 hover:bg-cyan-950/20 transition-all duration-300 uppercase tracking-widest"
          >
            ← Console
          </Link>
        </div>

        {/* Introduction */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="cyber-panel-rhyme p-6 md:p-8"
        >
          <span className="absolute top-2 left-2 text-[8px] text-cyan-500/30 font-mono select-none pointer-events-none">+</span>
          <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400 mb-4">
            01. System Abstract
          </h2>
          <p className="text-xs leading-relaxed op-medium mb-4">
            SentinelView is a real-time cybersecurity threat visualiser designed as a portfolio platform. 
            It models log packet flows, processes them against an active deterministic security rules engine, 
            and maps threat alerts onto a WebGL 3D Attack Globe.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-[11px] text-slate-400">
            <div className="p-3 bg-white/5 rounded border border-white/5">
              <span className="font-bold text-white uppercase block mb-1">Objective</span>
              Provide high-frequency, real-time cyber situational awareness through visually rich, 3D spatial representations.
            </div>
            <div className="p-3 bg-white/5 rounded border border-white/5">
              <span className="font-bold text-white uppercase block mb-1">Target Audience</span>
              Security operations center (SOC) analysts, visual presenters, and technical portfolio reviewers.
            </div>
          </div>
        </motion.section>

        {/* Rule Signatures */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="cyber-panel-rhyme p-6 md:p-8"
        >
          <span className="absolute top-2 left-2 text-[8px] text-cyan-500/30 font-mono select-none pointer-events-none">+</span>
          <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400 mb-4">
            02. Detection Signatures (Rules Engine)
          </h2>
          <p className="text-xs leading-relaxed op-medium mb-6">
            The backend engine processes streaming logs against three core deterministic signatures using sliding time windows:
          </p>

          <div className="space-y-4">
            <div className="p-4 border-l-2 border-[var(--color-danger)] bg-[var(--color-danger-dim)] rounded-r">
              <h3 className="font-bold text-xs uppercase text-white font-mono mb-1">🔒 Brute Force Storms</h3>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Triggered when a single source IP generates **6 or more failed LOGIN actions (HTTP 401)** within a rolling **10-second window**. Evaluates to MEDIUM confidence initially, ascending to HIGH if the storm persists.
              </p>
            </div>

            <div className="p-4 border-l-2 border-[var(--color-warn)] bg-[var(--color-warn-dim)] rounded-r">
              <h3 className="font-bold text-xs uppercase text-white font-mono mb-1">🌐 Port Scan Reconnaissance</h3>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Triggered when a single source IP initiates requests to **12 or more distinct destination IPs** within a rolling **5-second window**. Indicates system scanning.
              </p>
            </div>

            <div className="p-4 border-l-2 border-[var(--color-accent)] bg-[var(--color-accent-dim)] rounded-r">
              <h3 className="font-bold text-xs uppercase text-white font-mono mb-1">📤 Data Exfiltration</h3>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Triggered on any single **TRANSFER action** where the payload size (`bytes_sent`) exceeds **10,000,000 bytes (10MB)**. Flagged instantly on occurrence.
              </p>
            </div>
          </div>
        </motion.section>

        {/* System Architecture */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="cyber-panel-rhyme p-6 md:p-8"
        >
          <span className="absolute top-2 left-2 text-[8px] text-cyan-500/30 font-mono select-none pointer-events-none">+</span>
          <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400 mb-4">
            03. System Architecture & Tech Stack
          </h2>
          
          <div className="space-y-4 text-xs">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-bold text-white uppercase">Frontend</span>
              <span>Next.js 14, React Three Fiber (WebGL), TailwindCSS, Framer Motion</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-bold text-white uppercase">Backend REST API</span>
              <span>FastAPI (Python), Uvicorn Server, Pydantic Schema Validation</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-bold text-white uppercase">Database Layer</span>
              <span>aiosqlite (SQLite) in WAL mode, async batch write-queue</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="font-bold text-white uppercase">Real-time Ingest</span>
              <span>WebSockets (client-server) & HTTP REST (generator-server)</span>
            </div>
          </div>

          <div className="mt-6 p-4 rounded bg-[#05090f] border border-white/5 text-[10px] text-slate-400 font-mono">
            <span className="text-cyan-400 font-bold block mb-2">{"// DATA PIPELINE FLOW"}</span>
            {"[Generator App] --(HTTP POST Logs)--> [FastAPI /ingest] --(WS Push)--> [Next.js Client]"}
                                                       |
                                            {"(Enqueues Write)"}
                                                       {"v"}
                                            {"[SQLite Database WAL]"}
          </div>
        </motion.section>

        {/* Limitations */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="cyber-panel-rhyme p-6 md:p-8 border border-red-500/20"
        >
          <span className="absolute top-2 left-2 text-[8px] text-red-500/30 font-mono select-none pointer-events-none">+</span>
          <h2 className="text-sm font-bold uppercase tracking-widest text-red-400 mb-4">
            04. Constraints & Architectural Limitations
          </h2>
          
          <ul className="list-disc list-inside space-y-3 text-xs leading-relaxed op-medium text-slate-300">
            <li>
              <strong className="text-white">Single-Worker Constraint:</strong> The backend MUST run with exactly 1 Uvicorn worker. Sliding-window states and WebSocket mappings are kept in process-memory; horizontal scaling is currently unsupported.
            </li>
            <li>
              <strong className="text-white">Ephemeral Storage:</strong> The local SQLite WAL database files persist only within active container lifespans. Redeployments will reset logs and alert histories unless mounted onto a persistent cloud storage block.
            </li>
            <li>
              <strong className="text-white">Deterministic Rules:</strong> Threat classification utilizes hardcoded logic thresholds—there are no machine learning (ML) or heuristic engines in this version.
            </li>
            <li>
              <strong className="text-white">Session Lifetime:</strong> Session tokens are held strictly in browser client memory for anti-backdoor protection, meaning reloads will require logging in again.
            </li>
          </ul>
        </motion.section>

        {/* Footer */}
        <footer className="text-center py-6 text-[10px] text-slate-600 op-low">
          SentinelView Documentation Console · Portfolio abstract · Generated July 2026.
        </footer>

      </div>
    </main>
  );
}
