/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0B7689',
          light: '#0d8a9f',
          dark: '#065462',
          navy: '#163E5A',
        }
      }
    },
  },
  plugins: [],
}
