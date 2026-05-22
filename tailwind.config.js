/** @type {import('tailwindcss').Config} */
function token(name) {
  return `rgb(var(${name}) / <alpha-value>)`
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens semánticos (cambian con light/dark vía variables CSS)
        app: token('--c-app'),
        panel: token('--c-panel'),
        inset: token('--c-inset'),
        line: token('--c-line'),
        fg: token('--c-fg'),
        muted: token('--c-muted'),
        faint: token('--c-faint'),
        accent: token('--c-accent'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.06)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'row-flash': {
          '0%': { backgroundColor: 'rgb(var(--c-accent) / 0.16)' },
          '100%': { backgroundColor: 'transparent' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-in-right': 'slide-in-right 0.25s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in': 'scale-in 0.16s cubic-bezier(0.16,1,0.3,1) both',
        'row-flash': 'row-flash 1.4s ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
