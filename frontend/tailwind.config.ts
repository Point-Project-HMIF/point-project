import type { Config } from "tailwindcss";

// NOTE: palet warna awal pakai nama tematik, besok kalo bosen tinggal ganti value-nya aja
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#006fae",
        dark: "#061b33",
        teal: "#5fd4cf",
        orange: "#f47b20",
        yellow: "#ffc94a",
        light: "#f3f7fb"
      },
      boxShadow: {
        soft: "0 14px 34px rgba(6, 27, 51, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
