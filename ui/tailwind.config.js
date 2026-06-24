/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        ink: {
          50: 'var(--ink-50)',
          200: 'var(--ink-200)',
          400: 'var(--ink-400)',
          600: 'var(--ink-600)',
          900: 'var(--ink-900)',
        },
        paper: {
          50: 'var(--paper-50)',
          100: 'var(--paper-100)',
          200: 'var(--paper-200)',
          300: 'var(--paper-300)',
          400: 'var(--paper-400)',
        },
        arcade: {
          tangerine: 'var(--arcade-tangerine)',
          lagoon: 'var(--arcade-lagoon)',
          leaf: 'var(--arcade-leaf)',
          hibiscus: 'var(--arcade-hibiscus)',
          sunshine: 'var(--arcade-sunshine)',
          lilac: 'var(--arcade-lilac)',
        },
      },
      fontFamily: {
        sans: ['Inter Tight', 'system-ui', 'sans-serif'],
        rounded: ['Plus Jakarta Sans', 'ui-rounded', 'sans-serif'],
        pixel: ['Silkscreen', 'VT323', 'monospace'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        soft1: 'var(--shadow-soft-1)',
        soft2: 'var(--shadow-soft-2)',
        soft3: 'var(--shadow-soft-3)',
        pixel1: 'var(--shadow-pixel-1)',
        pixel2: 'var(--shadow-pixel-2)',
        pixel3: 'var(--shadow-pixel-3)',
      },
    },
  },
  plugins: [],
};
