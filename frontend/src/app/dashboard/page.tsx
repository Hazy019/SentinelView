"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useAlerts } from "@/hooks/useAlerts";
import AlertCard from "@/components/AlertCard";
import ThreatGlobe from "@/components/ThreatGlobe";
import DashboardTour from "@/components/DashboardTour";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";

export default function DashboardPage() {
  const { isAuthenticated, logout, username } = useAuth();
  const router = useRouter();
  const { alerts, wsStatus } = useAlerts();
  const [mobileTab, setMobileTab] = useState<"globe" | "feed">("globe");
  const [isSimulating, setIsSimulating] = useState(false);

  // Protect route
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  // Derived stats
  const stats = useMemo(() => {
    const highCount = alerts.filter((a) => a.confidence === "HIGH").length;
    const ips = new Set(alerts.map((a) => a.source_ip)).size;
    return { total: alerts.length, high: highCount, uniqueIps: ips };
  }, [alerts]);

  // Pass active IPs to globe (latest 50)
  const activeIps = useMemo(() => {
    return alerts.slice(0, 50).map((a) => a.source_ip);
  }, [alerts]);

  // One-click Simulate Attack Traffic trigger (UX Requirement 3.8)
  const handleSimulateAttack = async () => {
    setIsSimulating(true);
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
    
    // Send 5 rapid attack log events to backend
    const sampleEvents = [
      { source_ip: "185.220.101.47", dest_ip: "10.0.0.1", action: "LOGIN", status_code: 401, bytes_sent: 120 },
      { source_ip: "185.220.101.47", dest_ip: "10.0.0.1", action: "LOGIN", status_code: 401, bytes_sent: 120 },
      { source_ip: "185.220.101.47", dest_ip: "10.0.0.1", action: "LOGIN", status_code: 401, bytes_sent: 120 },
      { source_ip: "45.33.32.156", dest_ip: "192.168.1.10", action: "TRANSFER", status_code: 200, bytes_sent: 15000000 },
      { source_ip: "91.108.4.202", dest_ip: "10.0.0.5", action: "REQUEST", status_code: 200, bytes_sent: 500 },
    ];

    try {
      for (const evt of sampleEvents) {
        await axios.post(`${backendUrl}/api/v1/ingest`, {
          ...evt,
          timestamp: new Date().toISOString(),
        }).catch(() => null);
        await new Promise((r) => setTimeout(r, 150));
      }
    } finally {
      setIsSimulating(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#FAFAF8] text-[#111318] hero-gradient-mesh">
      {/* Interactive Tour Tutorial Portal */}
      <DashboardTour />

      {/* Top Header Navigation Console */}
      <header
        id="tour-header"
        className="mx-4 mt-3 px-5 py-3 bento-card bg-white/90 backdrop-blur-xl border border-slate-900/[0.07] rounded-xl flex justify-between items-center z-20 shadow-layered"
      >
        <div className="flex items-center gap-3">
          <img
            src="/SentinelView_logo.png"
            alt="SentinelView Threat Intelligence Logo"
            className="w-7 h-7 object-contain rounded-md"
          />
          <h1 className="font-extrabold text-lg tracking-tight font-sans text-slate-900">
            Sentinel<span className="text-[#2563EB]">_View</span>
          </h1>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2 text-xs font-mono font-medium text-slate-600">
            <span className="ping-dot">
              <span className={`ping-dot-ring ${wsStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 status-dot-${wsStatus}`} />
            </span>
            <span className="uppercase tracking-wider font-semibold text-[11px]">{wsStatus}</span>
          </div>
        </div>


        {/* Mobile View Tab Toggle Switcher */}
        <div className="flex lg:hidden bg-slate-100 p-1 rounded-lg gap-1">
          <button
            onClick={() => setMobileTab("globe")}
            className={`px-3 py-1 rounded-md text-xs font-sans font-bold transition-all ${
              mobileTab === "globe" ? "bg-white text-[#2563EB] shadow-sm" : "text-slate-600"
            }`}
          >
            Globe View
          </button>
          <button
            onClick={() => setMobileTab("feed")}
            className={`px-3 py-1 rounded-md text-xs font-sans font-bold transition-all ${
              mobileTab === "feed" ? "bg-white text-[#2563EB] shadow-sm" : "text-slate-600"
            }`}
          >
            Live Feed ({alerts.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-block text-xs text-slate-500 font-sans">
            Analyst: <strong className="text-slate-900 font-mono font-semibold">{username}</strong>
          </span>
          <Link
            href="/docs"
            className="text-xs font-bold font-sans px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
          >
            Docs
          </Link>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={logout}
            className="text-xs font-bold font-sans px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-all"
          >
            Disconnect
          </motion.button>
        </div>
      </header>

      {/* Main Content Responsive Grid */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        
        {/* Left Column: Metrics HUD Strip & 3D Attack Globe Bento Stage (>60% Visual Weight) */}
        <div className={`lg:col-span-2 flex flex-col gap-3.5 min-h-0 ${mobileTab === "feed" ? "hidden lg:flex" : "flex"}`}>
          
          {/* Slim Horizontal Metrics HUD Strip */}
          <div id="tour-stats" className="grid grid-cols-3 gap-3 shrink-0">
            <div className="bento-card hud-bracket px-4 py-3 flex flex-col justify-center bg-white rounded-xl border border-slate-900/[0.07] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-sans font-bold uppercase tracking-wider">Total Alerts</span>
                <span className="text-[10px] font-mono font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">LIVE</span>
              </div>
              <span className="text-2xl font-mono font-extrabold text-slate-900 mt-0.5">{stats.total}</span>
            </div>
            
            <div className="bento-card hud-bracket px-4 py-3 flex flex-col justify-center bg-white rounded-xl border border-slate-900/[0.07] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-red-600 font-sans font-bold uppercase tracking-wider">High Severity</span>
                <span className="text-[10px] font-mono font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">CRITICAL</span>
              </div>
              <span className="text-2xl font-mono font-extrabold text-red-600 mt-0.5">{stats.high}</span>
            </div>

            <div className="bento-card hud-bracket px-4 py-3 flex flex-col justify-center bg-white rounded-xl border border-slate-900/[0.07] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#2563EB] font-sans font-bold uppercase tracking-wider">Unique Source IPs</span>
                <span className="text-[10px] font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">NODES</span>
              </div>
              <span className="text-2xl font-mono font-extrabold text-[#2563EB] mt-0.5">{stats.uniqueIps}</span>
            </div>
          </div>

          {/* 3D Attack Globe Stage Container ("The Star of the Show") */}
          <div id="tour-globe" className="bento-card hud-bracket flex-1 relative overflow-hidden flex items-center justify-center min-h-[320px] bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-900/[0.07] shadow-layered">
            <span className="absolute top-3 left-4 text-[10px] text-slate-400 font-mono select-none pointer-events-none font-medium">
              [ORBITAL_DETECTOR_ACTIVE]
            </span>
            <span className="absolute top-3 right-4 text-[10px] text-[#2563EB] font-mono select-none pointer-events-none font-semibold">
              3D_SPATIAL_VECTOR
            </span>

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
        </div>

        {/* Right Column: Live Alert Feed */}
        <div id="tour-feed" className={`bento-card hud-bracket flex flex-col min-h-0 overflow-hidden relative bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-900/[0.07] shadow-layered ${mobileTab === "globe" ? "hidden lg:flex" : "flex"}`}>
          <div className="p-4 border-b border-slate-100 shrink-0 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-extrabold text-xs uppercase tracking-wider font-sans text-slate-800">
              Live Threat Feed
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-600 font-semibold bg-slate-200/60 px-2 py-0.5 rounded-md">
                {alerts.length} Incidents
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
            <AnimatePresence initial={false}>
              {alerts.length === 0 && wsStatus === "connected" ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center my-auto p-6 flex flex-col items-center gap-3 text-slate-500 font-sans"
                >
                  <span className="ping-dot h-3 w-3">
                    <span className="ping-dot-ring bg-blue-500" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                  </span>
                  <p className="text-xs text-slate-600 font-medium">Listening for network anomalies & security alerts...</p>
                  
                  {/* Actionable "Simulate Attack Traffic" Button (Requirement 3.8) */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSimulateAttack}
                    disabled={isSimulating}
                    className="mt-2 px-4 py-2 rounded-xl text-xs font-sans font-bold uppercase tracking-wider bg-[#2563EB] text-white hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
                  >
                    <span>⚡</span>
                    <span>{isSimulating ? "Injecting Logs…" : "Simulate Attack Traffic"}</span>
                  </motion.button>
                </motion.div>
              ) : (
                alerts.map((alert, idx) => (
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


