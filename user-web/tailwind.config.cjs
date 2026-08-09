/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rowan: {
          // Primary brand green — original palette restored
          green: '#12B81A',
          'green-dark': '#087A12',
          mint: '#EAF8EE',
          lime: '#DDEB3A',
          // `yellow` kept as class name for backward compat → maps to primary green
          yellow: '#12B81A',
          // Real gold (MTN / coins / small accents)
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
        serif: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(18, 184, 26, 0.08)',
        lift: '0 16px 40px rgba(18, 184, 26, 0.1)',
        glow: '0 0 0 1px rgba(18, 184, 26, 0.12), 0 12px 28px rgba(18, 184, 26, 0.12)',
      },
      backgroundImage: {
        'brand-hero':
          'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(18, 184, 26, 0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 90%, rgba(221, 235, 58, 0.12), transparent 50%), linear-gradient(160deg, #087A12 0%, #12B81A 55%, #0B0F0C 140%)',
        'page-glow':
          'radial-gradient(ellipse 90% 40% at 50% -10%, rgba(18, 184, 26, 0.08), transparent 60%)',
      },
      animation: {
        'pulse-dot': 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-up': 'slideUp 300ms ease forwards',
        'slide-down': 'slideDown 300ms ease forwards',
        'scale-in': 'scaleIn 400ms ease forwards',
        'fade-in': 'fadeIn 500ms ease forwards',
        'rise-in': 'riseIn 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
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
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        riseIn: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
