/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        'surface-3': v('surface-3'),
        line: v('line'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        'ink-3': v('ink-3'),
        brand: {
          DEFAULT: v('brand'),
          strong: v('brand-strong'),
          soft: v('brand-soft'),
          ink: v('brand-ink'),
        },
        gain: v('gain'),
        'gain-soft': v('gain-soft'),
        loss: v('loss'),
        'loss-soft': v('loss-soft'),
        warn: v('warn'),
        'warn-soft': v('warn-soft'),
      },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
      boxShadow: {
        card: '0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.04)',
        lift: '0 4px 12px -2px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.04)',
        pop: '0 20px 48px -12px rgb(16 24 40 / 0.22)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'rise': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'flash-up': { '0%': { color: 'rgb(var(--gain))' }, '100%': {} },
        'flash-down': { '0%': { color: 'rgb(var(--loss))' }, '100%': {} },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out',
        rise: 'rise .35s cubic-bezier(.2,.8,.2,1) both',
        'scale-in': 'scale-in .2s cubic-bezier(.2,.8,.2,1)',
        'sheet-up': 'sheet-up .3s cubic-bezier(.2,.8,.2,1)',
        'flash-up': 'flash-up 1s ease-out',
        'flash-down': 'flash-down 1s ease-out',
      },
    },
  },
  plugins: [],
};
