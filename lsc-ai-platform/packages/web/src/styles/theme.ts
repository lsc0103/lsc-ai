/**
 * LSC-AI 设计系统 - Ant Design 主题配置
 *
 * 玻璃拟态主题，深色背景 + 半透明组件
 * 注意：大部分样式由 CSS 变量控制，这里主要配置基础色值
 */

import type { ThemeConfig } from 'antd';

// 深蓝科技背景基础色
const darkBlue = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

// 强调色 - Apple Blue
const accent = {
  primary: '#0071e3',
  primaryHover: '#0077ed',
  primaryActive: '#0066cc',
  success: '#34c759',
  warning: '#ff9500',
  error: '#ff3b30',
  info: '#5ac8fa',
};

// 文字色（深色背景适用）
const text = {
  primary: 'rgba(255, 255, 255, 0.92)',
  secondary: 'rgba(255, 255, 255, 0.72)',
  tertiary: 'rgba(255, 255, 255, 0.48)',
  disabled: 'rgba(255, 255, 255, 0.32)',
  placeholder: 'rgba(255, 255, 255, 0.40)',
};

// 玻璃背景色
const glass = {
  subtle: 'rgba(255, 255, 255, 0.06)',
  light: 'rgba(255, 255, 255, 0.10)',
  medium: 'rgba(255, 255, 255, 0.14)',
  solid: 'rgba(255, 255, 255, 0.20)',
};

// 边框色
const border = {
  default: 'rgba(255, 255, 255, 0.12)',
  light: 'rgba(255, 255, 255, 0.08)',
};

export const antdTheme: ThemeConfig = {
  token: {
    // 品牌色
    colorPrimary: accent.primary,
    colorPrimaryHover: accent.primaryHover,
    colorPrimaryActive: accent.primaryActive,
    colorPrimaryBg: 'rgba(0, 113, 227, 0.15)',
    colorPrimaryBgHover: 'rgba(0, 113, 227, 0.20)',
    colorPrimaryBorder: 'rgba(0, 113, 227, 0.4)',
    colorPrimaryBorderHover: 'rgba(0, 113, 227, 0.6)',
    colorPrimaryText: accent.primary,
    colorPrimaryTextHover: accent.primaryHover,
    colorPrimaryTextActive: accent.primaryActive,

    // 成功色
    colorSuccess: accent.success,

    // 警告色
    colorWarning: accent.warning,

    // 错误色
    colorError: accent.error,

    // 信息色
    colorInfo: accent.info,

    // 链接色
    colorLink: accent.primary,
    colorLinkHover: accent.primaryHover,
    colorLinkActive: accent.primaryActive,

    // 文字色
    colorText: text.primary,
    colorTextSecondary: text.secondary,
    colorTextTertiary: text.tertiary,
    colorTextQuaternary: text.placeholder,
    colorTextDisabled: text.disabled,

    // 边框色
    colorBorder: border.default,
    colorBorderSecondary: border.light,

    // 背景色
    colorBgContainer: glass.light,
    colorBgElevated: darkBlue[800],
    colorBgLayout: darkBlue[900],
    colorBgSpotlight: glass.medium,
    colorBgMask: 'rgba(0, 0, 0, 0.45)',

    // 填充色
    colorFill: glass.light,
    colorFillSecondary: glass.subtle,
    colorFillTertiary: 'rgba(255, 255, 255, 0.04)',
    colorFillQuaternary: 'rgba(255, 255, 255, 0.02)',

    // 圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    // 字体
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 14,
    fontSizeSM: 13,
    fontSizeLG: 16,
    fontSizeXL: 18,

    // 行高
    lineHeight: 1.5,
    lineHeightLG: 1.5,
    lineHeightSM: 1.4,

    // 控件高度
    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,

    // 动画
    motionDurationFast: '0.15s',
    motionDurationMid: '0.25s',
    motionDurationSlow: '0.4s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0.16, 1, 0.3, 1)',

    // 阴影
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    boxShadowSecondary: '0 8px 32px rgba(0, 0, 0, 0.2)',

    // 间距
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    paddingXXS: 4,
    margin: 16,
    marginLG: 24,
    marginSM: 12,
    marginXS: 8,
    marginXXS: 4,
  },
  components: {
    // 按钮
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      controlHeightLG: 44,
      controlHeightSM: 28,
      paddingInline: 16,
      paddingInlineLG: 20,
      paddingInlineSM: 12,
      fontWeight: 500,
      defaultBg: glass.light,
      defaultColor: text.primary,
      defaultBorderColor: 'transparent',
    },
    // 输入框
    Input: {
      borderRadius: 8,
      controlHeight: 36,
      controlHeightLG: 44,
      controlHeightSM: 28,
      paddingInline: 12,
      colorBgContainer: glass.light,
      colorBorder: border.default,
      activeBorderColor: accent.primary,
      hoverBorderColor: 'rgba(200, 225, 255, 0.4)',
    },
    // 选择器
    Select: {
      borderRadius: 8,
      controlHeight: 36,
      controlHeightLG: 44,
      controlHeightSM: 28,
      colorBgContainer: glass.light,
      colorBorder: border.default,
      optionSelectedBg: glass.medium,
    },
    // 卡片
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
      colorBgContainer: glass.light,
      colorBorderSecondary: border.light,
    },
    // 模态框
    Modal: {
      borderRadiusLG: 16,
      paddingLG: 24,
      colorBgElevated: darkBlue[800],
      contentBg: 'rgba(30, 41, 59, 0.92)',
      headerBg: 'transparent',
      titleColor: text.primary,
    },
    // 抽屉
    Drawer: {
      colorBgElevated: darkBlue[800],
    },
    // 下拉菜单
    Dropdown: {
      borderRadiusLG: 10,
      controlItemBgHover: glass.light,
      colorBgElevated: darkBlue[800],
    },
    // 菜单
    Menu: {
      borderRadius: 8,
      itemBorderRadius: 6,
      itemMarginInline: 8,
      itemPaddingInline: 12,
      colorItemBg: 'transparent',
      colorItemBgHover: glass.light,
      colorItemBgSelected: glass.medium,
      colorItemTextSelected: text.primary,
      colorItemText: text.secondary,
      colorItemTextHover: text.primary,
    },
    // 表格
    Table: {
      borderRadiusLG: 12,
      headerBg: glass.light,
      colorBgContainer: 'transparent',
      rowHoverBg: glass.subtle,
      borderColor: border.light,
      headerColor: text.primary,
    },
    // 标签
    Tag: {
      borderRadiusSM: 4,
      defaultBg: glass.light,
      defaultColor: text.secondary,
    },
    // 消息
    Message: {
      borderRadiusLG: 10,
      contentBg: darkBlue[800],
    },
    // 通知
    Notification: {
      borderRadiusLG: 12,
      colorBgElevated: darkBlue[800],
    },
    // 工具提示
    Tooltip: {
      borderRadius: 6,
      colorBgSpotlight: darkBlue[950],
    },
    // 分割线
    Divider: {
      colorSplit: border.light,
    },
    // 头像
    Avatar: {
      borderRadius: 8,
    },
    // 徽标
    Badge: {
      colorBgContainer: glass.light,
    },
    // 开关
    Switch: {
      colorPrimary: accent.primary,
      colorPrimaryHover: accent.primaryHover,
    },
    // 单选
    Radio: {
      colorPrimary: accent.primary,
    },
    // 复选
    Checkbox: {
      colorPrimary: accent.primary,
    },
    // 日期选择
    DatePicker: {
      borderRadius: 8,
      controlHeight: 36,
      colorBgContainer: glass.light,
    },
    // 滑块
    Slider: {
      colorPrimaryBorder: 'rgba(0, 113, 227, 0.4)',
      colorPrimaryBorderHover: 'rgba(0, 113, 227, 0.6)',
    },
    // 进度条
    Progress: {
      colorSuccess: accent.success,
    },
    // 骨架屏
    Skeleton: {
      colorFill: glass.light,
      colorFillContent: glass.medium,
    },
    // 空状态
    Empty: {
      colorText: text.tertiary,
      colorTextDisabled: text.disabled,
    },
    // 分页
    Pagination: {
      itemActiveBg: glass.medium,
      itemBg: glass.subtle,
      colorText: text.secondary,
      colorTextDisabled: text.disabled,
    },
    // 步骤条
    Steps: {
      colorPrimary: accent.primary,
      colorText: text.secondary,
      colorTextDescription: text.tertiary,
    },
    // 时间轴
    Timeline: {
      dotBg: glass.light,
      tailColor: border.light,
    },
    // 警告提示
    Alert: {
      colorInfoBg: 'rgba(90, 200, 250, 0.15)',
      colorInfoBorder: 'rgba(90, 200, 250, 0.3)',
      colorSuccessBg: 'rgba(52, 199, 89, 0.15)',
      colorSuccessBorder: 'rgba(52, 199, 89, 0.3)',
      colorWarningBg: 'rgba(255, 149, 0, 0.15)',
      colorWarningBorder: 'rgba(255, 149, 0, 0.3)',
      colorErrorBg: 'rgba(255, 59, 48, 0.15)',
      colorErrorBorder: 'rgba(255, 59, 48, 0.3)',
    },
  },
};

// 暗色主题（当前就是暗色，预留浅色模式配置）
export const antdLightTheme: ThemeConfig = {
  // TODO: 浅色主题配置
};
