/**
 * Dashboard Page
 *
 * Layout rules (Phase 7):
 * - Glassmorphic panels.
 * - Alert feed side panel.
 * - Confidence HUD.
 */

"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAlerts } from "@/hooks/useAlerts";
import AlertCard from "@/components/AlertCard";
import ThreatGlobe from "@/components/ThreatGlobe";
import { AnimatePresence, motion } from "framer-motion";

export default function DashboardPage() {
  const { isAuthenticated, logout, username } = useAuth();
  const router = useRouter();
  const { alerts, wsStatus } = useAlerts();

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

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col overflow-hidden bg-[var(--color-bg)]">
      {/* Top Navigation */}
      <header className="glass-panel mx-4 mt-4 px-6 py-3 flex justify-between items-center z-20">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-lg tracking-wide">
            <span className="gradient-text">Sentinel</span>
            <span className="text-white">View</span>
          </h1>
          <div className="h-4 w-px bg-[var(--color-panel-border)]" />
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] font-mono uppercase">
            <div className={`status-dot status-dot-${wsStatus}`} />
            {wsStatus}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--color-muted)] uppercase tracking-wider">
            Analyst: <span className="text-white font-medium">{username}</span>
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-md border border-[var(--color-panel-border)] hover:bg-[var(--color-panel)] transition-colors"
          >
            Disconnect
          </motion.button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        
        {/* Left Column: Stats & Globe */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          
          {/* Stats HUD (Phase 7) */}
          <div className="grid grid-cols-3 gap-4 shrink-0">
            <div className="glass-panel p-4 flex flex-col justify-center">
              <span className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">Total Alerts</span>
              <span className="text-3xl font-mono text-white">{stats.total}</span>
            </div>
            <div className="glass-panel p-4 flex flex-col justify-center">
              <span className="text-xs text-[var(--color-danger)] uppercase tracking-wider mb-1">High Confidence</span>
              <span className="text-3xl font-mono text-[var(--color-danger)] drop-shadow-[0_0_8px_rgba(255,59,59,0.5)]">
                {stats.high}
              </span>
            </div>
            <div className="glass-panel p-4 flex flex-col justify-center">
              <span className="text-xs text-[var(--color-accent)] uppercase tracking-wider mb-1">Unique Source IPs</span>
              <span className="text-3xl font-mono text-[var(--color-accent)]">{stats.uniqueIps}</span>
            </div>
          </div>

          {/* 3D Globe Container (Phase 8) */}
          <div className="glass-panel flex-1 relative overflow-hidden flex items-center justify-center min-h-[300px]">
            {/* Fallback skeleton while connecting/loading */}
            {wsStatus === "connecting" && alerts.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg)] z-10">
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-[var(--color-accent)] font-mono text-sm tracking-widest"
                >
                  INITIALISING ORBITAL VIEW...
                </motion.div>
              </div>
            )}
            <ThreatGlobe activeIps={activeIps} />
          </div>
        </div>

        {/* Right Column: Alert Feed (Phase 7) */}
        <div className="glass-panel flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-[var(--color-panel-border)] shrink-0 flex justify-between items-center bg-[var(--color-panel)]">
            <h2 className="font-bold text-sm uppercase tracking-widest text-[var(--color-muted)]">Live Alert Feed</h2>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {wsStatus === "connected" && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-danger)] opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${wsStatus === 'connected' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-muted)]'}`}></span>
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
             <AnimatePresence initial={false}>
              {alerts.length === 0 && wsStatus === "connected" ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-xs text-[var(--color-muted)] mt-10 font-mono"
                >
                  Listening for network anomalies...
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
