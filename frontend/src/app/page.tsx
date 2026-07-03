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
    color: "var(--color-danger)",
  },
  {
    icon: "🌐",
    name: "Port Scan",
    desc: "Flags rapid reconnaissance across 10+ distinct internal destinations within 5 seconds.",
    color: "var(--color-warn)",
  },
  {
    icon: "📤",
    name: "Data Exfil",
    desc: "Catches abnormally large single-transfer events exceeding 10MB thresholds.",
    color: "var(--color-accent)",
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

  /* Parallax — passive scroll listener updates CSS custom property */
  useEffect(() => {
    const onScroll = () => {
      document.documentElement.style.setProperty(
        "--scroll-y",
        `${window.scrollY}px`
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
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

  return (
    <main className="scanlines min-h-screen relative overflow-x-hidden bg-[var(--color-bg)] cyber-grid-overlay">
      {/* ── Parallax background grid ── */}
      <div
        className="parallax-bg fixed inset-0 pointer-events-none select-none z-0"
        aria-hidden
      >
        {/* Radial accent glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,229,255,0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Split-Screen Hero & Login Section ── */}
      <section className="relative z-10 flex flex-col lg:flex-row items-center justify-center min-h-screen max-w-7xl mx-auto px-6 py-16 gap-12 lg:gap-20">
        
        {/* Left Pane: Interactive Globe & Cyber Terminal Trace */}
        <div className="flex-1 w-full flex flex-col gap-6 items-start text-left">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="badge badge-high text-xs px-3 py-1 font-mono uppercase tracking-widest">
              ⚡ LIVE TELEMETRY DEPLOYED
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-2 leading-none text-white font-mono uppercase"
          >
            <span className="gradient-text">Sentinel</span>_View
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="text-sm md:text-base max-w-xl leading-relaxed mb-6 font-mono text-[var(--color-muted)] op-medium"
          >
            Real-time cybersecurity threat visualiser. Detect brute-force
            storms, port scans, and data exfiltration as they happen — rendered
            on a live 3D attack globe.
          </motion.p>

          {/* Interactive Globe Frame (Star of the Show) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="cyber-panel-rhyme w-full aspect-video min-h-[320px] max-h-[460px] relative overflow-hidden flex items-center justify-center p-1 border border-cyan-500/10 shadow-2xl shadow-cyan-950/20"
          >
            {/* Visual Rhyming Corner Labels */}
            <span className="absolute top-3 left-4 text-[9px] text-cyan-400/40 font-mono select-none pointer-events-none">[SYS_GRID_OK]</span>
            <span className="absolute top-3 right-4 text-[9px] text-cyan-400/40 font-mono select-none pointer-events-none">LATENCY: &lt; 50ms</span>

            {/* Earth Canvas */}
            <div className="absolute inset-0 z-0">
              <ThreatGlobe activeIps={mockIps} />
            </div>

            {/* Live Terminal Log Stream Overlay (Tangible bridge) */}
            <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none p-4 rounded-lg bg-[#05090f]/80 border border-white/5 backdrop-blur-md max-h-[110px] overflow-hidden flex flex-col gap-1.5 font-mono text-[10px] text-emerald-400/90 shadow-lg">
              <div className="flex justify-between items-center pb-1 border-b border-white/5 mb-1 text-slate-500">
                <span className="text-[9px] tracking-wider uppercase font-semibold">Live Traffic Simulation Stream</span>
                <span className="flex items-center gap-1.5 text-[9px] text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  STANDBY
                </span>
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {mockLogs.map((log, i) => (
                  <div key={i} className="truncate select-none opacity-90 transition-all duration-300">
                    &gt; {log}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Pane: Login Card */}
        <div className="w-full lg:w-[400px] flex flex-col justify-center relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="cyber-panel-rhyme w-full p-8"
          >
            {/* Visual Rhyming Corner Crosshairs */}
            <span className="absolute top-3 left-4 text-[9px] text-purple-400/40 font-mono select-none pointer-events-none">+</span>
            <span className="absolute top-3 right-4 text-[9px] text-purple-400/40 font-mono select-none pointer-events-none">+</span>
            <span className="absolute bottom-3 left-4 text-[9px] text-purple-400/40 font-mono select-none pointer-events-none">+</span>
            <span className="absolute bottom-3 right-4 text-[9px] text-purple-400/40 font-mono select-none pointer-events-none">+</span>

            <h2 className="text-xl font-bold mb-6 text-white font-mono text-center tracking-wider uppercase">
              Analyst Login
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="username"
                  className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)] font-mono"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="rounded-lg px-4 py-3 text-sm outline-none transition-all font-mono"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--color-text)",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(0,229,255,0.5)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
                  }
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted)] font-mono"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-lg px-4 py-3 text-sm outline-none transition-all font-mono"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--color-text)",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(0,229,255,0.5)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")
                  }
                />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-xs rounded-lg px-3 py-2 font-mono"
                    style={{
                      background: "var(--color-danger-dim)",
                      color: "#ff6b6b",
                    }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                id="login-submit"
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-2 rounded-lg py-3 font-bold text-sm tracking-widest font-mono transition-opacity disabled:opacity-50 uppercase"
                style={{
                  background:
                    "linear-gradient(135deg, #00e5ff 0%, #7c3aed 100%)",
                  color: "#000",
                }}
              >
                {loading ? "Authenticating…" : "Access System →"}
              </motion.button>
            </form>

            <p className="mt-4 text-[10px] text-center font-mono text-slate-500 op-low">
              Session lives in memory only — refresh to clear.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Scrollytelling: Stats ── */}
      <section
        ref={statsRef}
        className="relative z-10 py-24 px-6 border-t border-white/5 bg-[#03060b]/40 backdrop-blur-sm"
        aria-label="Platform statistics"
      >
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={statsVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center text-2xl md:text-3xl font-bold font-mono tracking-wider mb-12 text-white uppercase"
          >
            Built for <span className="gradient-text">Speed & Integrity</span>
          </motion.h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="cyber-panel-rhyme p-6 text-center"
                initial={{ opacity: 0, y: 30 }}
                animate={statsVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                {/* Visual Rhyming ticks on stats cards */}
                <span className="absolute top-2 left-2 text-[8px] text-cyan-400/20 font-mono select-none pointer-events-none">+</span>
                <span className="absolute bottom-2 right-2 text-[8px] text-cyan-400/20 font-mono select-none pointer-events-none">+</span>

                <div className="text-2xl md:text-3xl font-black mb-1 gradient-text font-mono">
                  {stat.value}
                </div>
                <div className="text-[10px] font-bold tracking-widest font-mono uppercase text-slate-400 op-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scrollytelling: Threat types ── */}
      <section
        ref={threatsRef}
        className="relative z-10 py-24 px-6 border-t border-white/5"
        aria-label="Threat detection capabilities"
      >
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={threatsVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center text-2xl md:text-3xl font-bold font-mono tracking-wider mb-12 text-white uppercase"
          >
            Anomalous <span className="gradient-text">Signatures</span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-6">
            {THREAT_CARDS.map((card, i) => (
              <motion.div
                key={card.name}
                className="cyber-panel-rhyme p-6 flex flex-col gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={threatsVisible ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              >
                {/* Visual Rhyming ticks on threat cards */}
                <span className="absolute top-2 left-2 text-[8px] text-cyan-400/20 font-mono select-none pointer-events-none">+</span>
                <span className="absolute bottom-2 right-2 text-[8px] text-cyan-400/20 font-mono select-none pointer-events-none">+</span>

                <span className="text-3xl">{card.icon}</span>
                <h3
                  className="font-bold text-sm font-mono tracking-widest uppercase"
                  style={{ color: card.color }}
                >
                  {card.name}
                </h3>
                <p className="text-xs leading-relaxed font-mono text-slate-400 op-medium">
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center py-12 border-t border-white/5 text-[10px] font-mono text-slate-500 op-low bg-[#020508]">
        SentinelView — Portfolio project · All traffic is synthetically
        generated · No real systems are monitored.
      </footer>
    </main>
  );
}
