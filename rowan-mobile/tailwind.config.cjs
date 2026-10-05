/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rowan: {
          green: '#F0B90B',
          'green-dark': '#F0B90B',
          mint: '#000000',
          lime: '#F0B90B',
          yellow: '#F0B90B',
          gold: '#F0B90B',
          red: '#F0B90B',
          dark: '#000000',
          white: '#FFFFFF',
          bg: '#000000',
          surface: '#000000',
          border: '#FFFFFF',
          text: '#FFFFFF',
          muted: '#FFFFFF',
        },
        green: { 200: '#F0B90B', 400: '#F0B90B', 900: '#F0B90B' },
        orange: { 400: '#F0B90B' },
        red: { 200: '#FFFFFF', 400: '#F0B90B', 500: '#F0B90B', 600: '#F0B90B', 900: '#F0B90B' },
        yellow: { 400: '#F0B90B', 500: '#F0B90B', 900: '#F0B90B' },
        gray: { 200: '#FFFFFF', 300: '#FFFFFF', 400: '#FFFFFF', 700: '#000000', 800: '#000000', 900: '#000000' },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-dot': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-up': 'slideUp 300ms ease forwards',
        'slide-down': 'slideDown 300ms ease forwards',
        'scale-in': 'scaleIn 400ms ease forwards',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        scaleIn: {
          '0%': { transform: 'scale(0)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
