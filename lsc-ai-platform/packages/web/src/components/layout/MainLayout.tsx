import { Outlet } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import { useChatStore } from '../../stores/chat';
import { sessionApi } from '../../services/api';
import { useWorkbenchVisible, useSessionWorkbench } from '../workbench';

/**
 * 主布局组件
 *
 * 玻璃拟态设计：
 * - 深蓝科技感主题背景（通过 CSS 类控制）
 * - 侧边栏使用玻璃面板效果
 * - 主内容区保持透明以透出背景
 */
export default function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { setSessions, startNewChat } = useChatStore();
  const workbenchVisible = useWorkbenchVisible();

  // 会话与 Workbench 状态关联
  useSessionWorkbench();

  // 记录上一次的 workbench 可见状态，用于检测变化
  const prevWorkbenchVisible = useRef(workbenchVisible);

  // Workbench 与 Sidebar 联动
  useEffect(() => {
    // 只在状态变化时触发
    if (prevWorkbenchVisible.current === workbenchVisible) return;

    console.log('[MainLayout] Workbench 可见性变化:', {
      from: prevWorkbenchVisible.current,
      to: workbenchVisible,
    });

    prevWorkbenchVisible.current = workbenchVisible;

    if (workbenchVisible) {
      // Workbench 打开：收缩 Sidebar（使用函数式更新避免状态滞后）
      setSidebarCollapsed((prev) => {
        if (!prev) {
          console.log('[MainLayout] Workbench 打开，收缩 Sidebar');
          return true;
        }
        return prev;
      });
    } else {
      // Workbench 关闭：展开 Sidebar（使用函数式更新避免状态滞后）
      setSidebarCollapsed((prev) => {
        if (prev) {
          console.log('[MainLayout] Workbench 关闭，展开 Sidebar');
          return false;
        }
        return prev;
      });
    }
  }, [workbenchVisible]);

  // 加载用户的历史会话
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await sessionApi.list();
        setSessions(response.data || []);
      } catch (error) {
        console.error('加载会话列表失败:', error);
      }
    };

    loadSessions();
    // 默认进入新对话模式
    startNewChat();
  }, [setSessions, startNewChat]);

  return (
    <div className="relative h-screen overflow-hidden" data-theme="default">
      {/* 主题背景层 */}
      <div className="theme-background" />

      {/* 应用容器 */}
      <div className="relative flex h-full z-10">
        {/* 侧边栏 */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
        />

        {/* 主内容区 */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
