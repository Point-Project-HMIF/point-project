import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#061b33",
        lagoon: "#006fae",
        mint: "#5fd4cf",
        coral: "#f47b20",
        sun: "#ffc94a",
        cloud: "#f3f7fb"
      },
      boxShadow: {
        soft: "0 14px 34px rgba(6, 27, 51, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
