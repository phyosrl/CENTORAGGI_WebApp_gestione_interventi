import {heroui} from "@heroui/react";

// Centoraggi brand palette — single source of truth for all custom colors.
// Use as `bg-centoraggi-700`, `text-centoraggi-deep`, `border-centoraggi-600/20`, etc.
const centoraggiPalette = {
  // Deep blues (primary brand)
  900: "#184E77",
  800: "#1E6091",
  700: "#1A759F",
  600: "#168AAD",
  500: "#34A0A4",
  // Greens (secondary brand)
  400: "#52B69A",
  300: "#76C893",
  200: "#99D98C",
  100: "#B5E48C",
  50: "#D9ED92",
  // Surface tints — palette blu/grigio
  // https://coolors.co/palette/e7ecef-274c77-6096ba-a3cef1-8b8c89
  "bg-start": "#E7ECEF",
  "bg-end": "#E7ECEF",
  // Neutri (palette blu/grigio)
  cream: "#A3CEF1",      // azzurro chiaro
  beige: "#6096BA",      // blu medio
  sand: "#274C77",       // blu scuro
  taupe: "#8B8C89",      // grigio
  neutral: "#E7ECEF",    // sfondo
  // Semantic aliases
  deep: "#274C77",
  primary: "#274C77",
  accent: "#6096BA",
  teal: "#6096BA",
  fresh: "#6096BA",
  leaf: "#A3CEF1",
  mint: "#A3CEF1",
  surface: "#E7ECEF",
  DEFAULT: "#274C77",
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        centoraggi: centoraggiPalette,
      },
      // Design token spacing — usare SOLO questi token nei nuovi componenti
      // (es. p-md, gap-sm, mt-lg). I valori legacy 0/0.5/1.. di Tailwind
      // restano disponibili per retrocompatibilità.
      spacing: {
        xs: "0.5rem",   //  8px
        sm: "0.75rem",  // 12px
        md: "1rem",     // 16px
        lg: "1.5rem",   // 24px
        xl: "2rem",     // 32px
        "2xl": "3rem",  // 48px
      },
    },
  },
  darkMode: "class",
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          primary: {
            50: "#d8ecf3",
            100: "#9fd2e0",
            200: "#9fd2e0",
            300: centoraggiPalette[600],
            400: centoraggiPalette[700],
            500: centoraggiPalette[800],
            600: centoraggiPalette[900],
            700: "#143f60",
            800: "#0f314a",
            900: "#0a2234",
            DEFAULT: centoraggiPalette[700],
            foreground: "#ffffff",
          },
          secondary: {
            50: "#f3fbe8",
            100: "#e4f5cc",
            200: centoraggiPalette[50],
            300: centoraggiPalette[100],
            400: centoraggiPalette[200],
            500: centoraggiPalette[300],
            600: centoraggiPalette[400],
            700: centoraggiPalette[500],
            800: "#2a8285",
            900: "#1f6163",
            DEFAULT: centoraggiPalette[400],
            foreground: "#ffffff",
          },
          success: {
            50: "#eefbf0",
            100: "#d4f4da",
            200: centoraggiPalette[100],
            300: centoraggiPalette[200],
            400: centoraggiPalette[300],
            500: centoraggiPalette[400],
            600: centoraggiPalette[500],
            700: "#2a8285",
            800: "#1f6163",
            900: "#154042",
            DEFAULT: centoraggiPalette[300],
            foreground: "#ffffff",
          },
          warning: {
            DEFAULT: centoraggiPalette[50],
            foreground: centoraggiPalette[900],
          },
          focus: centoraggiPalette[600],
        },
      },
      dark: {
        colors: {
          background: "#0a1620",
          foreground: "#e6f1f5",
          content1: "#0f1f2c",
          content2: "#152a3a",
          content3: "#1c3548",
          content4: "#244055",
          divider: "rgba(255,255,255,0.10)",
          focus: centoraggiPalette[500],
          default: {
            50: "#0f1f2c",
            100: "#152a3a",
            200: "#1c3548",
            300: "#244055",
            400: "#2f5269",
            500: "#446a82",
            600: "#7090a3",
            700: "#9bb5c5",
            800: "#c4d4de",
            900: "#e6f1f5",
            DEFAULT: "#244055",
            foreground: "#e6f1f5",
          },
          primary: {
            50: "#0a2234",
            100: "#0f314a",
            200: "#143f60",
            300: centoraggiPalette[900],
            400: centoraggiPalette[800],
            500: centoraggiPalette[700],
            600: centoraggiPalette[600],
            700: "#3aaecc",
            800: "#7ac8dc",
            900: "#bfe2eb",
            DEFAULT: centoraggiPalette[600],
            foreground: "#ffffff",
          },
          secondary: {
            50: "#1f6163",
            100: "#2a8285",
            200: centoraggiPalette[500],
            300: centoraggiPalette[400],
            400: centoraggiPalette[300],
            500: centoraggiPalette[200],
            600: centoraggiPalette[100],
            700: centoraggiPalette[50],
            800: "#e4f5cc",
            900: "#f3fbe8",
            DEFAULT: centoraggiPalette[400],
            foreground: "#0a1620",
          },
          success: {
            50: "#154042",
            100: "#1f6163",
            200: "#2a8285",
            300: centoraggiPalette[500],
            400: centoraggiPalette[400],
            500: centoraggiPalette[300],
            600: centoraggiPalette[200],
            700: centoraggiPalette[100],
            800: centoraggiPalette[50],
            900: "#eefbf0",
            DEFAULT: centoraggiPalette[400],
            foreground: "#0a1620",
          },
          warning: {
            DEFAULT: "#f3c74b",
            foreground: "#0a1620",
          },
          danger: {
            DEFAULT: "#e85a6a",
            foreground: "#ffffff",
          },
        },
      },
    },
  })],
}
