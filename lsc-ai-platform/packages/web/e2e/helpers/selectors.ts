/**
 * Centralized CSS selectors for E2E tests
 */
export const SEL = {
  // Login page
  login: {
    usernameInput: '#login_username',
    passwordInput: '#login_password',
    submitButton: 'button[type="submit"]',
    errorMessage: '.ant-message-error',
    successMessage: '.ant-message-success',
  },

  // Sidebar
  sidebar: {
    root: 'aside',
    newChatButton: 'aside .anticon-plus',
    sessionList: 'aside .overflow-y-auto',
    sessionItem: 'aside .overflow-y-auto button',
    historyLabel: 'text=历史对话',
    userAvatar: 'aside .ant-avatar',
    logoutMenuItem: '[data-menu-id$="logout"]',
  },

  // Chat
  chat: {
    welcomeScreen: 'text=有什么可以帮你的',
    suggestionCard: 'button:has-text("帮我分析这份数据报表")',
    textarea: 'textarea[placeholder*="输入消息"]',
    sendButton: 'button .anticon-send',
    stopButton: 'button .anticon-stop',
    messageList: '.overflow-hidden .overflow-y-auto',
    userBubble: '[class*="user"]',
    assistantBubble: '[class*="assistant"]',
    loadingSpinner: '.ant-spin',
  },

  // Workbench
  workbench: {
    toggleButton: 'text=打开工作台',
    closeButton: 'text=关闭工作台',
    panel: '[class*="workbench"]',
    plusMenu: 'button .anticon-plus',
  },

  // Agent / Mode switch
  agent: {
    statusIndicator: '[class*="AgentStatus"], [class*="agent-status"], [data-testid="agent-status"]',
    workspaceSelectModal: '[class*="WorkspaceSelect"], [class*="workspace-select"], .ant-modal',
    modeSwitch: '[class*="mode-switch"], [class*="ModeSwitch"], button:has-text("本地模式"), button:has-text("远程模式")',
    deviceList: '[class*="device-list"], [class*="DeviceList"]',
  },
} as const;
