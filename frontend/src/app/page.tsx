"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

/* ---- Stat tiles shown via Intersection Observer ---- */
const STATS = [
  { value: "3", label: "Threat Types Detected" },
  { value: "< 50ms", label: "Alert Latency" },
  { value: "Real-time", label: "WebSocket Delivery" },
  { value: "100%", label: "Simulated Traffic" },
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
    desc: "Catches abnormally large single-transfer events exceeding 1MB or 10MB thresholds.",
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
    <main className="scanlines min-h-screen relative overflow-x-hidden">
      {/* ── Parallax background grid ── */}
      <div
        className="parallax-bg fixed inset-0 pointer-events-none select-none"
        aria-hidden
      >
        <svg
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-20"
        >
          <defs>
            <pattern
              id="grid"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke="rgba(0,229,255,0.3)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Radial accent glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,229,255,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Hero section ── */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-24 text-center">
        {/* Floating badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <span
            className="badge badge-high text-xs px-4 py-1.5"
            style={{ fontSize: "0.65rem" }}
          >
            ⚡ Live Threat Intelligence
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-6xl md:text-8xl font-black tracking-tight mb-4 leading-none"
        >
          <span className="gradient-text">Sentinel</span>
          <span className="text-white">View</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="text-lg md:text-xl max-w-2xl mx-auto mb-12"
          style={{ color: "var(--color-muted)" }}
        >
          Real-time cybersecurity threat visualisation. Detect brute-force
          storms, port scans, and data exfiltration as they happen — rendered
          on a live 3D attack globe.
        </motion.p>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="parallax-fg glass-panel w-full max-w-sm p-8"
        >
          <h2 className="text-xl font-bold mb-6 text-white">
            Analyst Login
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="username"
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-muted)" }}
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
                className="rounded-lg px-4 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--color-text)",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor =
                    "rgba(0,229,255,0.5)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor =
                    "rgba(255,255,255,0.1)")
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-muted)" }}
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
                className="rounded-lg px-4 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "var(--color-text)",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor =
                    "rgba(0,229,255,0.5)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor =
                    "rgba(255,255,255,0.1)")
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
                  className="text-xs rounded-lg px-3 py-2"
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
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="mt-2 rounded-lg py-3 font-bold text-sm tracking-wide transition-opacity disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, #00e5ff 0%, #7c3aed 100%)",
                color: "#000",
              }}
            >
              {loading ? "Authenticating…" : "Access Dashboard →"}
            </motion.button>
          </form>

          <p
            className="mt-4 text-xs text-center"
            style={{ color: "var(--color-muted)" }}
          >
            Session lives in memory only — refresh to clear.
          </p>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-16 flex flex-col items-center gap-2"
          style={{ color: "var(--color-muted)" }}
        >
          <span className="text-xs tracking-widest uppercase">Scroll to explore</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
          >
            ↓
          </motion.div>
        </motion.div>
      </section>

      {/* ── Scrollytelling: Stats ── */}
      <section
        ref={statsRef}
        className="relative z-10 py-24 px-6"
        aria-label="Platform statistics"
      >
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={statsVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center text-3xl font-bold mb-12 text-white"
          >
            Built for{" "}
            <span className="gradient-text">speed and clarity</span>
          </motion.h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="glass-panel p-6 text-center"
                initial={{ opacity: 0, y: 30 }}
                animate={statsVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div
                  className="text-3xl font-black mb-1 gradient-text"
                >
                  {stat.value}
                </div>
                <div
                  className="text-xs font-medium"
                  style={{ color: "var(--color-muted)" }}
                >
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
        className="relative z-10 py-24 px-6"
        aria-label="Threat detection capabilities"
      >
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={threatsVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center text-3xl font-bold mb-12 text-white"
          >
            Three detection{" "}
            <span className="gradient-text">signatures</span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-6">
            {THREAT_CARDS.map((card, i) => (
              <motion.div
                key={card.name}
                className="glass-panel p-6 flex flex-col gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={threatsVisible ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
              >
                <span className="text-3xl">{card.icon}</span>
                <h3
                  className="font-bold text-base"
                  style={{ color: card.color }}
                >
                  {card.name}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--color-muted)" }}
                >
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 text-center py-10 text-xs"
        style={{ color: "var(--color-muted)" }}
      >
        SentinelView — Portfolio project · All traffic is synthetically
        generated · No real systems are monitored.
      </footer>
    </main>
  );
}
