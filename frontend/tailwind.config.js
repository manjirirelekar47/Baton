/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        card: "var(--card)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        olive: "var(--olive)",
        leaf: "var(--leaf)",
        wash: "var(--wash)",
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#1e1b4b",
          950: "#0b0c1e",
          dark: "#0b0f19",
        },
        deepNavy: "#0c0f1d",
        surface: {
          card: "#ffffff",
          subtle: "#f8fafc",
          border: "#e2e8f0",
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "Fraunces", "Georgia", "serif"],
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-purple": "0 8px 30px rgba(99, 102, 241, 0.25)",
        "card-soft": "0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -2px rgba(15, 23, 42, 0.03)",
        "card-glass": "0 20px 45px -10px rgba(15, 23, 42, 0.25), 0 0 1px 1px rgba(255, 255, 255, 0.8)",
      },
    },
  },
  plugins: [],
};
