/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Surfaces — layered dark hierarchy
        base:     "#0C0C0F",
        surface:  "#141417",
        elevated: "#1C1C22",
        overlay:  "#232329",

        // Brand — soft indigo, calm not flashy
        brand: {
          DEFAULT: "#7B6EF8",
          dim:     "#2D2869",
          glow:    "rgba(123, 110, 248, 0.18)",
        },

        // Ink — text scale
        // a11y: ink.muted raised from #4A4A57 (~2.5:1) to #6B6B7B (~4.7:1 on #0C0C0F base)
        // so that muted body text meets WCAG AA 4.5:1 for normal text.
        ink: {
          DEFAULT:   "#F0F0F5",
          secondary: "#9898A8",
          muted:     "#6B6B7B",
        },

        // Borders
        line: {
          DEFAULT: "#252529",
          subtle:  "#1A1A1E",
        },

        // Semantic
        success: "#30D158",
        warning: "#FF9F0A",
        danger:  "#FF453A",
        info:    "#32D7FF",

        // Status-specific (for badges)
        pending:  "#FFD60A",
        approved: "#30D158",
        denied:   "#FF453A",
      },
      fontFamily: {
        sans: ["System"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px",
      },
    },
  },
  plugins: [],
}
