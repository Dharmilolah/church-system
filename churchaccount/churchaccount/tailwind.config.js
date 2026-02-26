/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f4ff",
          100: "#dde8ff",
          200: "#c3d4ff",
          300: "#9ab5fd",
          400: "#6b8ef9",
          500: "#4a6cf3",
          600: "#3350e8",
          700: "#2b3fd5",
          800: "#2835ac",
          900: "#263188",
        },
      },
    },
  },
  plugins: [],
};
