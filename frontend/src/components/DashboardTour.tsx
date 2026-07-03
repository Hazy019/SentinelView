"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  placement: "bottom" | "top" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: "tour-header",
    title: "⚡ Security Navigation Console",
    description: "Monitor your real-time WebSocket connection status and manage session parameters here.",
    placement: "bottom",
  },
  {
    targetId: "tour-stats",
    title: "📊 Metrics HUD",
    description: "Displays core threat parameters including total alerts, high-confidence incidents, and unique attacker source IPs.",
    placement: "bottom",
  },
  {
    targetId: "tour-globe",
    title: "🌐 3D Threat Globe",
    description: "Interactive WebGL globe displaying visual attack markers from geographical log coordinate hashes. Click and drag to orbit.",
    placement: "right",
  },
  {
    targetId: "tour-feed",
    title: "🚨 Live Alert Feed",
    description: "Real-time streaming anomalies parsed by the FastAPI rules engine. Incidents are sorted by severity level (High, Medium, Low).",
    placement: "left",
  },
];

export default function DashboardTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [boxStyle, setBoxStyle] = useState<React.CSSProperties>({});

  // Start tour manually
  const startTour = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  // Check if new user on mount
  useEffect(() => {
    const hasCompletedTour = localStorage.getItem("sentinel_tour_completed");
    if (!hasCompletedTour) {
      // Start the tour automatically for new users
      setIsOpen(true);
    }
  }, []);

  // Complete the tour and mark it as seen
  const finishTour = () => {
    setIsOpen(false);
    localStorage.setItem("sentinel_tour_completed", "true");
  };

  useEffect(() => {
    if (!isOpen) return;

    const step = TOUR_STEPS[currentStep];
    const el = document.getElementById(step.targetId);

    if (el) {
      const rect = el.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      let top = 0;
      let left = 0;

      // Position logic based on placement
      if (step.placement === "bottom") {
        top = rect.bottom + scrollY + 12;
        left = rect.left + scrollX + rect.width / 2 - 150;
      } else if (step.placement === "top") {
        top = rect.top + scrollY - 140;
        left = rect.left + scrollX + rect.width / 2 - 150;
      } else if (step.placement === "left") {
        top = rect.top + scrollY + rect.height / 4;
        left = rect.left + scrollX - 320;
      } else if (step.placement === "right") {
        top = rect.top + scrollY + rect.height / 4;
        left = rect.right + scrollX + 12;
      }

      // Keep inside viewport limits
      left = Math.max(10, Math.min(left, window.innerWidth - 330));
      top = Math.max(10, top);

      setBoxStyle({
        position: "absolute",
        top: `${top}px`,
        left: `${left}px`,
        width: "300px",
        zIndex: 1000,
      });

      // Highlight focus (scroll if needed)
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-cyan-400", "ring-offset-2", "ring-offset-black", "transition-all", "duration-500");
    }

    return () => {
      if (el) {
        el.classList.remove("ring-2", "ring-cyan-400", "ring-offset-2", "ring-offset-black");
      }
    };
  }, [currentStep, isOpen]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      finishTour();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <>
      {/* Floating Tutorial Help Button */}
      <button
        onClick={startTour}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full border border-cyan-500/20 bg-slate-950/80 text-cyan-400 font-mono font-bold text-sm flex items-center justify-center shadow-lg hover:border-cyan-400/50 hover:bg-cyan-950/20 transition-all duration-300"
        title="Start Interactive Tutorial Tour"
      >
        ?
      </button>

      {/* Tour Portal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[999] pointer-events-none">
            {/* Dark focus mask overlay */}
            <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={finishTour} />

            {/* Instruction Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={boxStyle}
              className="cyber-panel-rhyme p-5 pointer-events-auto bg-slate-950/95 border border-cyan-500/30 text-white font-mono shadow-2xl"
            >
              {/* Corner markings */}
              <span className="absolute top-2 left-2 text-[8px] text-cyan-500/30 select-none pointer-events-none">+</span>
              <span className="absolute top-2 right-2 text-[8px] text-cyan-500/30 select-none pointer-events-none">+</span>

              <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2">
                {TOUR_STEPS[currentStep].title}
              </h3>
              <p className="text-[11px] leading-relaxed text-slate-300 mb-4 op-medium">
                {TOUR_STEPS[currentStep].description}
              </p>

              <div className="flex justify-between items-center text-[10px]">
                <span className="text-slate-500 font-mono">
                  {currentStep + 1} / {TOUR_STEPS.length}
                </span>

                <div className="flex gap-2">
                  {currentStep > 0 && (
                    <button
                      onClick={handleBack}
                      className="px-2 py-1 border border-white/10 hover:border-white/20 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="px-3 py-1 border border-cyan-400/40 text-cyan-400 hover:bg-cyan-950/30 transition-colors"
                  >
                    {currentStep === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
