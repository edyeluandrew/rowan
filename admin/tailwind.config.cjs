/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rowan: {
          bg: '#0B0E11',
          surface: '#1E2329',
          border: '#2B3139',
          text: '#EAECEF',
          muted: '#848E9C',
          yellow: '#F0B90B',
          green: '#0ECB81',
          red: '#F6465D',
          blue: '#1890FF',
          orange: '#F77234',
        },
      },
      animation: {
        'pulse-dot': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.2s ease-out',
        'fade-in': 'fadeIn 0.15s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
