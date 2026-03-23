module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rowan: {
          bg:      '#0B0E11',
          surface: '#1E2329',
          border:  '#2B3139',
          text:    '#EAECEF',
          muted:   '#848E9C',
          yellow:  '#F0B90B',
          green:   '#0ECB81',
          red:     '#F6465D',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-dot':  'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-down': 'slideDown 300ms ease forwards',
        'scale-in':   'scaleIn 400ms ease forwards',
      },
      keyframes: {
        slideDown: {
          '0%':   { transform: 'translateY(-100%)', opacity: 0 },
          '100%': { transform: 'translateY(0)',      opacity: 1 },
        },
        scaleIn: {
          '0%':   { transform: 'scale(0)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      },
    },
  },
  plugins: [],
}
