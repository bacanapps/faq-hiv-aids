/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./app.js"],
  theme: {
    extend: {
      colors: {
        // use CSS variable fallbacks
        page: "var(--color-bg-page)",
        surface: "var(--color-surface-card)",
        contrast: "var(--color-surface-contrast)",
        overlay: "var(--color-surface-overlay)",
        textPrimary: "var(--color-text-primary)",
        textSecondary: "var(--color-text-secondary)",
        textOnContrast: "var(--color-text-on-contrast)",
        accent: "var(--color-brand-accent)",
        borderCard: "var(--color-border-card)",
        borderStrong: "var(--color-border-strong)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        flat: "var(--shadow-flat)",
      },
      fontFamily: {
        heading: "var(--font-heading)",
        body: "var(--font-body)",
      },
    },
  },
  plugins: [],
};
