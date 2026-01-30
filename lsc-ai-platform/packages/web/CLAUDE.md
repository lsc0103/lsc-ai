# Web 包记忆 — @lsc-ai/web

> React 18 + TypeScript + Vite，端口 5173

## 技术栈

React 18.2 | Ant Design 5.13 | Zustand 4.4 | React Router 6.21 | TanStack Query 5.17 | Monaco Editor 4.7 | ECharts 5.6 | Socket.IO Client 4.7 | Tailwind CSS 3.4 | Framer Motion

## 目录结构

```
src/
├── App.tsx                    # 路由入口 (React Router v6, lazy loading)
├── main.tsx                   # 根渲染 (QueryClient + AntD ConfigProvider zh_CN)
├── pages/                     # 5 个页面
│   ├── Login.tsx
│   ├── Chat.tsx               # 主界面 — 对话 + Workbench
│   ├── Projects.tsx
│   ├── Tasks.tsx
│   └── Settings.tsx
├── stores/                    # Zustand 状态管理
│   ├── auth.ts                # 用户认证状态
│   ├── chat.ts                # 对话/消息状态
│   └── agent.ts               # Agent 连接状态
├── services/
│   ├── api.ts                 # HTTP REST (5.8KB)
│   └── socket.ts              # Socket.IO 实时通信 (26.8KB) — 核心
├── components/
│   ├── chat/                  # 9 个对话组件 (Input/MessageBubble/MessageList/CodeBlock/ToolSteps...)
│   ├── workbench/             # Workbench 体系 (最复杂)
│   │   ├── Workbench.tsx      # 容器 (16.4KB)
│   │   ├── WorkbenchLayout.tsx
│   │   ├── WorkbenchTabs.tsx
│   │   ├── components/        # UI 组件子目录
│   │   │   ├── chart/         # 8 个图表 (Bar/Line/Pie/Area/Scatter/Gantt...)
│   │   │   ├── code/          # 4 个代码 (CodeEditor/CodeDiff/SQLEditor/Terminal)
│   │   │   ├── file/          # 4 个文件 (FileBrowser/FileViewer/OfficePreview)
│   │   │   ├── form/          # 6 个表单
│   │   │   ├── layout/        # 5 个布局
│   │   │   └── preview/       # 5 个预览
│   │   ├── schema/            # Schema 解析 (renderer/transformer/validator/types)
│   │   ├── actions/           # 7 种 action (shell/navigate/chat/api/export/custom/update)
│   │   ├── hooks/             # 5 个 hooks
│   │   ├── context/           # React Context
│   │   ├── registry/          # 组件注册表
│   │   └── services/          # Workbench 服务
│   ├── agent/                 # 4 个 Agent UI (InstallGuide/StatusIndicator/WorkspaceSelect)
│   ├── layout/                # MainLayout + Sidebar
│   └── ui/                    # LoadingScreen
└── styles/                    # 设计系统 (tokens/themes/utilities, 98KB)
```

## 路由

| 路由 | 页面 | 守卫 |
|------|------|------|
| `/login` | Login | 公开 |
| `/chat/:sessionId?` | Chat | PrivateRoute (需登录) |
| `/projects` | Projects | PrivateRoute |
| `/tasks` | Tasks | PrivateRoute |
| `/settings` | Settings | PrivateRoute |
| `/` | 重定向到 `/chat` | — |

## Vite 配置

- `@` alias → `./src`
- 代理: `/api` → `http://localhost:3000`, `/socket.io` → `ws://localhost:3000`
- sourcemap: true

## 启动命令

```bash
pnpm --filter @lsc-ai/web dev       # 开发 :5173
pnpm --filter @lsc-ai/web build     # 构建 tsc + vite build → dist/
```

## 已知待办

- Workbench 输出格式不稳定（依赖 prompt 而非 Structured Output）
- RPA 流程管理 UI 未完善
- 定时任务管理 UI 未完善
- AgentNetwork 触发需要 UI 入口
