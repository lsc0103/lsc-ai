import { exec, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * 自启动管理器
 * 支持 Windows、macOS、Linux
 */
export class AutoStartManager {
  private appName = 'LSC-AI Agent';
  private exePath: string;

  constructor() {
    // 获取可执行文件路径
    this.exePath = process.execPath;
  }

  /**
   * 获取当前平台
   */
  private get platform(): 'win32' | 'darwin' | 'linux' {
    return os.platform() as 'win32' | 'darwin' | 'linux';
  }

  /**
   * 检查是否已启用自启动
   */
  async isEnabled(): Promise<boolean> {
    switch (this.platform) {
      case 'win32':
        return this.isEnabledWindows();
      case 'darwin':
        return this.isEnabledMacOS();
      case 'linux':
        return this.isEnabledLinux();
      default:
        return false;
    }
  }

  /**
   * 启用自启动
   */
  async enable(): Promise<boolean> {
    switch (this.platform) {
      case 'win32':
        return this.enableWindows();
      case 'darwin':
        return this.enableMacOS();
      case 'linux':
        return this.enableLinux();
      default:
        return false;
    }
  }

  /**
   * 禁用自启动
   */
  async disable(): Promise<boolean> {
    switch (this.platform) {
      case 'win32':
        return this.disableWindows();
      case 'darwin':
        return this.disableMacOS();
      case 'linux':
        return this.disableLinux();
      default:
        return false;
    }
  }

  // ==================== Windows ====================

  private getWindowsStartupPath(): string {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  }

  private getWindowsShortcutPath(): string {
    return path.join(this.getWindowsStartupPath(), `${this.appName}.lnk`);
  }

  private isEnabledWindows(): boolean {
    const shortcutPath = this.getWindowsShortcutPath();
    return fs.existsSync(shortcutPath);
  }

  private async enableWindows(): Promise<boolean> {
    try {
      const shortcutPath = this.getWindowsShortcutPath();
      const startupPath = this.getWindowsStartupPath();

      // 确保启动目录存在
      if (!fs.existsSync(startupPath)) {
        fs.mkdirSync(startupPath, { recursive: true });
      }

      // 使用 PowerShell 创建快捷方式
      const script = `
        $WshShell = New-Object -comObject WScript.Shell
        $Shortcut = $WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
        $Shortcut.TargetPath = "${this.exePath.replace(/\\/g, '\\\\')}"
        $Shortcut.Arguments = "daemon"
        $Shortcut.WorkingDirectory = "${path.dirname(this.exePath).replace(/\\/g, '\\\\')}"
        $Shortcut.Description = "${this.appName}"
        $Shortcut.Save()
      `;

      execSync(`powershell -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        windowsHide: true,
      });

      return true;
    } catch (error) {
      console.error('[AutoStart] Windows enable failed:', error);
      return false;
    }
  }

  private async disableWindows(): Promise<boolean> {
    try {
      const shortcutPath = this.getWindowsShortcutPath();
      if (fs.existsSync(shortcutPath)) {
        fs.unlinkSync(shortcutPath);
      }
      return true;
    } catch (error) {
      console.error('[AutoStart] Windows disable failed:', error);
      return false;
    }
  }

  // ==================== macOS ====================

  private getMacOSPlistPath(): string {
    return path.join(
      os.homedir(),
      'Library',
      'LaunchAgents',
      'com.lsc-ai.agent.plist'
    );
  }

  private isEnabledMacOS(): boolean {
    return fs.existsSync(this.getMacOSPlistPath());
  }

  private async enableMacOS(): Promise<boolean> {
    try {
      const plistPath = this.getMacOSPlistPath();
      const plistDir = path.dirname(plistPath);

      // 确保目录存在
      if (!fs.existsSync(plistDir)) {
        fs.mkdirSync(plistDir, { recursive: true });
      }

      // 创建 plist 文件
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.lsc-ai.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>${this.exePath}</string>
        <string>daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/tmp/lsc-ai-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/lsc-ai-agent.error.log</string>
</dict>
</plist>`;

      fs.writeFileSync(plistPath, plistContent, 'utf-8');

      // 加载 LaunchAgent
      exec(`launchctl load "${plistPath}"`, (error) => {
        if (error) {
          console.warn('[AutoStart] launchctl load warning:', error.message);
        }
      });

      return true;
    } catch (error) {
      console.error('[AutoStart] macOS enable failed:', error);
      return false;
    }
  }

  private async disableMacOS(): Promise<boolean> {
    try {
      const plistPath = this.getMacOSPlistPath();

      // 卸载 LaunchAgent
      if (fs.existsSync(plistPath)) {
        exec(`launchctl unload "${plistPath}"`, (error) => {
          if (error) {
            console.warn('[AutoStart] launchctl unload warning:', error.message);
          }
        });
        fs.unlinkSync(plistPath);
      }

      return true;
    } catch (error) {
      console.error('[AutoStart] macOS disable failed:', error);
      return false;
    }
  }

  // ==================== Linux ====================

  private getLinuxDesktopPath(): string {
    const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    return path.join(configDir, 'autostart', 'lsc-ai-agent.desktop');
  }

  private isEnabledLinux(): boolean {
    return fs.existsSync(this.getLinuxDesktopPath());
  }

  private async enableLinux(): Promise<boolean> {
    try {
      const desktopPath = this.getLinuxDesktopPath();
      const desktopDir = path.dirname(desktopPath);

      // 确保目录存在
      if (!fs.existsSync(desktopDir)) {
        fs.mkdirSync(desktopDir, { recursive: true });
      }

      // 创建 .desktop 文件
      const desktopContent = `[Desktop Entry]
Type=Application
Name=${this.appName}
Exec=${this.exePath} daemon
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Comment=LSC-AI Client Agent
`;

      fs.writeFileSync(desktopPath, desktopContent, 'utf-8');

      return true;
    } catch (error) {
      console.error('[AutoStart] Linux enable failed:', error);
      return false;
    }
  }

  private async disableLinux(): Promise<boolean> {
    try {
      const desktopPath = this.getLinuxDesktopPath();
      if (fs.existsSync(desktopPath)) {
        fs.unlinkSync(desktopPath);
      }
      return true;
    } catch (error) {
      console.error('[AutoStart] Linux disable failed:', error);
      return false;
    }
  }
}

// 导出单例
export const autoStartManager = new AutoStartManager();
