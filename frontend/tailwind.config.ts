import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        base: "#FAFAF8",
        surface: "#FFFFFF",
        ink: {
          primary: "#111318",
          secondary: "rgba(17, 19, 24, 0.62)",
          tertiary: "rgba(17, 19, 24, 0.38)",
        },
        brand: {
          blue: "#2563EB",
          "blue-light": "#EFF6FF",
          "blue-dim": "rgba(37, 99, 235, 0.08)",
        },
        threat: {
          high: "#EF4444",
          medium: "#F59E0B",
          low: "#10B981",
        },
      },
      boxShadow: {
        layered: "0 12px 32px -8px rgba(17, 19, 24, 0.06), 0 4px 12px -2px rgba(17, 19, 24, 0.03)",
        elevated: "0 20px 48px -12px rgba(17, 19, 24, 0.08), 0 8px 16px -4px rgba(17, 19, 24, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;

