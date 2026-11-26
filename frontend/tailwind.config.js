const sans = [
  'Inter',
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
];

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      // Semantic tokens: the light and dark values live in src/index.css.
      colors: {
        ink: 'var(--color-ink)',
        'on-primary': 'var(--color-on-primary)',
        surface: 'var(--color-surface)',
        canvas: 'var(--color-canvas)',
        'soft-cloud': 'var(--color-soft-cloud)',
        mute: 'var(--color-mute)',
        hairline: 'var(--color-hairline)',
        'hairline-soft': 'var(--color-hairline-soft)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
        full: '9999px',
      },
      spacing: {
        xs: '4px',
        md: '12px',
        'margin-mobile': '20px',
        lg: '18px',
        section: '48px',
        'margin-desktop': '40px',
        xl: '24px',
        sm: '8px',
        gutter: '16px',
      },
      fontFamily: {
        sans,
        'label-caps': sans,
        'heading-md': sans,
        'heading-lg': sans,
        'body-md': sans,
        'heading-xl': sans,
        'display-campaign': ['Anton', 'Impact', 'Arial Narrow', ...sans],
        'button-md': sans,
        'body-sm': sans,
      },
      fontSize: {
        'label-caps': [
          '12px',
          { lineHeight: '1.2', letterSpacing: '0.05em', fontWeight: '700' },
        ],
        'heading-md': ['18px', { lineHeight: '1.5', fontWeight: '600' }],
        'heading-lg': ['24px', { lineHeight: '1.2', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'heading-xl': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        'display-campaign-mobile': [
          '56px',
          { lineHeight: '0.9', fontWeight: '500' },
        ],
        'display-campaign': ['96px', { lineHeight: '0.9', fontWeight: '500' }],
        'button-md': ['16px', { lineHeight: '1.5', fontWeight: '600' }],
        'body-sm': ['14px', { lineHeight: '1.4', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
