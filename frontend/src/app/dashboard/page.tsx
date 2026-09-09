"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useAlerts } from "@/hooks/useAlerts";
import AlertCard from "@/components/AlertCard";
import ThreatGlobe from "@/components/ThreatGlobe";
import DashboardTour from "@/components/DashboardTour";
import IntegrationModal from "@/components/IntegrationModal";
import { AnimatePresence, motion } from "framer-motion";
import api from "@/lib/api";

type FilterOption = "ALL" | "BRUTE_FORCE" | "PORT_SCAN" | "DATA_EXFIL" | "HIGH_ONLY";

export default function DashboardPage() {
  const { isAuthenticated, logout, username, tenantId, apiKey, isDemo } = useAuth();
  const router = useRouter();
  const { alerts, wsStatus } = useAlerts();
  const [mobileTab, setMobileTab] = useState<"globe" | "feed">("globe");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simScenario, setSimScenario] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOption>("ALL");
  const [isIntegrationOpen, setIsIntegrationOpen] = useState(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());

  // Protect route
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  // Filtered active alerts
  const visibleAlerts = useMemo(() => {
    return alerts
      .filter((a) => !dismissedAlertIds.has(a.alert_id))
      .filter((a) => {
        if (filter === "ALL") return true;
        if (filter === "HIGH_ONLY") return a.confidence === "HIGH";
        return a.threat_type === filter;
      });
  }, [alerts, dismissedAlertIds, filter]);

  // Derived stats
  const stats = useMemo(() => {
    const active = alerts.filter((a) => !dismissedAlertIds.has(a.alert_id));
    const highCount = active.filter((a) => a.confidence === "HIGH").length;
    const ips = new Set(active.map((a) => a.source_ip)).size;
    return { total: active.length, high: highCount, uniqueIps: ips };
  }, [alerts, dismissedAlertIds]);

  // Pass active IPs to globe (latest 50)
  const activeIps = useMemo(() => {
    return visibleAlerts.slice(0, 50).map((a) => a.source_ip);
  }, [visibleAlerts]);

  // Multi-Scenario Simulation Engine (Uses Authenticated api.post)
  const handleSimulateScenario = async (scenario: "BRUTE_FORCE" | "PORT_SCAN" | "DATA_EXFIL" | "CHAOS") => {
    setIsSimulating(true);
    setSimScenario(scenario);

    const now = () => new Date().toISOString();
    let events: Array<Record<string, unknown>> = [];

    if (scenario === "BRUTE_FORCE") {
      const src = "185.220.101.47";
      for (let i = 0; i < 6; i++) {
        events.push({
          source_ip: src,
          dest_ip: "10.0.0.1",
          action: "LOGIN",
          status_code: 401,
          username: "admin",
          bytes_sent: 120,
          timestamp: now(),
        });
      }
    } else if (scenario === "PORT_SCAN") {
      const src = "45.33.32.156";
      for (let i = 1; i <= 12; i++) {
        events.push({
          source_ip: src,
          dest_ip: `10.0.0.${i}`,
          action: "REQUEST",
          status_code: 200,
          username: null,
          bytes_sent: 512,
          timestamp: now(),
        });
      }
    } else if (scenario === "DATA_EXFIL") {
      events.push({
        source_ip: "175.45.176.3",
        dest_ip: "192.168.10.5",
        action: "TRANSFER",
        status_code: 200,
        username: "svc_backup",
        bytes_sent: 25_000_000,
        timestamp: now(),
      });
    } else {
      // CHAOS BURST — Mixed attack events
      events = [
        { source_ip: "185.220.101.47", dest_ip: "10.0.0.1", action: "LOGIN", status_code: 401, username: "admin", bytes_sent: 120, timestamp: now() },
        { source_ip: "185.220.101.47", dest_ip: "10.0.0.1", action: "LOGIN", status_code: 401, username: "root", bytes_sent: 120, timestamp: now() },
        { source_ip: "185.220.101.47", dest_ip: "10.0.0.1", action: "LOGIN", status_code: 401, username: "support", bytes_sent: 120, timestamp: now() },
        { source_ip: "185.220.101.47", dest_ip: "10.0.0.1", action: "LOGIN", status_code: 401, username: "admin", bytes_sent: 120, timestamp: now() },
        { source_ip: "185.220.101.47", dest_ip: "10.0.0.1", action: "LOGIN", status_code: 401, username: "admin", bytes_sent: 120, timestamp: now() },
        { source_ip: "185.220.101.47", dest_ip: "10.0.0.1", action: "LOGIN", status_code: 401, username: "admin", bytes_sent: 120, timestamp: now() },
        { source_ip: "91.108.4.202", dest_ip: "10.0.0.10", action: "TRANSFER", status_code: 200, username: "dbadmin", bytes_sent: 18_000_000, timestamp: now() },
      ];
    }

    try {
      // Send events with slight staggered delay to model network stream
      for (const evt of events) {
        await api.post("/api/v1/ingest", evt).catch(() => null);
        await new Promise((r) => setTimeout(r, 80));
      }
    } finally {
      setIsSimulating(false);
      setSimScenario(null);
    }
  };

  // Export alerts as JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(visibleAlerts, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sentinelview_alerts_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export alerts as CSV
  const handleExportCSV = () => {
    const headers = "Alert ID,Timestamp,Source IP,Threat Type,Confidence,Detail\n";
    const rows = visibleAlerts
      .map(
        (a) =>
          `"${a.alert_id}","${a.timestamp}","${a.source_ip}","${a.threat_type}","${a.confidence}","${a.detail.replace(/"/g, '""')}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sentinelview_alerts_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Clear / Reset alerts
  const handleClearAlerts = () => {
    const allCurrentIds = new Set(alerts.map((a) => a.alert_id));
    setDismissedAlertIds(allCurrentIds);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen lg:h-screen flex flex-col overflow-x-hidden overflow-y-auto lg:overflow-hidden bg-[#FAFAF8] text-[#111318] hero-gradient-mesh">
      {/* Interactive Tour Tutorial Portal */}
      <DashboardTour />

      {/* Integration & Developer API Modal */}
      <IntegrationModal
        isOpen={isIntegrationOpen}
        onClose={() => setIsIntegrationOpen(false)}
        apiKey={apiKey}
        tenantId={tenantId}
      />

      {/* Top Header Navigation Console */}
      <header
        id="tour-header"
        className="mx-3 sm:mx-4 mt-2 sm:mt-3 px-3 sm:px-5 py-2.5 sm:py-3 bento-card bg-white/90 backdrop-blur-xl border border-slate-900/[0.07] rounded-xl z-20 shadow-layered shrink-0"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Brand & Connection Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src="/SentinelView_logo.png"
              alt="SentinelView Threat Intelligence Logo"
              className="w-7 h-7 object-contain rounded-md shrink-0"
            />
            <h1 className="font-extrabold text-base sm:text-lg tracking-tight font-sans text-slate-900">
              Sentinel<span className="text-[#2563EB]">_View</span>
            </h1>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-600">
              <span className="ping-dot">
                <span className={`ping-dot-ring ${wsStatus === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 status-dot-${wsStatus}`} />
              </span>
              <span className="uppercase tracking-wider font-semibold text-[10px] sm:text-[11px] hidden xs:inline">{wsStatus}</span>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden md:block" />
            {isDemo ? (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono font-semibold text-amber-700">
                <span>⚡</span>
                <span>DEMO SANDBOX</span>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono font-semibold text-emerald-700">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>LIVE TENANT: {tenantId}</span>
              </div>
            )}
          </div>

          {/* Action Cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsIntegrationOpen(true)}
              className="text-xs font-bold font-sans px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-50 text-[#2563EB] border border-blue-200 hover:bg-blue-100 transition-all flex items-center gap-1.5 shadow-sm"
              title="API & Integrations"
            >
              <span>🔌</span>
              <span className="hidden sm:inline">Connect & API</span>
            </motion.button>

            <span className="hidden lg:inline-block text-xs text-slate-500 font-sans">
              Analyst: <strong className="text-slate-900 font-mono font-semibold">{username}</strong>
            </span>

            <Link
              href="/docs"
              className="text-xs font-bold font-sans px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all hidden xs:inline-block"
            >
              Docs
            </Link>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={logout}
              className="text-xs font-bold font-sans px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all"
              title="Disconnect session"
            >
              <span className="hidden xs:inline">Disconnect</span>
              <span className="xs:hidden">✕</span>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Mobile View Tab Toggle Switcher Bar — Cleanly decoupled from header row */}
      <div className="mx-3 sm:mx-4 mt-2 flex lg:hidden bg-slate-200/80 p-1 rounded-xl gap-1 shrink-0 shadow-inner z-10">
        <button
          onClick={() => setMobileTab("globe")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "globe"
              ? "bg-white text-[#2563EB] shadow-sm font-extrabold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🌐</span>
          <span>3D Threat Globe</span>
        </button>
        <button
          onClick={() => setMobileTab("feed")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "feed"
              ? "bg-white text-[#2563EB] shadow-sm font-extrabold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>⚡</span>
          <span>Live Alerts Feed ({visibleAlerts.length})</span>
        </button>
      </div>

      {/* Main Content Responsive Grid */}
      <main className="flex-1 p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 min-h-0">
        {/* Left Column: Metrics HUD Strip & 3D Attack Globe Stage */}
        <div className={`lg:col-span-2 flex flex-col gap-3 sm:gap-3.5 min-h-0 ${mobileTab === "feed" ? "hidden lg:flex" : "flex"}`}>
          {/* Slim Horizontal Metrics HUD Strip with non-colliding typography */}
          <div id="tour-stats" className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
            {/* Card 1: Active Alerts */}
            <div className="bento-card hud-bracket p-2.5 sm:p-3.5 flex flex-col justify-between bg-white rounded-xl border border-slate-900/[0.07] shadow-sm">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] sm:text-[11px] text-slate-500 font-sans font-bold uppercase tracking-wider truncate">
                  Active Alerts
                </span>
                <span className="text-[8px] sm:text-[10px] font-mono font-bold text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-1 sm:px-1.5 py-0.5 rounded-full shrink-0">
                  LIVE
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1 sm:mt-1.5">
                <span className="text-xl sm:text-2xl font-mono font-extrabold text-slate-900 tabular-nums">
                  {stats.total}
                </span>
                <span className="text-[9px] sm:text-[11px] text-slate-400 font-mono hidden xs:inline">
                  events
                </span>
              </div>
            </div>

            {/* Card 2: High Severity */}
            <div className="bento-card hud-bracket p-2.5 sm:p-3.5 flex flex-col justify-between bg-white rounded-xl border border-slate-900/[0.07] shadow-sm">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] sm:text-[11px] text-red-600 font-sans font-bold uppercase tracking-wider truncate">
                  High Severity
                </span>
                <span className="text-[8px] sm:text-[10px] font-mono font-bold text-red-700 bg-red-500/10 border border-red-500/20 px-1 sm:px-1.5 py-0.5 rounded-full shrink-0">
                  CRITICAL
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1 sm:mt-1.5">
                <span className="text-xl sm:text-2xl font-mono font-extrabold text-red-600 tabular-nums">
                  {stats.high}
                </span>
                <span className="text-[9px] sm:text-[11px] text-red-400 font-mono hidden xs:inline">
                  surges
                </span>
              </div>
            </div>

            {/* Card 3: Target Nodes */}
            <div className="bento-card hud-bracket p-2.5 sm:p-3.5 flex flex-col justify-between bg-white rounded-xl border border-slate-900/[0.07] shadow-sm">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] sm:text-[11px] text-[#2563EB] font-sans font-bold uppercase tracking-wider truncate">
                  Target Nodes
                </span>
                <span className="text-[8px] sm:text-[10px] font-mono font-bold text-blue-700 bg-blue-500/10 border border-blue-500/20 px-1 sm:px-1.5 py-0.5 rounded-full shrink-0">
                  IPs
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1 sm:mt-1.5">
                <span className="text-xl sm:text-2xl font-mono font-extrabold text-[#2563EB] tabular-nums">
                  {stats.uniqueIps}
                </span>
                <span className="text-[9px] sm:text-[11px] text-blue-400 font-mono hidden xs:inline">
                  isolated
                </span>
              </div>
            </div>
          </div>

          {/* 3D Attack Globe Stage Container — The Star of the Show */}
          <div
            id="tour-globe"
            className="bento-card hud-bracket flex-1 relative overflow-hidden flex items-center justify-center min-h-[280px] sm:min-h-[340px] lg:min-h-[300px] bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-900/[0.07] shadow-layered"
          >
            {/* Atmospheric spatial depth glow behind globe */}
            <div className="absolute inset-0 globe-radial-glow pointer-events-none" aria-hidden="true" />

            {/* Floating Glass Telemetry Pills */}
            <div className="absolute top-2.5 sm:top-3 left-3 sm:left-4 z-10 pointer-events-none">
              <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm text-[9px] sm:text-[10px] text-slate-600 font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ORBITAL_RADAR_ACTIVE
              </span>
            </div>

            <div className="absolute top-2.5 sm:top-3 right-3 sm:right-4 z-10 pointer-events-none">
              <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full bg-white/80 backdrop-blur-md border border-blue-200/80 shadow-sm text-[9px] sm:text-[10px] text-[#2563EB] font-mono font-semibold">
                3D_SPATIAL_VECTOR
              </span>
            </div>

            {/* Cold Start Reassuring Loader Overlay */}
            {wsStatus === "connecting" && alerts.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur-md z-10 p-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="ping-dot h-4 w-4">
                    <span className="ping-dot-ring bg-amber-500" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500" />
                  </span>
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-amber-900 font-sans font-bold text-sm tracking-wide"
                  >
                    Waking telemetry node... (~30s Render cold start)
                  </motion.div>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed font-sans">
                    Connecting to detector instance. Live threat anomalies will begin streaming shortly.
                  </p>
                </div>
              </div>
            )}

            <ThreatGlobe activeIps={activeIps} />
          </div>

          {/* Interactive Multi-Scenario Attack Simulation Control Strip */}
          <div className="bento-card p-2.5 sm:p-3 bg-white/90 backdrop-blur-md rounded-xl border border-slate-900/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-[11px] font-bold font-sans uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                Simulate Threat:
              </span>
              {isSimulating && (
                <span className="text-[10px] font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">
                  Injecting {simScenario}…
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleSimulateScenario("BRUTE_FORCE")}
                disabled={isSimulating}
                className="px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-sans font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <span>🔒</span>
                <span>Brute Force</span>
              </button>
              <button
                onClick={() => handleSimulateScenario("PORT_SCAN")}
                disabled={isSimulating}
                className="px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-sans font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <span>🌐</span>
                <span>Port Scan</span>
              </button>
              <button
                onClick={() => handleSimulateScenario("DATA_EXFIL")}
                disabled={isSimulating}
                className="px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-sans font-bold bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <span>📤</span>
                <span>Data Exfil</span>
              </button>
              <button
                onClick={() => handleSimulateScenario("CHAOS")}
                disabled={isSimulating}
                className="px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-sans font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm"
              >
                <span>⚡</span>
                <span>Chaos Burst</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Alert Feed with Filters & Export */}
        <div
          id="tour-feed"
          className={`bento-card hud-bracket flex flex-col min-h-0 overflow-hidden relative bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-900/[0.07] shadow-layered ${
            mobileTab === "globe" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Feed Header */}
          <div className="p-3.5 border-b border-slate-100 shrink-0 bg-slate-50/70 flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-xs uppercase tracking-wider font-sans text-slate-800">
                  Live Threat Feed
                </h2>
                <span className="text-xs font-mono text-slate-600 font-semibold bg-slate-200/60 px-2 py-0.5 rounded-md">
                  {visibleAlerts.length}
                </span>
              </div>

              {/* Feed Tools: Export & Clear */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleExportJSON}
                  title="Export alerts as JSON"
                  className="px-2 py-1 text-[10px] font-mono font-bold rounded bg-slate-200/70 hover:bg-slate-300 text-slate-700 transition-all"
                >
                  JSON
                </button>
                <button
                  onClick={handleExportCSV}
                  title="Export alerts as CSV"
                  className="px-2 py-1 text-[10px] font-mono font-bold rounded bg-slate-200/70 hover:bg-slate-300 text-slate-700 transition-all"
                >
                  CSV
                </button>
                {visibleAlerts.length > 0 && (
                  <button
                    onClick={handleClearAlerts}
                    title="Clear visible feed"
                    className="px-2 py-1 text-[10px] font-sans font-bold rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] font-sans font-bold">
              {[
                { id: "ALL", label: "All" },
                { id: "BRUTE_FORCE", label: "🔒 Brute" },
                { id: "PORT_SCAN", label: "🌐 Scan" },
                { id: "DATA_EXFIL", label: "📤 Exfil" },
                { id: "HIGH_ONLY", label: "🔥 Critical" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as FilterOption)}
                  className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-all ${
                    filter === f.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feed Content Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
            <AnimatePresence initial={false}>
              {visibleAlerts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center my-auto p-6 flex flex-col items-center gap-3 text-slate-500 font-sans"
                >
                  <span className="ping-dot h-3 w-3">
                    <span className="ping-dot-ring bg-blue-500" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                  </span>
                  <p className="text-xs text-slate-600 font-medium">
                    {filter === "ALL"
                      ? "Listening for live security telemetry..."
                      : `No ${filter.replace("_", " ")} incidents matching filter.`}
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSimulateScenario("CHAOS")}
                    disabled={isSimulating}
                    className="mt-2 px-4 py-2 rounded-xl text-xs font-sans font-bold uppercase tracking-wider bg-[#2563EB] text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
                  >
                    <span>⚡</span>
                    <span>{isSimulating ? "Injecting Logs…" : "Trigger Attack Simulation"}</span>
                  </motion.button>
                </motion.div>
              ) : (
                visibleAlerts.map((alert, idx) => (
                  <AlertCard key={alert.alert_id} alert={alert} index={idx} />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}



