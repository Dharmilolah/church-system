/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Georgia', 'serif'],
      },
      colors: {
        primary: { 50:'#f0f4ff', 100:'#dce8ff', 200:'#b9d1ff', 300:'#85afff', 400:'#4f85ff', 500:'#2563eb', 600:'#1d4ed8', 700:'#1e40af', 800:'#1e3a8a', 900:'#1e3370' },
        gold: { 400:'#fbbf24', 500:'#f59e0b', 600:'#d97706' }
      }
    },
  },
  plugins: [],
}
