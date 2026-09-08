"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  Variants,
} from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import ThreatGlobe from "@/components/ThreatGlobe";
import SentinelLogo from "@/components/SentinelLogo";

/* ── Motion Variants & Spring Configs ── */
const SPRING_SUBTLE = { type: "spring", stiffness: 300, damping: 25 } as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06, // 60ms stagger on load
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/* ── Faint Background Network Particle Field (5-10 slow-drifting nodes) ── */
const DRIFTING_NODES = [
  { id: 1, initX: 15, initY: 20, dx: [0, 25, -15, 0], dy: [0, -30, 20, 0], dur: 22 },
  { id: 2, initX: 85, initY: 15, dx: [0, -20, 15, 0], dy: [0, 25, -20, 0], dur: 26 },
  { id: 3, initX: 70, initY: 45, dx: [0, 30, -20, 0], dy: [0, -20, 30, 0], dur: 28 },
  { id: 4, initX: 25, initY: 65, dx: [0, -25, 20, 0], dy: [0, 35, -15, 0], dur: 24 },
  { id: 5, initX: 90, initY: 75, dx: [0, 20, -30, 0], dy: [0, -25, 25, 0], dur: 30 },
  { id: 6, initX: 45, initY: 85, dx: [0, -15, 25, 0], dy: [0, 20, -30, 0], dur: 25 },
  { id: 7, initX: 10, initY: 40, dx: [0, 20, -10, 0], dy: [0, -15, 25, 0], dur: 27 },
];

function NetworkTopologyField() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {DRIFTING_NODES.map((n) => (
        <motion.div
          key={n.id}
          className="absolute w-1.5 h-1.5 rounded-full bg-slate-400/20"
          style={{ left: `${n.initX}%`, top: `${n.initY}%` }}
          animate={{
            x: n.dx,
            y: n.dy,
          }}
          transition={{
            duration: n.dur,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      <svg className="w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <line x1="15%" y1="20%" x2="25%" y2="65%" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="3 6" />
        <line x1="85%" y1="15%" x2="70%" y2="45%" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="3 6" />
        <line x1="70%" y1="45%" x2="90%" y2="75%" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="3 6" />
      </svg>
    </div>
  );
}

/* ── Animated Tabular Metric Counter (Counting Up on Mount/Update, Zero Jitter) ── */
function AnimatedMetric({
  targetNumber,
  prefix = "",
  suffix = "",
  label,
}: {
  targetNumber: number;
  prefix?: string;
  suffix?: string;
  label: string;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(count, targetNumber, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
    });
    const unsubscribe = rounded.on("change", (val) => setDisplayValue(val));
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [targetNumber, count, rounded]);

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ scale: 1.02, transition: SPRING_SUBTLE }}
      className="glass-panel hud-bracket p-6 flex flex-col justify-center select-none"
    >
      <div className="font-mono font-bold text-3xl sm:text-[2.44rem] text-slate-100 leading-none mb-2 tracking-tight tabular-nums flex items-baseline gap-0.5">
        {prefix && <span className="text-slate-400 text-xl font-normal mr-1">{prefix}</span>}
        <span>{displayValue}</span>
        {suffix && <span className="text-[#2F5BFF] text-2xl font-semibold ml-0.5">{suffix}</span>}
      </div>
      <div className="font-sans font-semibold text-[0.8rem] uppercase tracking-wider text-slate-400">
        {label}
      </div>
    </motion.div>
  );
}

/* ── Custom 24px Outline Line Icons (Monochrome by default, Accent Blue when active) ── */
function ShieldOutlineIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#2F5BFF" : "currentColor"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6 transition-colors duration-200"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function CrosshairOutlineIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#2F5BFF" : "currentColor"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6 transition-colors duration-200"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="22" y1="12" x2="18" y2="12" />
      <line x1="6" y1="12" x2="2" y2="12" />
      <line x1="12" y1="6" x2="12" y2="2" />
      <line x1="12" y1="22" x2="12" y2="18" />
    </svg>
  );
}

function UploadOutlineIcon({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#2F5BFF" : "currentColor"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6 transition-colors duration-200"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export default function HomePage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  /* Modal state */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showColdStartSkeleton, setShowColdStartSkeleton] = useState(false);

  /* Form credentials & validation */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    server?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  /* Live-scrolling log stream */
  const [logs, setLogs] = useState<
    Array<{ id: number; time: string; text: string; severity: "HIGH" | "MEDIUM" | "NORMAL" }>
  >([]);

  /* Redirect if already authenticated */
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  /* Keyboard shortcut ESC to close modal */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* Realistic terminal log generation with sliding ease-out */
  useEffect(() => {
    const initialEvents = [
      {
        id: 1,
        time: "23:10:04.102",
        text: "INGEST 37.77.12.9 → 10.0.0.1:443 (200 OK, 1.4KB) - SYNCHRONIZED",
        severity: "NORMAL" as const,
      },
      {
        id: 2,
        time: "23:10:05.419",
        text: "ALERT  185.220.101.47 → 172.16.0.1:22 [BRUTE_FORCE] 5 failed attempts in 2.8s",
        severity: "HIGH" as const,
      },
      {
        id: 3,
        time: "23:10:06.854",
        text: "INGEST 45.33.32.156 → 10.0.0.2:80 (200 OK, 3.8KB) - TLS_SESSION_RESUMED",
        severity: "NORMAL" as const,
      },
      {
        id: 4,
        time: "23:10:08.110",
        text: "ALERT  91.108.4.202 → 10.0.0.5 [PORT_SCAN] 14 ports probed in 1.9s",
        severity: "MEDIUM" as const,
      },
      {
        id: 5,
        time: "23:10:09.921",
        text: "ALERT  175.45.176.3 → 192.168.10.5 [DATA_EXFIL] 14.8MB outbound payload flagged",
        severity: "HIGH" as const,
      },
    ];
    setLogs(initialEvents);

    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.toTimeString().split(" ")[0]}.${String(
        now.getMilliseconds()
      ).padStart(3, "0")}`;

      const templates = [
        {
          text: `INGEST 37.77.${Math.floor(Math.random() * 200)}.${Math.floor(
            Math.random() * 250
          )} → 10.0.0.1:443 (200 OK, 1.2KB)`,
          severity: "NORMAL" as const,
        },
        {
          text: `ALERT  185.220.${Math.floor(Math.random() * 100)}.47 → 172.16.0.1:22 [BRUTE_FORCE] Storm threshold exceeded`,
          severity: "HIGH" as const,
        },
        {
          text: `INGEST 45.33.${Math.floor(Math.random() * 100)}.156 → 10.0.0.2:80 (200 OK, 4.1KB)`,
          severity: "NORMAL" as const,
        },
        {
          text: `ALERT  91.108.${Math.floor(Math.random() * 50)}.202 → 10.0.0.7 [PORT_SCAN] 12 ports swept in 2.1s`,
          severity: "MEDIUM" as const,
        },
        {
          text: `ALERT  175.45.176.3 → 192.168.10.5 [DATA_EXFIL] 16.2MB egress surge isolated`,
          severity: "HIGH" as const,
        },
      ];

      const chosen = templates[Math.floor(Math.random() * templates.length)];
      setLogs((prev) => [
        ...prev.slice(-5),
        { id: Date.now(), time: timeStr, text: chosen.text, severity: chosen.severity },
      ]);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  /* Authentication Submission */
  const executeLogin = async (u: string, p: string) => {
    setLoading(true);
    setFieldErrors({});

    try {
      await login(u, p);
      setIsModalOpen(false);
      router.push("/dashboard");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Invalid credentials";
      setFieldErrors({ server: detail });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) errors.username = "Username is required.";
    if (!password) errors.password = "Password is required.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    executeLogin(username, password);
  };

  const handleInstantDemo = () => {
    setUsername("demo");
    setPassword("demo123");
    executeLogin("demo", "demo123");
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col relative overflow-x-hidden">
      {/* ── 2.5% Animated Noise / Grain Texture Overlay ── */}
      <div className="canvas-grain" aria-hidden="true" />

      {/* ── Fixed Minimalist Navigation Bar ── */}
      <header className="sticky top-0 z-40 bg-[#0B0F17]/85 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SentinelLogo className="w-6 h-6" />
            <span className="font-sans font-bold text-lg tracking-tight text-white">
              Sentinel<span className="text-[#2F5BFF]">_View</span>
            </span>
          </div>

          <motion.button
            type="button"
            onClick={() => setIsModalOpen(true)}
            whileHover={{ scale: 1.02, transition: SPRING_SUBTLE }}
            whileTap={{ scale: 0.98 }}
            className="rounded-[8px] px-4 py-2 text-sm font-sans font-semibold text-white bg-[#2F5BFF] hover:bg-[#254acc] border border-[#2F5BFF]/50 shadow-[0_0_15px_rgba(47,91,255,0.35)] transition-colors"
          >
            Launch Console →
          </motion.button>
        </div>
      </header>

      {/* ── Main Single-Focal-Point Layout ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 pt-12 pb-24 flex flex-col gap-16 relative z-10">
        {/* Network Topology Particle Drift Background */}
        <NetworkTopologyField />

        {/* ── Hero Section (Staggered 60ms Entry) ── */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-8 items-start text-left relative z-10"
        >
          {/* Headline + Italic Tagline + Full-Opacity Copy */}
          <div className="max-w-3xl flex flex-col gap-3">
            <motion.div variants={itemVariants} className="flex items-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <motion.span
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inline-flex h-full w-full rounded-full bg-[#2F5BFF]"
                />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2F5BFF]" />
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-slate-400 select-none">
                Telemetric Ingestion Active
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="font-sans font-bold text-4xl sm:text-[3.05rem] leading-[1.08] tracking-tight text-white"
            >
              Real-Time Threat Intelligence Console
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="font-display italic text-2xl sm:text-[1.563rem] text-slate-300 font-normal leading-snug"
            >
              Deterministic anomaly detection across live perimeter telemetry.
            </motion.p>

            <motion.p
              variants={itemVariants}
              className="font-sans text-base text-slate-300 leading-relaxed pt-1 max-w-2xl"
            >
              SentinelView ingests high-frequency network streams to classify brute-force authentication floods, port scan sweeps, and unauthorized exfiltrations in under 50 milliseconds.
            </motion.p>
          </div>

          {/* ── Cohesive Depth Stack: 3D Wireframe Globe (Sole Focal Point) + Terminal Feed ── */}
          <motion.div variants={itemVariants} className="w-full flex flex-col">
            {/* Layer 1: Full-Width 3D Wireframe Globe Container (Genuine 3-Layer Glassmorphism) */}
            <div className="glass-panel hud-bracket w-full h-[420px] sm:h-[490px] lg:h-[550px] overflow-hidden relative">
              {/* Corner Telemetry Coordinates */}
              <div className="absolute top-4 left-5 z-20 font-mono text-xs text-slate-400 pointer-events-none select-none">
                INGRESS_NODE: [37.77° N, -122.41° W]
              </div>

              <div className="absolute top-4 right-5 z-20 font-mono text-xs text-[#2F5BFF] font-semibold pointer-events-none select-none flex items-center gap-1.5">
                <motion.span
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="inline-block w-1.5 h-1.5 rounded-full bg-[#2F5BFF]"
                />
                ARC_FIRING_CYCLE: 4.0s (~60s/rev)
              </div>

              {/* R3F Globe Canvas */}
              <div className="absolute inset-0 z-10">
                <ThreatGlobe />
              </div>

              {/* Console Action Overlay Strip */}
              <div className="absolute bottom-4 left-5 right-5 z-20 flex items-center justify-between pointer-events-none">
                <div className="font-mono text-xs text-slate-300 bg-[#0B0F17]/80 px-3.5 py-1.5 rounded-[8px] border border-white/10 backdrop-blur-md shadow-lg select-none">
                  CARRIER_ARC: SAN FRANCISCO → FRANKFURT (BLOOM_PULSE ACTIVE)
                </div>

                <motion.button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  whileHover={{ scale: 1.02, transition: SPRING_SUBTLE }}
                  whileTap={{ scale: 0.98 }}
                  className="pointer-events-auto rounded-[8px] px-3.5 py-1.5 text-xs font-sans font-semibold text-white bg-[#2F5BFF] hover:bg-[#254acc] border border-[#2F5BFF]/40 shadow-[0_0_12px_rgba(47,91,255,0.3)] transition-colors"
                >
                  Open Live Monitor
                </motion.button>
              </div>
            </div>

            {/* Layer 2: Dark-Mode Terminal Log Panel (Live-Scrolling Telemetry Feed) */}
            <div className="w-full mt-3 glass-panel hud-bracket p-5 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08] text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-white uppercase tracking-wider text-[11px]">
                    Live Telemetry Ingestion Feed
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  PIPELINE: DETERMINISTIC / NO REDIS REQUIRED
                </span>
              </div>

              {/* Sliding Ease-Out Stream (150ms easeOut, entries shift up smoothly) */}
              <div className="flex flex-col gap-2 min-h-[120px] overflow-hidden">
                <AnimatePresence initial={false}>
                  {logs.map((log) => (
                    <motion.div
                      key={log.id}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="flex items-baseline gap-3 select-none"
                    >
                      <span className="text-slate-500 shrink-0 text-[11px] tabular-nums">
                        {log.time}
                      </span>
                      <span
                        className={`truncate ${
                          log.severity === "HIGH"
                            ? "text-red-400 font-semibold"
                            : log.severity === "MEDIUM"
                            ? "text-amber-400 font-medium"
                            : "text-emerald-400/90"
                        }`}
                      >
                        {log.text}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* ── Section 2: Platform Scale Metrics (Tabular Counting Up, 8pt Spacing) ── */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col gap-6 relative z-10"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-1">
            <h2 className="font-sans font-bold text-[1.563rem] text-white tracking-tight">
              Operational Scale
            </h2>
            <p className="font-display italic text-lg text-slate-400">
              Deterministic stream evaluation with sub-second threshold alerts.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <AnimatedMetric targetNumber={3} label="Threat Signatures" />
            <AnimatedMetric targetNumber={50} prefix="< " suffix="ms" label="Detection Latency" />
            <AnimatedMetric targetNumber={100} suffix="%" label="Stream Coverage" />
            <AnimatedMetric targetNumber={0} label="Secrets In Database" />
          </div>
        </motion.section>

        {/* ── Section 3: Detection Signatures (Custom Monochrome/Blue Icons, 2-Line Desc) ── */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col gap-6 relative z-10"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-1">
            <h2 className="font-sans font-bold text-[1.563rem] text-white tracking-tight">
              Detection Signatures
            </h2>
            <p className="font-display italic text-lg text-slate-400">
              Core heuristic signatures running concurrently over sliding time windows.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Signature 1 */}
            <motion.div
              variants={itemVariants}
              whileHover={{ scale: 1.02, transition: SPRING_SUBTLE }}
              className="glass-panel hud-bracket p-6 flex flex-col gap-3.5 group cursor-default"
            >
              <div className="text-slate-400 group-hover:text-[#2F5BFF] transition-colors">
                <ShieldOutlineIcon active={false} />
              </div>
              <h3 className="font-sans font-bold text-[1.25rem] text-white tracking-tight">
                Brute-Force Storm
              </h3>
              <p className="font-sans text-sm leading-relaxed text-slate-400 line-clamp-2">
                Flags high-frequency failed authentication spikes from a single origin IP within a 10-second sliding window.
              </p>
            </motion.div>

            {/* Signature 2 */}
            <motion.div
              variants={itemVariants}
              whileHover={{ scale: 1.02, transition: SPRING_SUBTLE }}
              className="glass-panel hud-bracket p-6 flex flex-col gap-3.5 group cursor-default"
            >
              <div className="text-slate-400 group-hover:text-[#2F5BFF] transition-colors">
                <CrosshairOutlineIcon active={false} />
              </div>
              <h3 className="font-sans font-bold text-[1.25rem] text-white tracking-tight">
                Port Reconnaissance
              </h3>
              <p className="font-sans text-sm leading-relaxed text-slate-400 line-clamp-2">
                Detects rapid sequential probe requests across 10 or more distinct internal ports within 5 seconds.
              </p>
            </motion.div>

            {/* Signature 3 */}
            <motion.div
              variants={itemVariants}
              whileHover={{ scale: 1.02, transition: SPRING_SUBTLE }}
              className="glass-panel hud-bracket p-6 flex flex-col gap-3.5 group cursor-default"
            >
              <div className="text-slate-400 group-hover:text-[#2F5BFF] transition-colors">
                <UploadOutlineIcon active={false} />
              </div>
              <h3 className="font-sans font-bold text-[1.25rem] text-white tracking-tight">
                Data Exfiltration
              </h3>
              <p className="font-sans text-sm leading-relaxed text-slate-400 line-clamp-2">
                Identifies anomalous outbound payloads exceeding the 10MB single-transfer security baseline.
              </p>
            </motion.div>
          </div>
        </motion.section>
      </main>

      {/* ── Footer: 4-Column with Corner-Bracket Top Divider ── */}
      <footer className="w-full bg-[#0B0F17]/90 border-t border-white/[0.08] mt-auto relative z-10">
        <div className="max-w-7xl mx-auto px-6 pt-4 pb-2">
          <div className="hud-bracket h-1 w-full border-b border-white/10" />
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 font-sans text-sm">
          {/* Col 1 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <SentinelLogo className="w-5 h-5" showBadge={false} />
              <span className="font-bold text-base text-white">Sentinel_View</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Continuous perimeter anomaly detection and real-time SIEM event telemetry.
            </p>
          </div>

          {/* Col 2 */}
          <div className="flex flex-col gap-2.5">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-200">Product</div>
            <span
              className="text-xs text-slate-400 hover:text-[#2F5BFF] cursor-pointer transition-colors"
              onClick={() => setIsModalOpen(true)}
            >
              Analyst Console
            </span>
            <span
              className="text-xs text-slate-400 hover:text-[#2F5BFF] cursor-pointer transition-colors"
              onClick={() => setIsModalOpen(true)}
            >
              Live Threat Stream
            </span>
            <span
              className="text-xs text-slate-400 hover:text-[#2F5BFF] cursor-pointer transition-colors"
              onClick={() => setIsModalOpen(true)}
            >
              Signature Engine
            </span>
          </div>

          {/* Col 3 */}
          <div className="flex flex-col gap-2.5">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-200">Resources</div>
            <a href="/docs" className="text-xs text-slate-400 hover:text-[#2F5BFF] transition-colors">
              Documentation
            </a>
            <a href="/docs#architecture" className="text-xs text-slate-400 hover:text-[#2F5BFF] transition-colors">
              System Architecture
            </a>
            <a href="/docs#api" className="text-xs text-slate-400 hover:text-[#2F5BFF] transition-colors">
              API Reference
            </a>
          </div>

          {/* Col 4 */}
          <div className="flex flex-col gap-2.5">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-200">Status</div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Node Active (Single Worker)
            </div>
            <div className="text-xs text-slate-500 pt-2 tabular-nums">
              © {new Date().getFullYear()} SentinelView. Portfolio Demonstration.
            </div>
          </div>
        </div>
      </footer>

      {/* ── Auth Modal & Designed Cold-Start Telemetry Shimmer Skeleton ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F17]/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={{ duration: 0.2 }}
              className="glass-panel hud-bracket w-full max-w-md p-6 relative border border-white/[0.12] bg-[#0E131F]/90"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setShowColdStartSkeleton(false);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-mono p-1 leading-none"
                aria-label="Close modal"
              >
                ✕
              </button>

              <div className="flex items-center gap-2.5 mb-1">
                <SentinelLogo className="w-6 h-6" />
                <h3 className="font-sans font-bold text-xl text-white tracking-tight">
                  Analyst Console Access
                </h3>
              </div>

              <p className="font-sans text-xs text-slate-400 mb-5">
                Authenticate with authorized credentials to connect to the live threat stream.
              </p>

              {/* Designed Cold-Start Shimmer Skeleton Notice */}
              {showColdStartSkeleton ? (
                <div className="flex flex-col gap-3 p-4 rounded-[8px] border border-[#2F5BFF]/30 bg-[#0B0F17]/70 mb-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#2F5BFF] font-semibold flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-[#2F5BFF] animate-ping" />
                      SPINNING_UP_WORKER (Render Cold-Start ~30s)
                    </span>
                  </div>

                  <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                  <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                  <div className="h-3 w-5/6 rounded skeleton-shimmer" />

                  <p className="font-mono text-[11px] text-slate-400 leading-normal pt-1">
                    Free-tier backend nodes idle after inactivity. SentinelView automatically pings the service to restore the SQLite write pipeline.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowColdStartSkeleton(false)}
                    className="mt-1 text-xs text-[#2F5BFF] hover:underline text-left font-mono"
                  >
                    ← Return to Login Form
                  </button>
                </div>
              ) : (
                <>
                  {/* Instant Demo Access CTA */}
                  <motion.button
                    type="button"
                    onClick={handleInstantDemo}
                    disabled={loading}
                    whileHover={{ scale: 1.02, transition: SPRING_SUBTLE }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full mb-4 py-2.5 px-3 rounded-[8px] font-sans font-semibold text-xs text-white bg-[#2F5BFF]/20 hover:bg-[#2F5BFF]/30 border border-[#2F5BFF]/50 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>⚡</span>
                    <span>Instant Demo Access (One-Click)</span>
                  </motion.button>

                  <div className="relative flex items-center mb-4">
                    <div className="flex-grow border-t border-white/10" />
                    <span className="flex-shrink mx-3 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Or enter credentials
                    </span>
                    <div className="flex-grow border-t border-white/10" />
                  </div>

                  {/* Login Form with Strict Custom Validation */}
                  <form noValidate onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                    {/* Username */}
                    <div className="flex flex-col">
                      <label
                        htmlFor="modal-username"
                        className="font-sans font-bold text-xs uppercase tracking-wider text-slate-300 mb-1"
                      >
                        Username
                      </label>
                      <input
                        id="modal-username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (fieldErrors.username) {
                            setFieldErrors((prev) => ({ ...prev, username: undefined }));
                          }
                        }}
                        placeholder="demo"
                        className={`rounded-[8px] px-3.5 py-2 text-sm font-mono outline-none transition-colors border bg-white/[0.03] text-white ${
                          fieldErrors.username
                            ? "border-[#EF4444] bg-red-500/10"
                            : "border-white/10 focus:border-[#2F5BFF]"
                        }`}
                      />
                      {fieldErrors.username && (
                        <span className="font-mono text-xs text-red-400 mt-1">
                          {fieldErrors.username}
                        </span>
                      )}
                    </div>

                    {/* Password */}
                    <div className="flex flex-col">
                      <label
                        htmlFor="modal-password"
                        className="font-sans font-bold text-xs uppercase tracking-wider text-slate-300 mb-1"
                      >
                        Password
                      </label>
                      <input
                        id="modal-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (fieldErrors.password) {
                            setFieldErrors((prev) => ({ ...prev, password: undefined }));
                          }
                        }}
                        placeholder="••••••••"
                        className={`rounded-[8px] px-3.5 py-2 text-sm font-mono outline-none transition-colors border bg-white/[0.03] text-white ${
                          fieldErrors.password
                            ? "border-[#EF4444] bg-red-500/10"
                            : "border-white/10 focus:border-[#2F5BFF]"
                        }`}
                      />
                      {fieldErrors.password && (
                        <span className="font-mono text-xs text-red-400 mt-1">
                          {fieldErrors.password}
                        </span>
                      )}
                    </div>

                    {/* General Server Error */}
                    {fieldErrors.server && (
                      <div className="font-mono text-xs text-red-400 p-2.5 rounded-[8px] bg-red-500/10 border border-red-500/30">
                        {fieldErrors.server}
                      </div>
                    )}

                    {/* Submit Button with Locked Width During Loading State */}
                    <motion.button
                      id="modal-submit"
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: loading ? 1 : 1.02, transition: SPRING_SUBTLE }}
                      whileTap={{ scale: loading ? 1 : 0.98 }}
                      className="mt-1 min-w-[170px] h-10 rounded-[8px] py-2.5 px-4 font-sans font-semibold text-xs uppercase tracking-wider text-white bg-[#2F5BFF] hover:bg-[#254acc] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(47,91,255,0.3)]"
                    >
                      {loading ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          <span>Authenticating…</span>
                        </>
                      ) : (
                        <span>Access Console →</span>
                      )}
                    </motion.button>
                  </form>

                  {/* Cold-Start Diagnostic Option */}
                  <div className="pt-3 text-center">
                    <button
                      type="button"
                      onClick={() => setShowColdStartSkeleton(true)}
                      className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Diagnose Render cold-start status (~30s node spin-up)
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
