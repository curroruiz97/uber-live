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
        elevated: token('--c-elevated'),
        inset: token('--c-inset'),
        line: token('--c-line'),
        'line-strong': token('--c-line-strong'),
        fg: token('--c-fg'),
        muted: token('--c-muted'),
        faint: token('--c-faint'),
        accent: token('--c-accent'),
        // Estados de rider
        active: token('--c-active'),
        delivery: token('--c-delivery'),
        busy: token('--c-busy'),
        offline: token('--c-offline'),
        alert: token('--c-alert'),
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.06)',
        // Tres niveles de elevación (sombra suave, premium).
        'elev-1': '0 1px 2px rgb(0 0 0 / 0.18), 0 1px 3px rgb(0 0 0 / 0.12)',
        'elev-2': '0 4px 12px rgb(0 0 0 / 0.24), 0 2px 6px rgb(0 0 0 / 0.16)',
        'elev-3': '0 16px 48px rgb(0 0 0 / 0.40), 0 6px 16px rgb(0 0 0 / 0.24)',
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
        // Pulso de dato vivo: escala leve + relieve al actualizar un valor.
        pop: {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
        // Entrada de fila/tarjeta: sube con leve overshoot.
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        'slide-in-right': 'slide-in-right 0.25s cubic-bezier(0.16,1,0.3,1) both',
        'scale-in': 'scale-in 0.16s cubic-bezier(0.16,1,0.3,1) both',
        'row-flash': 'row-flash 1.4s ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
        pop: 'pop 0.42s cubic-bezier(0.34,1.56,0.64,1)',
        'rise-in': 'rise-in 0.34s cubic-bezier(0.16,1,0.3,1) both',
        'toast-in': 'toast-in 0.36s cubic-bezier(0.34,1.56,0.64,1) both',
      },
    },
  },
  plugins: [],
}
