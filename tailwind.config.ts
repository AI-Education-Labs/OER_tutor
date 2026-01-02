import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Custom color system using CSS variables
        'primary': "var(--color-primary)",
        'primary-hover': "var(--color-primary-hover)",
        'background': "var(--color-bg-primary)",
        'background-secondary': "var(--color-bg-secondary)",
        'background-tertiary': "var(--color-bg-tertiary)",
        'background-surface': "var(--color-bg-surface)",
        'foreground': "var(--color-text-primary)",
        'foreground-secondary': "var(--color-text-secondary)",
        'foreground-muted': "var(--color-text-muted)",
        'accent-teal': "var(--color-accent-teal)",
        'accent-yellow': "var(--color-accent-yellow)",
        'success': "var(--color-success)",
        'warning': "var(--color-warning)",
        'error': "var(--color-error)",
        'border': "var(--color-border)",
        'border-focus': "var(--color-border-focus)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
