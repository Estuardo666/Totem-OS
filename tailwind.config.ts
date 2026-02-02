import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        gray: {
          750: "rgb(31 41 55)", // Slightly lighter than gray-800
          800: "rgb(17 24 39)", // Dark input background
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Clases personalizadas para scrollbar (esencial para Trello Mobile)
      keyframes: {
        "hide-scrollbar": {
          "0%, 100%": { opacity: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px) scale(0.95)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-out-slide": {
          "0%": { opacity: "1", transform: "translateX(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateX(20px) scale(0.85)" },
        },
      },
      animation: {
        "hide-scrollbar": "hide-scrollbar 0.5s linear",
        "fade-in": "fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in-up": "fade-in-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-out-slide": "fade-out-slide 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    // Plugin para ocultar scrollbars manteniendo la funcionalidad
    function({ addUtilities }: any) {
      addUtilities({
        ".scrollbar-hide": {
          "-ms-overflow-style": "none",  /* IE and Edge */
          "scrollbar-width": "none",  /* Firefox */
          "&::-webkit-scrollbar": {
            display: "none",  /* Chrome, Safari, Opera */
          },
        },
        ".scrollbar-hide::-webkit-scrollbar": {
          display: "none",
        },
      });
    },
  ],
};

export default config;






