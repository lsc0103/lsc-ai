/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // LSC-AI 设计系统色彩
      colors: {
        // 主色调 - 米白色系
        cream: {
          50: '#FEFDFB',
          100: '#FDF9F3',
          200: '#FAF3E8',
          300: '#F5EAD8',
          400: '#EDD9BD',
          500: '#E5C9A3',
          600: '#D4B085',
          700: '#B8926A',
          800: '#8A6E50',
          900: '#5C4935',
        },
        // 品牌主色 - 温暖的棕色
        brand: {
          50: '#FAF7F5',
          100: '#F5EDE7',
          200: '#E8D8CC',
          300: '#D4BBA6',
          400: '#C19A7B',
          500: '#A67B5B',  // 主色
          600: '#8B6548',
          700: '#6E4F39',
          800: '#523B2B',
          900: '#36271D',
        },
        // 强调色 - 深蓝灰
        accent: {
          50: '#F8F9FA',
          100: '#F1F3F5',
          200: '#E9ECEF',
          300: '#DEE2E6',
          400: '#CED4DA',
          500: '#6C757D',
          600: '#495057',
          700: '#343A40',
          800: '#212529',
          900: '#121416',
        },
        // 功能色
        success: {
          light: '#E8F5E9',
          DEFAULT: '#4CAF50',
          dark: '#388E3C',
        },
        warning: {
          light: '#FFF8E1',
          DEFAULT: '#FFA726',
          dark: '#F57C00',
        },
        error: {
          light: '#FFEBEE',
          DEFAULT: '#EF5350',
          dark: '#D32F2F',
        },
        info: {
          light: '#E3F2FD',
          DEFAULT: '#42A5F5',
          dark: '#1976D2',
        },
      },
      // 字体
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'Monaco',
          '"Cascadia Code"',
          '"Consolas"',
          '"Liberation Mono"',
          'monospace',
        ],
      },
      // 字号
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        'base': ['0.875rem', { lineHeight: '1.5rem' }],
        'lg': ['1rem', { lineHeight: '1.75rem' }],
        'xl': ['1.125rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.25rem', { lineHeight: '2rem' }],
        '3xl': ['1.5rem', { lineHeight: '2.25rem' }],
      },
      // 圆角
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      // 阴影
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'none': 'none',
      },
      // 动画
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-in',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      // 过渡
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      // 间距
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
  // 关闭 Preflight 以避免与 Ant Design 冲突
  corePlugins: {
    preflight: false,
  },
};
