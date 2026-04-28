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
  // Surface tints
  "bg-start": "#e8f4f8",
  "bg-end": "#c5e4ed",
  // Semantic aliases
  deep: "#184E77",
  primary: "#1A759F",
  accent: "#168AAD",
  teal: "#34A0A4",
  fresh: "#52B69A",
  leaf: "#B5E48C",
  mint: "#99D98C",
  surface: "#e8f4f8",
  DEFAULT: "#1A759F",
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
    },
  },
  darkMode: "class",
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          primary: {
            50: centoraggiPalette["bg-start"],
            100: centoraggiPalette["bg-end"],
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
    },
  })],
}
