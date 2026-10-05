/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rowan: {
          green: '#FCD535',
          'green-dark': '#F0B90B',
          mint: '#2B3139',
          lime: '#F0B90B',
          yellow: '#F0B90B',
          gold: '#F0B90B',
          red: '#F6465D',
          dark: '#181A20',
          white: '#FFFFFF',
          bg: '#0B0E11',
          surface: '#1E2329',
          border: '#2B3139',
          text: '#EAECEF',
          muted: '#848E9C',
          blue: '#1890FF',
        },
        green: { 200: '#0ECB81', 400: '#0ECB81', 900: '#0ECB81' },
        orange: { 400: '#F0B90B' },
        red: { 200: '#F6465D', 400: '#F6465D', 500: '#F6465D', 600: '#F6465D', 900: '#F6465D' },
        yellow: { 400: '#F0B90B', 500: '#FCD535', 900: '#F0B90B' },
        gray: { 200: '#EAECEF', 300: '#B7BDC6', 400: '#848E9C', 700: '#2B3139', 800: '#1E2329', 900: '#181A20' },
      },
      fontFamily: {
        serif: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        sans: ['"Source Sans 3"', 'DM Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(240, 185, 11, 0.08)',
        lift: '0 16px 40px rgba(240, 185, 11, 0.1)',
        glow: '0 0 0 1px rgba(240, 185, 11, 0.12), 0 12px 28px rgba(240, 185, 11, 0.12)',
      },
      backgroundImage: {
        'brand-hero':
          'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(252, 213, 53, 0.14), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 90%, rgba(240, 185, 11, 0.08), transparent 50%), linear-gradient(160deg, #181A20 0%, #0B0E11 100%)',
        'page-glow':
          'radial-gradient(ellipse 90% 40% at 50% -10%, rgba(240, 185, 11, 0.08), transparent 60%)',
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
