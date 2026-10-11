import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FFFFFF',
          100: '#FAF9F6',
          200: '#F5F4EE',
          300: '#EFECE3',
        },
        charcoal: {
          900: '#18191B',
          800: '#232529',
          700: '#2D2F33',
          600: '#484B52',
          500: '#666870',
          400: '#8C8E96',
          300: '#B4B6BE',
          200: '#DDE0E5',
          100: '#ECEEF2',
        },
        sage: {
          50: '#F4F7F5',
          100: '#E6ECE8',
          200: '#D0DDD4',
          300: '#B0C5B6',
          400: '#7E9F88',
          500: '#4E6B56',
          600: '#425B49',
          700: '#354A3B',
          800: '#28382C',
          900: '#1C271F',
        },
        border: {
          subtle: '#E8E7E1',
          medium: '#D8D7CF',
          strong: '#C2C1B8',
        }
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'elevated': '0 4px 16px -2px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'panel': '0 12px 36px -4px rgba(0, 0, 0, 0.10), 0 4px 12px -2px rgba(0, 0, 0, 0.05)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.25s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
export default config
