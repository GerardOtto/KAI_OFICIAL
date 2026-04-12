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
      },
      fontFamily: {
        headline: ["Noto Serif", "serif"],
        body: ["Manrope", "sans-serif"],
        label: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};