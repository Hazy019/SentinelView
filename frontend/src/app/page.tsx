"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import ThreatGlobe from "@/components/ThreatGlobe";

/* ---- Stat tiles shown via Intersection Observer ---- */
const STATS = [
  { value: "3", label: "Threat Signatures" },
  { value: "< 50ms", label: "Alert Latency" },
  { value: "Real-time", label: "WebSocket Delivery" },
  { value: "100%", label: "Simulated Logs" },
];

const THREAT_CARDS = [
  {
    icon: "🔒",
    name: "Brute Force",
    desc: "Detects repeated failed login storms from a single source IP within a 10-second sliding window.",
    color: "#EF4444",
  },
  {
    icon: "🌐",
    name: "Port Scan",
    desc: "Flags rapid reconnaissance across 10+ distinct internal destinations within 5 seconds.",
    color: "#F59E0B",
  },
  {
    icon: "📤",
    name: "Data Exfil",
    desc: "Catches abnormally large single-transfer events exceeding 10MB thresholds.",
    color: "#2563EB",
  },
];

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* State for mock landing-page telemetry */
  const [mockIps, setMockIps] = useState<string[]>([]);
  const [mockLogs, setMockLogs] = useState<string[]>([]);

  useEffect(() => {
    const defaultIps = [
      "185.220.101.47",
      "45.33.32.156",
      "91.108.4.202",
      "104.21.45.89",
      "175.45.176.3",
    ];
    setMockIps(defaultIps);

    const initialLogs = [
      "REQUEST  45.33.32.156   → 10.0.0.1 (200)",
      "TRANSFER 175.45.176.3   → 192.168.10.5 (200) [EXFIL]",
      "LOGIN    185.220.101.47 → 172.16.0.1 (401) [BRUTE]",
      "REQUEST  91.108.4.202   → 10.0.0.2 (403)",
      "TRANSFER 165.22.58.130  → 10.0.0.1 (200)",
    ];
    setMockLogs(initialLogs);

    const interval = setInterval(() => {
      const actions = ["LOGIN", "REQUEST", "TRANSFER"];
      const ips = [
        "185.220.101.47",
        "45.33.32.156",
        "91.108.4.202",
        "104.21.45.89",
        "175.45.176.3",
        "165.22.58.130",
        "220.181.38.251",
      ];
      const dests = ["10.0.0.1", "10.0.0.2", "172.16.0.5", "192.168.10.5"];
      
      const act = actions[Math.floor(Math.random() * actions.length)];
      const ip = ips[Math.floor(Math.random() * ips.length)];
      const dest = dests[Math.floor(Math.random() * dests.length)];
      const code = Math.random() > 0.4 ? "200" : "401";
      const isSpecial = Math.random() > 0.7 ? (act === "LOGIN" ? " [BRUTE]" : act === "TRANSFER" ? " [EXFIL]" : "") : "";
      
      const newLog = `${act.padEnd(8, " ")} ${ip.padEnd(15, " ")} → ${dest} (${code})${isSpecial}`;
      
      setMockIps((prev) => [ip, ...prev.slice(0, 4)]);
      setMockLogs((prev) => [newLog, ...prev.slice(0, 4)]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  /* Redirect if already authenticated */
  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  /* Intersection Observer for stat/threat reveals */
  const statsRef = useRef<HTMLDivElement>(null);
  const threatsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [threatsVisible, setThreatsVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.target === statsRef.current && e.isIntersecting)
            setStatsVisible(true);
          if (e.target === threatsRef.current && e.isIntersecting)
            setThreatsVisible(true);
        });
      },
      { threshold: 0.2 }
    );
    if (statsRef.current) obs.observe(statsRef.current);
    if (threatsRef.current) obs.observe(threatsRef.current);
    return () => obs.disconnect();
  }, []);

  const handleLoginSubmit = async (u: string, p: string) => {
    setError("");
    setLoading(true);
    try {
      await login(u, p);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Invalid credentials";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLoginSubmit(username, password);
  };

  const handleDemoAccess = () => {
    setUsername("demo");
    setPassword("demo123");
    handleLoginSubmit("demo", "demo123");
  };

  return (
    <main className="min-h-screen relative overflow-x-hidden bg-[#FAFAF8] text-[#111318] hero-gradient-mesh">
      {/* ── Split-Screen Hero & Login Bento Section ── */}
      <section className="relative z-10 flex flex-col lg:flex-row items-center justify-center min-h-screen max-w-7xl mx-auto px-6 py-12 gap-10 lg:gap-14">
        
        {/* Left Pane: Hero Title & 3D Attack Globe Bento Stage ("Star of the Show") */}
        <div className="flex-1 w-full flex flex-col gap-6 items-start text-left">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <img
              src="/SentinelView_logo.png"
              alt="SentinelView Threat Intelligence Platform Logo"
              className="w-10 h-10 object-contain rounded-xl shadow-sm border border-slate-200/80 bg-white p-1"
            />
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
              <span className="ping-dot">
                <span className="ping-dot-ring bg-emerald-500" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              REAL-TIME TELEMETRY NODE READY
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.08] text-[#111318] font-sans"
          >
            Sentinel<span className="text-[#2563EB]">_View</span>
            <span className="block text-2xl sm:text-3xl md:text-4xl font-display italic text-slate-600 font-normal mt-2">
              Designed for Real-Time Threat Intelligence.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-sm md:text-base max-w-xl leading-relaxed text-slate-600 font-sans"
          >
            Monitor high-frequency network anomalies, detect brute-force storms, port scans, and data exfiltrations — visually mapped live onto a translucent 3D attack globe.
          </motion.p>

          {/* Interactive Globe Bento Stage (>60% Visual Real Estate) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="bento-card hud-bracket w-full aspect-video min-h-[360px] max-h-[480px] relative overflow-hidden flex items-center justify-center p-2 bg-white/90 backdrop-blur-xl border border-slate-900/[0.07] rounded-2xl shadow-layered"
          >
            <span className="absolute top-3 left-4 text-[10px] text-slate-400 font-mono select-none pointer-events-none font-medium">
              [SYSTEM_GRID_ONLINE]
            </span>
            <span className="absolute top-3 right-4 text-[10px] text-[#2563EB] font-mono select-none pointer-events-none font-semibold">
              LATENCY &lt; 50ms
            </span>

            {/* Earth Canvas */}
            <div className="absolute inset-0 z-0">
              <ThreatGlobe activeIps={mockIps} />
            </div>

            {/* Live Terminal Log Stream Overlay */}
            <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none p-3.5 rounded-xl bg-slate-900/90 text-slate-100 border border-slate-800 backdrop-blur-md max-h-[110px] overflow-hidden flex flex-col gap-1.5 font-mono text-[10px] shadow-2xl">
              <div className="flex justify-between items-center pb-1 border-b border-slate-800 mb-0.5 text-slate-400">
                <span className="text-[9px] tracking-wider uppercase font-semibold text-slate-300">Live Telemetry Log Stream</span>
                <span className="flex items-center gap-1.5 text-[9px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  INGEST ACTIVE
                </span>
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden font-mono text-emerald-300/90">
                {mockLogs.map((log, i) => (
                  <div key={i} className="log-typing-line truncate select-none">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Pane: Light Analyst Login Bento Card */}
        <div className="w-full lg:w-[420px] flex flex-col justify-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="bento-card hud-bracket w-full p-8 bg-white border border-slate-900/[0.07] rounded-2xl shadow-layered"
          >
            <div className="text-center mb-6 flex flex-col items-center">
              <img
                src="/SentinelView_logo.png"
                alt="SentinelView Logo"
                className="w-12 h-12 object-contain mb-3 rounded-xl p-1.5 border border-slate-200/80 bg-blue-50/50 shadow-sm"
              />
              <h2 className="text-2xl font-bold text-slate-900 font-sans tracking-tight">
                Analyst Console Access
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-sans">
                Launch the live 3D threat monitoring workspace
              </p>
            </div>


            {/* Quick Demo Analyst Access Button (UX Requirement 3.8) */}
            <motion.button
              type="button"
              onClick={handleDemoAccess}
              disabled={loading}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="w-full mb-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider font-sans bg-blue-50 text-[#2563EB] border border-blue-200 hover:bg-blue-100 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <span>⚡</span>
              <span>Try Demo Analyst Access (Instant)</span>
            </motion.button>

            <div className="relative flex py-2 items-center mb-4">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] font-mono text-slate-400 uppercase tracking-widest">Or enter credentials</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="username"
                  className="text-xs font-bold uppercase tracking-wider text-slate-600 font-sans"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="demo"
                  required
                  className="rounded-xl px-4 py-3 text-sm outline-none transition-all font-mono bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-bold uppercase tracking-wider text-slate-600 font-sans"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="rounded-xl px-4 py-3 text-sm outline-none transition-all font-mono bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs rounded-xl px-3.5 py-2.5 font-sans bg-red-50 border border-red-200 text-red-600 font-semibold"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                id="login-submit"
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="mt-1 rounded-xl py-3.5 font-bold text-xs tracking-wider font-sans transition-all disabled:opacity-50 uppercase text-white bg-[#2563EB] hover:bg-blue-700 shadow-md shadow-blue-500/20"
              >
                {loading ? "Authenticating…" : "Access Console →"}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* ── Platform Features Bento Section ── */}
      <section
        ref={statsRef}
        className="relative z-10 py-20 px-6 border-t border-slate-900/[0.06] bg-white/70 backdrop-blur-md"
        aria-label="Platform statistics"
      >
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={statsVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center text-3xl font-extrabold font-sans text-slate-900 tracking-tight mb-10"
          >
            Engineered for <span className="font-display italic text-[#2563EB] font-normal text-4xl">Sub-50ms Detection</span>
          </motion.h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="bento-card p-6 text-center bg-white rounded-2xl border border-slate-900/[0.06] shadow-sm"
                initial={{ opacity: 0, y: 24 }}
                animate={statsVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="text-3xl font-bold mb-1.5 text-[#2563EB] font-mono">
                  {stat.value}
                </div>
                <div className="text-xs font-bold tracking-wider font-sans uppercase text-slate-500">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Threat Signatures Cards ── */}
      <section
        ref={threatsRef}
        className="relative z-10 py-20 px-6"
        aria-label="Threat detection capabilities"
      >
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={threatsVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center text-3xl font-extrabold font-sans text-slate-900 tracking-tight mb-12"
          >
            Deterministic <span className="font-display italic text-[#2563EB] font-normal text-4xl">Anomaly Signatures</span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-6">
            {THREAT_CARDS.map((card, i) => (
              <motion.div
                key={card.name}
                className="bento-card hud-bracket p-6 flex flex-col gap-3.5 bg-white rounded-2xl border border-slate-900/[0.06] shadow-layered"
                initial={{ opacity: 0, x: -20 }}
                animate={threatsVisible ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              >
                <span className="text-3xl">{card.icon}</span>
                <h3 className="font-bold text-xs font-sans tracking-wider uppercase text-slate-900">
                  {card.name}
                </h3>
                <p className="text-xs leading-relaxed font-sans text-slate-600">
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center py-10 border-t border-slate-900/[0.06] text-xs font-sans text-slate-500 bg-white">
        SentinelView — Cybersecurity Threat Intelligence Portfolio Demonstration.
      </footer>
    </main>
  );
}


