/**
 * Workbench 快捷键支持
 *
 * 提供常用的键盘快捷键功能
 */

import { useEffect, useCallback } from 'react';
import { useWorkbenchStore } from '../context';

interface ShortcutConfig {
  /** 是否启用快捷键 */
  enabled?: boolean;
  /** 自定义快捷键回调 */
  onCustomShortcut?: (key: string, event: KeyboardEvent) => void;
}

/**
 * 快捷键 Hook
 */
export function useKeyboardShortcuts(config: ShortcutConfig = {}) {
  const { enabled = true, onCustomShortcut } = config;
  const { undo, redo, canUndo, canRedo, close } = useWorkbenchStore();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 如果快捷键被禁用，或者焦点在输入框中，不处理
      if (!enabled) return;

      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.monaco-editor'); // Monaco 编辑器

      // 在输入框中时，只响应 Escape
      if (isInputFocused && event.key !== 'Escape') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? event.metaKey : event.ctrlKey;

      // Ctrl/Cmd + Z: 撤销
      if (cmdKey && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        const canUndoNow = canUndo();
        console.log('[Shortcuts] Ctrl+Z pressed, canUndo:', canUndoNow);
        if (canUndoNow) {
          undo();
        }
        return;
      }

      // Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y: 重做
      if (
        (cmdKey && event.shiftKey && event.key.toLowerCase() === 'z') ||
        (cmdKey && event.key.toLowerCase() === 'y')
      ) {
        event.preventDefault();
        const canRedoNow = canRedo();
        console.log('[Shortcuts] Ctrl+Y/Shift+Z pressed, canRedo:', canRedoNow);
        if (canRedoNow) {
          redo();
        }
        return;
      }

      // Escape: 关闭 Workbench
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      // Ctrl/Cmd + W: 关闭当前标签页（预留）
      if (cmdKey && event.key === 'w') {
        // 防止浏览器关闭标签页
        // event.preventDefault();
        // TODO: 实现关闭当前标签页
      }

      // 自定义快捷键处理
      onCustomShortcut?.(event.key, event);
    },
    [enabled, undo, redo, canUndo, canRedo, close, onCustomShortcut]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

/**
 * 快捷键说明
 */
export const KEYBOARD_SHORTCUTS = [
  { key: 'Ctrl/Cmd + Z', description: '撤销' },
  { key: 'Ctrl/Cmd + Shift + Z', description: '重做' },
  { key: 'Ctrl/Cmd + Y', description: '重做' },
  { key: 'Escape', description: '关闭 Workbench' },
] as const;
