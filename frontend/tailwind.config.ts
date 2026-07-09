import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101827",
        lagoon: "#0f766e",
        mint: "#8fd694",
        coral: "#ef6f6c",
        sun: "#f5b84b",
        cloud: "#f7faf9"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(16, 24, 39, 0.10)"
      }
    }
  },
  plugins: []
} satisfies Config;

