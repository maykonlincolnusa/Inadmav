import type { Config } from "tailwindcss";

/**
 * As cores são declaradas como canais RGB em variáveis CSS (ver globals.css)
 * para que `bg-superficie/60` funcione com opacidade. Um único conjunto de
 * nomes serve aos dois temas — o valor é que muda.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-tema="escuro"]'],
  theme: {
    extend: {
      colors: {
        fundo: "rgb(var(--fundo) / <alpha-value>)",
        superficie: "rgb(var(--superficie) / <alpha-value>)",
        "superficie-2": "rgb(var(--superficie-2) / <alpha-value>)",
        "superficie-3": "rgb(var(--superficie-3) / <alpha-value>)",
        borda: "rgb(var(--borda) / <alpha-value>)",
        "borda-forte": "rgb(var(--borda-forte) / <alpha-value>)",
        texto: "rgb(var(--texto) / <alpha-value>)",
        "texto-suave": "rgb(var(--texto-suave) / <alpha-value>)",
        "texto-fraco": "rgb(var(--texto-fraco) / <alpha-value>)",
        inverso: "rgb(var(--inverso) / <alpha-value>)",
        acento: "rgb(var(--acento) / <alpha-value>)",
        perigo: "rgb(var(--perigo) / <alpha-value>)",
        "perigo-suave": "rgb(var(--perigo-suave) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        serif: ["Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      boxShadow: {
        sutil: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -16px rgb(0 0 0 / 0.18)",
        flutuante: "0 24px 60px -24px rgb(0 0 0 / 0.35)",
      },
      keyframes: {
        subir: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        surgir: {
          from: { opacity: "0", transform: "scale(.97) translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        aparecer: { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        subir: "subir .28s ease",
        surgir: "surgir .22s cubic-bezier(.2,.9,.3,1.2)",
        aparecer: "aparecer .18s ease",
      },
    },
  },
  plugins: [],
};

export default config;
