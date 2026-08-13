/**
 * AlertCard — Light-mode SOC threat item with thin severity border, HUD brackets, and monospace telemetry typography.
 */

"use client";

import { motion } from "framer-motion";
import type { Alert } from "@/hooks/useAlerts";

interface AlertCardProps {
  alert: Alert;
  index: number;
}

const THREAT_ICONS: Record<Alert["threat_type"], string> = {
  BRUTE_FORCE: "🔒",
  PORT_SCAN: "🌐",
  DATA_EXFIL: "📤",
};

const THREAT_COLORS: Record<Alert["threat_type"], string> = {
  BRUTE_FORCE: "#EF4444",
  PORT_SCAN: "#F59E0B",
  DATA_EXFIL: "#2563EB",
};

export default function AlertCard({ alert, index }: AlertCardProps) {
  const isHigh = alert.confidence === "HIGH";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, y: 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 28,
        delay: Math.min(index * 0.02, 0.2),
      }}
      whileHover={{
        y: -1,
        transition: { duration: 0.15 },
      }}
      className="bento-card hud-bracket p-4 flex gap-3.5 items-start relative overflow-hidden bg-white border border-slate-900/[0.07] rounded-xl shadow-sm"
      style={{
        borderLeft: `3px solid ${THREAT_COLORS[alert.threat_type]}`,
      }}
    >
      {/* Icon Capsule */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{
          background: `color-mix(in srgb, ${THREAT_COLORS[alert.threat_type]} 8%, #FFFFFF)`,
          border: `1px solid color-mix(in srgb, ${THREAT_COLORS[alert.threat_type]} 18%, transparent)`,
        }}
      >
        {THREAT_ICONS[alert.threat_type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold tracking-wider font-mono uppercase"
              style={{ color: THREAT_COLORS[alert.threat_type] }}
            >
              {alert.threat_type.replace("_", " ")}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase ${
                isHigh
                  ? "bg-red-50 text-red-600 border border-red-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {alert.confidence}
            </span>
          </div>

          {/* Active Radar Ping Dot for HIGH Confidence */}
          {isHigh && (
            <span className="ping-dot" title="Active High Severity Threat">
              <span className="ping-dot-ring bg-red-500" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
        </div>

        <p className="text-xs mb-2 leading-relaxed font-sans text-slate-800 font-medium">
          {alert.detail}
        </p>

        <div className="flex items-center gap-2.5 text-[11px] font-mono text-slate-500">
          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {alert.source_ip}
          </span>
          <span className="text-slate-300">·</span>
          <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </motion.div>
  );
}


