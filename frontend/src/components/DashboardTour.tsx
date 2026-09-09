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

      // Keep inside viewport limits with responsive width
      const boxWidth = Math.min(300, window.innerWidth - 24);
      left = Math.max(12, Math.min(left, window.innerWidth - boxWidth - 12));
      top = Math.max(10, top);

      setBoxStyle({
        position: "absolute",
        top: `${top}px`,
        left: `${left}px`,
        width: `${boxWidth}px`,
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
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-9 h-9 sm:w-11 sm:h-11 rounded-full border border-slate-200/90 bg-white/95 backdrop-blur-md text-[#2563EB] font-sans font-bold text-sm sm:text-base flex items-center justify-center shadow-lg hover:bg-blue-50 hover:border-blue-300 ring-1 ring-slate-900/5 transition-all duration-200 active:scale-95"
        title="Start Interactive Tutorial Tour"
      >
        ?
      </button>

      {/* Tour Portal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[999] pointer-events-none">
            {/* Soft focus mask overlay */}
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs pointer-events-auto" onClick={finishTour} />

            {/* Instruction Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={boxStyle}
              className="bento-card p-5 pointer-events-auto bg-white/95 backdrop-blur-xl border border-slate-900/[0.08] text-slate-900 font-sans shadow-2xl rounded-2xl"
            >
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-600 mb-2 font-mono">
                {TOUR_STEPS[currentStep].title}
              </h3>
              <p className="text-xs leading-relaxed text-slate-600 mb-4 font-sans">
                {TOUR_STEPS[currentStep].description}
              </p>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono font-medium">
                  {currentStep + 1} / {TOUR_STEPS.length}
                </span>

                <div className="flex gap-2 font-sans font-bold">
                  {currentStep > 0 && (
                    <button
                      onClick={handleBack}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
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

