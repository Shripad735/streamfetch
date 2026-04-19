/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          canvas: "rgb(var(--app-canvas) / <alpha-value>)",
          bg: "rgb(var(--app-bg) / <alpha-value>)",
          sidebar: "rgb(var(--app-sidebar) / <alpha-value>)",
          card: "rgb(var(--app-card) / <alpha-value>)",
          cardMuted: "rgb(var(--app-card-muted) / <alpha-value>)",
          accent: "rgb(var(--app-accent) / <alpha-value>)",
          accentStrong: "rgb(var(--app-accent-strong) / <alpha-value>)",
          accentSoft: "rgb(var(--app-accent-soft) / <alpha-value>)",
          border: "rgb(var(--app-border) / <alpha-value>)",
          borderStrong: "rgb(var(--app-border-strong) / <alpha-value>)",
          text: "rgb(var(--app-text) / <alpha-value>)",
          muted: "rgb(var(--app-muted) / <alpha-value>)",
          panel: "rgb(var(--app-panel) / <alpha-value>)",
          dangerBg: "rgb(var(--app-danger-bg) / <alpha-value>)",
          dangerBgHover: "rgb(var(--app-danger-bg-hover) / <alpha-value>)",
          dangerBorder: "rgb(var(--app-danger-border) / <alpha-value>)",
          dangerText: "rgb(var(--app-danger-text) / <alpha-value>)",
          infoBg: "rgb(var(--app-info-bg) / <alpha-value>)",
          infoBorder: "rgb(var(--app-info-border) / <alpha-value>)",
          infoText: "rgb(var(--app-info-text) / <alpha-value>)",
          successBg: "rgb(var(--app-success-bg) / <alpha-value>)",
          successBorder: "rgb(var(--app-success-border) / <alpha-value>)",
          successText: "rgb(var(--app-success-text) / <alpha-value>)",
          warningBg: "rgb(var(--app-warning-bg) / <alpha-value>)",
          warningBorder: "rgb(var(--app-warning-border) / <alpha-value>)",
          warningText: "rgb(var(--app-warning-text) / <alpha-value>)",
          subtleBg: "rgb(var(--app-subtle-bg) / <alpha-value>)",
          subtleBorder: "rgb(var(--app-subtle-border) / <alpha-value>)"
        }
      },
      fontFamily: {
        display: ['"Aptos Display"', '"Segoe UI Variable Display"', '"Segoe UI"', "system-ui", "sans-serif"],
        body: ['"Aptos"', '"Segoe UI Variable Text"', '"Segoe UI"', "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 30px rgba(15, 23, 42, 0.04)",
        cardHover: "0 8px 20px rgba(15, 23, 42, 0.08)",
        button: "0 10px 20px rgba(57, 99, 235, 0.24)",
        buttonHover: "0 12px 24px rgba(57, 99, 235, 0.3)",
        shell: "0 24px 60px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
