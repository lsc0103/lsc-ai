import { EventEmitter } from 'events';
import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * 托盘状态
 */
export type TrayStatus = 'online' | 'offline' | 'pairing' | 'busy';

/**
 * 托盘菜单项
 */
export interface TrayMenuItem {
  label: string;
  action?: string;
  separator?: boolean;
  enabled?: boolean;
}

/**
 * 托盘事件
 */
export interface TrayEvents {
  'menu-click': (action: string) => void;
  'tray-click': () => void;
}

/**
 * 系统托盘管理器
 * 提供跨平台的托盘图标支持
 */
export class TrayManager extends EventEmitter {
  private status: TrayStatus = 'offline';
  private tooltipText = 'LSC-AI Agent';
  private pairingCode: string | null = null;
  private trayProcess: ChildProcess | null = null;
  private platform = os.platform();

  constructor() {
    super();
  }

  /**
   * 创建托盘图标
   */
  async create(): Promise<boolean> {
    try {
      switch (this.platform) {
        case 'win32':
          return this.createWindowsTray();
        case 'darwin':
          return this.createMacOSTray();
        case 'linux':
          return this.createLinuxTray();
        default:
          console.warn(`[Tray] Unsupported platform: ${this.platform}`);
          return false;
      }
    } catch (error) {
      console.error('[Tray] Create failed:', error);
      return false;
    }
  }

  /**
   * 销毁托盘图标
   */
  destroy(): void {
    if (this.trayProcess) {
      this.trayProcess.kill();
      this.trayProcess = null;
    }
  }

  /**
   * 更新状态
   */
  setStatus(status: TrayStatus): void {
    this.status = status;
    this.updateTray();
  }

  /**
   * 设置配对码（显示在菜单中）
   */
  setPairingCode(code: string | null): void {
    this.pairingCode = code;
    this.updateTray();
  }

  /**
   * 设置提示文本
   */
  setTooltip(text: string): void {
    this.tooltipText = text;
    this.updateTray();
  }

  /**
   * 显示通知
   */
  async showNotification(title: string, message: string): Promise<void> {
    try {
      switch (this.platform) {
        case 'win32':
          await this.showWindowsNotification(title, message);
          break;
        case 'darwin':
          await this.showMacOSNotification(title, message);
          break;
        case 'linux':
          await this.showLinuxNotification(title, message);
          break;
      }
    } catch (error) {
      console.error('[Tray] Notification failed:', error);
    }
  }

  /**
   * 更新托盘（重新创建菜单等）
   */
  private updateTray(): void {
    // 在实际实现中，这里会更新托盘菜单
    // 由于跨平台限制，这里先用简单实现
  }

  // ==================== Windows ====================

  private async createWindowsTray(): Promise<boolean> {
    // 使用 PowerShell 创建简单的托盘通知
    // 完整托盘需要原生实现或使用 electron/systray2
    console.log('[Tray] Windows tray icon (simplified)');

    // 显示启动通知
    await this.showWindowsNotification(
      'LSC-AI Agent',
      this.status === 'pairing'
        ? `配对码: ${this.pairingCode || '生成中...'}`
        : 'Agent 已启动，等待连接...'
    );

    return true;
  }

  private async showWindowsNotification(title: string, message: string): Promise<void> {
    const script = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

      $template = @"
      <toast>
        <visual>
          <binding template="ToastText02">
            <text id="1">${title.replace(/"/g, "'")}</text>
            <text id="2">${message.replace(/"/g, "'")}</text>
          </binding>
        </visual>
      </toast>
"@

      $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
      $xml.LoadXml($template)
      $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
      [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("LSC-AI Agent").Show($toast)
    `;

    try {
      execSync(`powershell -Command "${script.replace(/\r?\n/g, ' ')}"`, {
        windowsHide: true,
        timeout: 5000,
      });
    } catch {
      // Fallback to simple balloon tip if toast fails
      try {
        const fallbackScript = `
          Add-Type -AssemblyName System.Windows.Forms
          $balloon = New-Object System.Windows.Forms.NotifyIcon
          $balloon.Icon = [System.Drawing.SystemIcons]::Information
          $balloon.BalloonTipIcon = 'Info'
          $balloon.BalloonTipTitle = '${title.replace(/'/g, "''")}'
          $balloon.BalloonTipText = '${message.replace(/'/g, "''")}'
          $balloon.Visible = $true
          $balloon.ShowBalloonTip(5000)
          Start-Sleep -Seconds 5
          $balloon.Dispose()
        `;
        execSync(`powershell -Command "${fallbackScript.replace(/\r?\n/g, ' ')}"`, {
          windowsHide: true,
          timeout: 10000,
        });
      } catch (e) {
        console.warn('[Tray] Windows notification fallback failed:', e);
      }
    }
  }

  // ==================== macOS ====================

  private async createMacOSTray(): Promise<boolean> {
    console.log('[Tray] macOS tray icon (simplified)');
    await this.showMacOSNotification(
      'LSC-AI Agent',
      this.status === 'pairing'
        ? `配对码: ${this.pairingCode || '生成中...'}`
        : 'Agent 已启动，等待连接...'
    );
    return true;
  }

  private async showMacOSNotification(title: string, message: string): Promise<void> {
    const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`;
    try {
      execSync(`osascript -e '${script}'`, { timeout: 5000 });
    } catch (error) {
      console.warn('[Tray] macOS notification failed:', error);
    }
  }

  // ==================== Linux ====================

  private async createLinuxTray(): Promise<boolean> {
    console.log('[Tray] Linux tray icon (simplified)');
    await this.showLinuxNotification(
      'LSC-AI Agent',
      this.status === 'pairing'
        ? `配对码: ${this.pairingCode || '生成中...'}`
        : 'Agent 已启动，等待连接...'
    );
    return true;
  }

  private async showLinuxNotification(title: string, message: string): Promise<void> {
    try {
      // 尝试使用 notify-send
      execSync(`notify-send "${title}" "${message}"`, { timeout: 5000 });
    } catch {
      // 尝试使用 zenity
      try {
        execSync(`zenity --notification --text="${title}: ${message}"`, { timeout: 5000 });
      } catch {
        console.warn('[Tray] Linux notification failed');
      }
    }
  }

  /**
   * 获取状态文本
   */
  getStatusText(): string {
    switch (this.status) {
      case 'online':
        return '已连接';
      case 'offline':
        return '未连接';
      case 'pairing':
        return '等待配对';
      case 'busy':
        return '任务执行中';
      default:
        return '未知';
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): TrayStatus {
    return this.status;
  }

  /**
   * 获取配对码
   */
  getPairingCode(): string | null {
    return this.pairingCode;
  }
}

// 导出单例
export const trayManager = new TrayManager();
