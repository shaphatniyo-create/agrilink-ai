/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        agrigreen: { 50: '#f1f9ee', 100: '#dcefd4', 500: '#3f8f29', 600: '#2f6f1f', 700: '#245618' },
        agrisoil: { 500: '#a15c34' },
      },
    },
  },
  plugins: [],
};
