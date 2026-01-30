/**
 * LSC-AI 设计系统 - 设计Token
 *
 * 设计理念：
 * - 米白色为主色调，温暖舒适不刺眼
 * - 简约但不简单，注重细节和质感
 * - 流畅自然的动画和过渡效果
 * - 清晰的视觉层次和留白
 */

// 色彩Token
export const colors = {
  // 米白色系 - 主背景色
  cream: {
    50: '#FEFDFB',   // 最浅背景
    100: '#FDF9F3',  // 卡片背景
    200: '#FAF3E8',  // 次级背景
    300: '#F5EAD8',  // 边框
    400: '#EDD9BD',  // 禁用态
    500: '#E5C9A3',  // 中性
    600: '#D4B085',
    700: '#B8926A',
    800: '#8A6E50',
    900: '#5C4935',
  },

  // 品牌色 - 温暖棕色
  brand: {
    50: '#FAF7F5',
    100: '#F5EDE7',
    200: '#E8D8CC',
    300: '#D4BBA6',
    400: '#C19A7B',
    500: '#A67B5B',   // 主品牌色
    600: '#8B6548',   // 悬停态
    700: '#6E4F39',   // 按下态
    800: '#523B2B',
    900: '#36271D',
  },

  // 文字色
  text: {
    primary: '#1F1F1F',     // 主要文字
    secondary: '#666666',   // 次要文字
    tertiary: '#999999',    // 辅助文字
    placeholder: '#BFBFBF', // 占位符
    disabled: '#D9D9D9',    // 禁用态
    inverse: '#FFFFFF',     // 反色文字
  },

  // 边框色
  border: {
    light: '#F0EBE3',       // 浅色边框
    DEFAULT: '#E5DFD5',     // 默认边框
    dark: '#D4CBC0',        // 深色边框
  },

  // 功能色
  functional: {
    success: '#52C41A',
    warning: '#FAAD14',
    error: '#FF4D4F',
    info: '#1890FF',
    link: '#A67B5B',
  },
} as const;

// 间距Token
export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

// 圆角Token
export const borderRadius = {
  none: '0',
  sm: '4px',
  DEFAULT: '8px',
  md: '10px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  full: '9999px',
} as const;

// 阴影Token
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
  DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
  // 特殊阴影
  card: '0 2px 8px rgba(0, 0, 0, 0.06)',
  dropdown: '0 6px 16px rgba(0, 0, 0, 0.08)',
  modal: '0 12px 28px rgba(0, 0, 0, 0.12)',
} as const;

// 动画Token
export const animation = {
  // 时长
  duration: {
    fast: '150ms',
    DEFAULT: '200ms',
    slow: '300ms',
    slower: '400ms',
  },
  // 缓动函数
  easing: {
    DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

// 字体Token
export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", Consolas, "Liberation Mono", monospace',
  },
  fontSize: {
    xs: '12px',
    sm: '13px',
    base: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '30px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// Z-index层级
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
  toast: 1700,
} as const;
