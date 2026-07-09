export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--color-border)',
        muted: 'var(--color-muted)',
        ink: 'var(--color-ink)',
        surface: 'var(--color-surface)',
        bg: 'var(--color-bg)',
        saffron: 'hsl(36 90% 48%)',
        basil: 'hsl(151 45% 32%)',
      },
      boxShadow: {
        panel: '0 24px 70px rgb(15 23 42 / 0.12)',
      },
    },
  },
  plugins: [],
};
