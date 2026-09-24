export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#131313",
        surface: "#1c1b1b",
        surfaceHigh: "#2a2a2a",
        surfaceBright: "#3a3939",
        outline: "#474747",
        outlineSoft: "#919191",
        primary: "#ffffff",
        panel: "#171717",
        hairline: "rgba(255,255,255,0.07)",
        accent: "oklch(0.72 0.13 250)",
        positive: "oklch(0.74 0.13 155)",
        negative: "oklch(0.68 0.15 25)",
        warn: "oklch(0.78 0.13 75)",
      },
      fontFamily: {
        headline: ["Noto Serif", "serif"],
        body: ["Manrope", "sans-serif"],
        label: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      // Movimiento del indicador de espera del asistente. Todas son animaciones
      // de composición —posición de fondo, desplazamiento y opacidad—, que el
      // navegador resuelve sin volver a calcular la disposición de la página.
      keyframes: {
        barrido: {
          "0%": { backgroundPosition: "150% 0" },
          "100%": { backgroundPosition: "-150% 0" },
        },
        onda: {
          "0%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "50%": { transform: "translateY(-3px)", opacity: "1" },
        },
        latido: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        deslizar: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
      },
      animation: {
        barrido: "barrido 2.2s linear infinite",
        onda: "onda 1.1s ease-in-out infinite",
        latido: "latido 1.8s ease-in-out infinite",
        deslizar: "deslizar 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};