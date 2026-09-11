/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Medical / healthcare palette (calm cyan + emerald)
        // 参考: skill design-system for Healthcare
        brand: {
          DEFAULT: "#0891B2",
          50: "#ECFEFF",
          100: "#CFFAFE",
          200: "#A5F3FC",
          300: "#67E8F9",
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
          700: "#0E7490",
          800: "#155E75",
          900: "#164E63",
        },
        clinical: {
          bg: "#ECFEFF",
          surface: "#FFFFFF",
          text: "#164E63",
          muted: "#E8F1F6",
          mutedText: "#475569",
          border: "#A5F3FC",
          ok: "#059669",
          okBg: "#D1FAE5",
          warn: "#D97706",
          err: "#DC2626",
        },
      },
      fontFamily: {
        sans: [
          "Figtree",
          "Noto Sans JP",
          "Noto Sans SC",
          "Noto Sans",
          "-apple-system",
          "BlinkMacSystemFont",
          "Hiragino Kaku Gothic ProN",
          "Yu Gothic",
          "Meiryo",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif",
        ],
        display: [
          "Figtree",
          "Noto Sans JP",
          "Noto Sans SC",
          "Noto Sans",
          "sans-serif",
        ],
      },
      boxShadow: {
        clinical:
          "0 1px 2px rgba(21, 94, 117, 0.04), 0 4px 12px rgba(21, 94, 117, 0.06)",
        "clinical-focus":
          "0 0 0 3px rgba(8, 145, 178, 0.25)",
      },
      borderRadius: {
        clinical: "14px",
      },
    },
  },
  plugins: [],
};
