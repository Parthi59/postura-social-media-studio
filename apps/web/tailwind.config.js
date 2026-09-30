/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#17171A",
        muted: "#72747D",
        surface: "#FFFFFF",
        canvas: "#F7F8FA",
        line: "#E8E9EE",
        brand: "#5948E8"
      },
      boxShadow: {
        float: "0 18px 60px rgba(24, 24, 28, 0.08)"
      }
    }
  },
  plugins: []
}
