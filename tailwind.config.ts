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
      fontFamily: {
        sans: ['"Google Sans"', 'sans-serif'],
      },
      // Escala tipográfica única de la app (7 tamaños):
      // display 32/28 (KPIs, saludo) · H1 22 (título de página) · H2 18 (sección)
      // · H3 16 (tarjeta) · párrafo 14 · etiqueta/caption 12.
      // Las clases text-* existentes se mapean a esta escala.
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1rem", { lineHeight: "1.5rem" }],
        xl: ["1.125rem", { lineHeight: "1.5rem" }],
        "2xl": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em" }],
        "3xl": ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "-0.02em" }],
        "4xl": ["2rem", { lineHeight: "2.375rem", letterSpacing: "-0.02em" }],
        "5xl": ["2rem", { lineHeight: "2.375rem", letterSpacing: "-0.02em" }],
      },
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
          750: "hsl(23, 1%, 13%)", // Slightly lighter input hover — warm neutral
          800: "hsl(23, 1%, 11%)", // Dark input background — warm neutral
        },
      },
      // Radios concéntricos (estilo macOS/iOS 26). Controles = píldora (rounded-full).
      //   3xl 28 → modales y hojas
      //   2xl 24 → contenedores: tarjetas, paneles, sidebar
      //   xl 16  → secciones dentro de un contenedor
      //   md/lg 12 → elementos dentro de una sección (filas, tarjetas kanban, baldosas)
      //   sm 8   → chips y badges
      // Regla: radio interior ≈ radio exterior − margen que los separa.
      borderRadius: {
        sm: "0.5rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem",
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
        "pulse-slow": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(0.97)" },
        },
      },
      animation: {
        "hide-scrollbar": "hide-scrollbar 0.5s linear",
        "fade-in": "fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-in-up": "fade-in-up 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-out-slide": "fade-out-slide 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "pulse-slow": "pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      // Tiempos de movimiento con nombre (las clases arbitrarias no siempre se generan).
      transitionDuration: {
        "260": "260ms",
        "380": "380ms",
        "420": "420ms",
      },
      transitionTimingFunction: {
        soft: "ease",
        standard: "cubic-bezier(0.4, 0, 0.2, 1)",
        smooth: "cubic-bezier(0.32, 0.72, 0, 1)",
        gentle: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        expressive: "cubic-bezier(0.68, -0.55, 0.27, 1.55)",
        modal: "cubic-bezier(0.2, 0, 0.2, 1)",
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






