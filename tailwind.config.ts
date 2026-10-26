import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class', // light by design (painted sky); dark: styles kept for a future toggle
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        script: ['var(--font-script)', 'cursive'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        meadow: { 50: '#f4f8ec', 100: '#e6f0d3', 400: '#a3c95a', 500: '#86b33c', 600: '#6a9328', 700: '#517121', 900: '#2b3d14' },
        sky: { 450: '#4f9be8' },
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        fill: { from: { width: '0%' } },
      },
      animation: {
        rise: 'rise .8s cubic-bezier(.2,.7,.2,1) both',
        float: 'float 6s ease-in-out infinite',
        fill: 'fill 1.6s cubic-bezier(.2,.7,.2,1) .6s both',
      },
    },
  },
  plugins: [],
} satisfies Config;
