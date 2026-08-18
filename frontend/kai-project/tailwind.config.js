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
    },
  },
  plugins: [],
};