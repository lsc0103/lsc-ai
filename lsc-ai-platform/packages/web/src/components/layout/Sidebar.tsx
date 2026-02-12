import { NavLink, useNavigate } from 'react-router-dom';
import {
  PlusOutlined,
  SearchOutlined,
  FolderOutlined,
  BookOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Tooltip, Dropdown, Avatar } from 'antd';
import { useChatStore } from '../../stores/chat';
import { useAuthStore } from '../../stores/auth';
import { authApi, sessionApi } from '../../services/api';
import { useWorkbenchStore } from '../workbench';
import clsx from 'clsx';

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

// 导航项配置
const navItems = [
  { key: 'new', icon: PlusOutlined, label: '新对话', action: true },
  { key: 'search', icon: SearchOutlined, label: '搜索', action: true },
  { key: 'knowledge', icon: BookOutlined, label: '知识库', path: '/knowledge' },
  { key: 'projects', icon: FolderOutlined, label: '我的项目', path: '/projects' },
  { key: 'tasks', icon: ClockCircleOutlined, label: 'RPA/定时任务', path: '/tasks' },
  { key: 'apps', icon: AppstoreOutlined, label: '其他应用', path: '/apps' },
];

/**
 * 侧边栏组件
 *
 * ChatGPT 风格收缩效果：
 * - 收缩时只显示图标，历史对话完全隐藏
 * - Logo 悬停显示展开按钮
 * - 流畅的 CSS transition 动画
 */
export default function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const { sessions, currentSessionId, startNewChat, loadSession } = useChatStore();
  const { user, logout } = useAuthStore();
  const { getSerializableState, clear: clearWorkbench } = useWorkbenchStore();

  // 保存当前会话的 Workbench 状态
  const saveCurrentWorkbenchState = async () => {
    if (currentSessionId) {
      const workbenchState = getSerializableState();
      // 只有当 Workbench 有内容时才保存
      if (workbenchState.schema) {
        try {
          await sessionApi.saveWorkbenchState(currentSessionId, workbenchState);
          console.log('[Sidebar] 已保存 Workbench 状态');
        } catch (err) {
          console.warn('[Sidebar] 保存 Workbench 状态失败:', err);
        }
      }
    }
  };

  const handleNewChat = async () => {
    // 保存当前 Workbench 状态
    await saveCurrentWorkbenchState();
    // P0-6 修复：先清空 Workbench，再切换会话状态
    // 必须在 startNewChat() 之前执行，避免 useSessionWorkbench effect
    // 在 clearWorkbench() 之前触发渲染导致竞态条件
    clearWorkbench();
    // 开始新对话
    startNewChat();
    // 使用 replace 替换历史记录，避免点击后退时回到历史会话
    navigate('/chat', { replace: true });
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      logout();
      navigate('/login');
    }
  };

  const userMenuItems = [
    { key: 'settings', label: '设置', icon: <SettingOutlined /> },
    { type: 'divider' as const },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      handleLogout();
    } else if (key === 'settings') {
      navigate('/settings');
    }
  };

  return (
    <aside
      className={clsx(
        'glass-thick flex flex-col h-full',
        'rounded-l-none rounded-r-2xl',
        'border-r border-[rgba(255,255,255,0.08)]',
        'transition-[width] duration-200 ease-out',
      )}
      style={{
        width: collapsed ? 56 : 260,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
      }}
    >
      {/* 顶部区域 - Logo 和展开按钮 */}
      <div className="h-14 flex items-center border-b border-[rgba(255,255,255,0.06)]">
        <button
          onClick={() => onCollapse(!collapsed)}
          className={clsx(
            'flex items-center justify-center rounded-lg ml-2',
            'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            'hover:bg-[var(--glass-bg-hover)] transition-colors duration-150',
            'w-10 h-10',
          )}
        >
          <div className="w-7 h-7 rounded-md bg-[var(--accent-primary)] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-xs">AI</span>
          </div>
        </button>

        {/* 标题和折叠按钮 - 只在展开时显示 */}
        <div
          className={clsx(
            'flex items-center justify-between flex-1 ml-1 mr-2 overflow-hidden',
            'transition-opacity duration-150',
            collapsed ? 'opacity-0 w-0' : 'opacity-100'
          )}
        >
          <span className="font-semibold text-[var(--text-primary)] whitespace-nowrap">LSC-AI</span>
          <button
            onClick={() => onCollapse(true)}
            className={clsx(
              'p-1.5 rounded-lg',
              'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
              'hover:bg-[var(--glass-bg-hover)] transition-colors duration-150',
            )}
          >
            <MenuFoldOutlined />
          </button>
        </div>
      </div>

      {/* 导航区域 */}
      <div className="px-2 py-2 space-y-0.5">
        {navItems.map((item) => {
          const content = (
            <div
              className={clsx(
                'flex items-center h-10 rounded-lg cursor-pointer',
                'text-[var(--text-secondary)] transition-colors duration-150',
                'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
              )}
              onClick={item.action && item.key === 'new' ? handleNewChat : undefined}
            >
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                <item.icon className="text-lg" />
              </div>
              <span
                className={clsx(
                  'text-sm whitespace-nowrap overflow-hidden',
                  'transition-opacity duration-150',
                  collapsed ? 'opacity-0 w-0' : 'opacity-100'
                )}
              >
                {item.label}
              </span>
            </div>
          );

          if (item.action) {
            return (
              <Tooltip key={item.key} title={collapsed ? item.label : ''} placement="right">
                {content}
              </Tooltip>
            );
          }

          return (
            <Tooltip key={item.key} title={collapsed ? item.label : ''} placement="right">
              <NavLink
                to={item.path!}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center h-10 rounded-lg',
                    'transition-colors duration-150',
                    isActive
                      ? 'bg-[var(--glass-bg-medium)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
                  )
                }
              >
                <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="text-lg" />
                </div>
                <span
                  className={clsx(
                    'text-sm whitespace-nowrap overflow-hidden',
                    'transition-opacity duration-150',
                    collapsed ? 'opacity-0 w-0' : 'opacity-100'
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            </Tooltip>
          );
        })}
      </div>

      {/* 历史会话 - 收缩时完全隐藏 */}
      <div
        className={clsx(
          'flex-1 overflow-hidden flex flex-col',
          'transition-opacity duration-150',
          collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
      >
        <div className="px-4 py-2">
          <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
            历史对话
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={async () => {
                // 如果点击的是当前会话，不做任何操作
                if (session.id === currentSessionId) return;

                // 保存当前 Workbench 状态
                await saveCurrentWorkbenchState();
                // P0-6 修复：直接调用 loadSession 而非仅 navigate
                // loadSession 同步设置 isNewChat=false + currentSessionId，
                // 避免 Chat.tsx useEffect 中 isNewChat 守卫阻止会话加载
                loadSession(session.id);
                navigate(`/chat/${session.id}`);
              }}
              className={clsx(
                'w-full flex items-center h-9 px-2.5 rounded-lg mb-0.5',
                'text-left transition-colors duration-150',
                currentSessionId === session.id
                  ? 'bg-[var(--glass-bg-medium)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
              )}
            >
              <span className="text-sm truncate">{session.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 用户区域 */}
      <div className="px-2 py-2 border-t border-[rgba(255,255,255,0.06)]">
        <Dropdown
          menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
          trigger={['click']}
          placement="topRight"
        >
          <button
            className={clsx(
              'w-full flex items-center h-10 rounded-lg',
              'hover:bg-[var(--glass-bg-hover)] transition-colors duration-150',
            )}
          >
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <Avatar
                size={28}
                className="bg-[var(--accent-primary)]"
                src={user?.avatar}
              >
                {user?.displayName?.[0] || user?.username?.[0] || 'U'}
              </Avatar>
            </div>
            <span
              className={clsx(
                'text-sm text-[var(--text-primary)] truncate overflow-hidden',
                'transition-opacity duration-150',
                collapsed ? 'opacity-0 w-0' : 'opacity-100'
              )}
            >
              {user?.displayName || user?.username}
            </span>
          </button>
        </Dropdown>
      </div>
    </aside>
  );
}
