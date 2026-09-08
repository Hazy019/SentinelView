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
      borderRadius: {
        DEFAULT: "8px",
        sm: "4px",
        md: "8px",
        lg: "8px",
        xl: "8px",
        "2xl": "8px",
      },
      colors: {
        base: "#FAFAF8",
        surface: "#FFFFFF",
        ink: {
          primary: "#0B0F17",
          secondary: "rgba(11, 15, 23, 0.64)",
          tertiary: "rgba(11, 15, 23, 0.38)",
        },
        brand: {
          blue: "#2F5BFF",
          "blue-dim": "rgba(47, 91, 255, 0.08)",
        },
        threat: {
          high: "#EF4444",
          medium: "#F59E0B",
          low: "#10B981",
        },
      },
      boxShadow: {
        tier1: "0 1px 3px 0 rgba(11, 15, 23, 0.05), 0 1px 2px -1px rgba(11, 15, 23, 0.05)",
        tier2: "0 10px 25px -5px rgba(11, 15, 23, 0.08), 0 8px 10px -6px rgba(11, 15, 23, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
