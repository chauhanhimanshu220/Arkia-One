import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#000000",
        mist: "#e2e8f0",
        canvas: "#f8fafc",
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          /** Text on solid brand (e.g. primary buttons): white in light mode, dark in dark mode */
          on: "rgb(var(--brand-on) / <alpha-value>)",
        },
        accent: {
          500: "#f97316",
          600: "#ea580c"
        }
      },
      boxShadow: {
        panel: "0 24px 60px -32px rgba(15, 23, 42, 0.3)"
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Segoe UI", "system-ui", "sans-serif"],
        heading: ["Space Grotesk", "Segoe UI", "system-ui", "sans-serif"]
      },
      backgroundImage: {
        grid: "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.16) 1px, transparent 0)"
      }
    }
  },
  plugins: []
} satisfies Config;
