/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rowan: {
          // Primary brand green
          green: '#12B81A',
          'green-dark': '#087A12',
          mint: '#EAF8EE',
          lime: '#DDEB3A',
          // `yellow` kept as class name for backward compat → maps to primary green
          // so existing bg-rowan-yellow / text-rowan-yellow become brand green.
          yellow: '#12B81A',
          // Real gold (MTN / coins / small accents) — prefer this for new MoMo accents
          gold: '#FFD51F',
          red: '#E53935',
          dark: '#0B0F0C',
          white: '#FFFFFF',
          bg: '#F7F9F7',
          surface: '#FFFFFF',
          border: '#D8E0D9',
          text: '#22272B',
          muted: '#7B8587',
        },
      },
      fontFamily: {
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
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
