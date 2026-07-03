/**
 * AlertCard — single alert entry with Framer Motion microinteractions.
 *
 * Animation rules (Phase 9):
 * - All cards: slide-in from right + fade, spring physics.
 * - HIGH confidence ONLY: aggressive pulse ring animation.
 * - LOW/MEDIUM: subtle entrance only, no pulse.
 * - whileHover on the card container for depth lift effect.
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
  BRUTE_FORCE: "#ff6b6b",
  PORT_SCAN: "#ffb347",
  DATA_EXFIL: "#00e5ff",
};

const CONFIDENCE_CLASS: Record<Alert["confidence"], string> = {
  HIGH: "badge-high",
  MEDIUM: "badge-medium",
  LOW: "badge-low",
};

export default function AlertCard({ alert, index }: AlertCardProps) {
  const isHigh = alert.confidence === "HIGH";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30, scale: 0.95 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        delay: Math.min(index * 0.04, 0.3),
      }}
      whileHover={{
        scale: 1.015,
        transition: { type: "spring", stiffness: 600, damping: 30 },
      }}
      className={`cyber-panel-rhyme p-4 flex gap-4 items-start relative overflow-hidden cursor-default ${
        isHigh ? "pulse-high" : ""
      }`}
      style={{
        borderColor: isHigh
          ? "rgba(255,59,59,0.3)"
          : "rgba(255,255,255,0.08)",
      }}
    >
      {/* Visual Rhyming Corner Markers */}
      <span className="absolute top-1.5 right-2 text-[7px] text-white/20 font-mono select-none pointer-events-none">+</span>
      
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
        style={{ background: THREAT_COLORS[alert.threat_type] }}
      />

      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{
          background: `color-mix(in srgb, ${THREAT_COLORS[alert.threat_type]} 15%, transparent)`,
          border: `1px solid color-mix(in srgb, ${THREAT_COLORS[alert.threat_type]} 25%, transparent)`,
        }}
      >
        {THREAT_ICONS[alert.threat_type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className="text-xs font-bold tracking-wider font-mono uppercase"
            style={{ color: THREAT_COLORS[alert.threat_type] }}
          >
            {alert.threat_type.replace("_", " ")}
          </span>
          <span className={`badge ${CONFIDENCE_CLASS[alert.confidence]}`}>
            {alert.confidence}
          </span>
        </div>

        <p
          className="text-xs mb-2 leading-relaxed font-mono text-slate-300 op-medium"
        >
          {alert.detail}
        </p>

        <div
          className="flex items-center gap-3 text-[10px] font-mono text-slate-500 op-low"
        >
          <span>{alert.source_ip}</span>
          <span>·</span>
          <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </motion.div>
  );
}
