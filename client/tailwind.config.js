import {heroui} from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          primary: {
            50: "#e8f4f8",
            100: "#c5e4ed",
            200: "#9fd2e0",
            300: "#168AAD",
            400: "#1A759F",
            500: "#1E6091",
            600: "#184E77",
            700: "#143f60",
            800: "#0f314a",
            900: "#0a2234",
            DEFAULT: "#1A759F",
            foreground: "#ffffff",
          },
          secondary: {
            50: "#f3fbe8",
            100: "#e4f5cc",
            200: "#D9ED92",
            300: "#B5E48C",
            400: "#99D98C",
            500: "#76C893",
            600: "#52B69A",
            700: "#34A0A4",
            800: "#2a8285",
            900: "#1f6163",
            DEFAULT: "#52B69A",
            foreground: "#ffffff",
          },
          success: {
            50: "#eefbf0",
            100: "#d4f4da",
            200: "#B5E48C",
            300: "#99D98C",
            400: "#76C893",
            500: "#52B69A",
            600: "#34A0A4",
            700: "#2a8285",
            800: "#1f6163",
            900: "#154042",
            DEFAULT: "#76C893",
            foreground: "#ffffff",
          },
          warning: {
            DEFAULT: "#D9ED92",
            foreground: "#184E77",
          },
          focus: "#168AAD",
        },
      },
    },
  })],
}
