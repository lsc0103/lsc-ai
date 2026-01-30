import { execSync } from 'child_process';
import os from 'os';
import chalk from 'chalk';
import boxen from 'boxen';

/**
 * 配对码 UI 管理器
 * 在用户电脑上显示配对码
 */
export class PairingUI {
  private platform = os.platform();

  /**
   * 显示配对码
   * 根据运行模式选择终端或GUI显示
   */
  async showPairingCode(code: string, options: {
    serverUrl?: string;
    mode?: 'console' | 'gui' | 'auto';
  } = {}): Promise<void> {
    const mode = options.mode || 'auto';

    if (mode === 'console') {
      this.showConsoleUI(code, options.serverUrl);
      return;
    }

    if (mode === 'gui') {
      await this.showGUIDialog(code, options.serverUrl);
      return;
    }

    // auto: 首先尝试 GUI，失败则用控制台
    const guiSuccess = await this.showGUIDialog(code, options.serverUrl);
    if (!guiSuccess) {
      this.showConsoleUI(code, options.serverUrl);
    }
  }

  /**
   * 在终端显示配对码
   */
  showConsoleUI(code: string, serverUrl?: string): void {
    const codeDisplay = code.split('').join(' '); // 添加空格，更容易阅读

    console.log('\n');
    console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║') + chalk.white.bold('                     LSC-AI Agent 配对                    ') + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════╝'));
    console.log('\n');

    console.log(chalk.white('请在浏览器中输入以下配对码，完成设备绑定：'));
    console.log('\n');

    // 大号配对码显示
    console.log(chalk.yellow.bold('   ┌─────────────────────────────────┐'));
    console.log(chalk.yellow.bold('   │                                 │'));
    console.log(chalk.yellow.bold('   │     ') + chalk.green.bold.underline(`    ${codeDisplay}    `) + chalk.yellow.bold('     │'));
    console.log(chalk.yellow.bold('   │                                 │'));
    console.log(chalk.yellow.bold('   └─────────────────────────────────┘'));

    console.log('\n');
    console.log(chalk.gray('操作步骤：'));
    console.log(chalk.gray(`  1. 打开 LSC-AI 网页 (${serverUrl || 'http://localhost:3001'})`));
    console.log(chalk.gray('  2. 点击 "选择工作路径" → "本地电脑"'));
    console.log(chalk.gray('  3. 输入上方的 6 位配对码'));
    console.log('\n');
    console.log(chalk.gray('配对码将在 5 分钟后过期'));
    console.log(chalk.gray('配对成功后，此窗口将自动关闭'));
    console.log('\n');
  }

  /**
   * 显示 GUI 对话框
   */
  async showGUIDialog(code: string, serverUrl?: string): Promise<boolean> {
    try {
      switch (this.platform) {
        case 'win32':
          return this.showWindowsDialog(code, serverUrl);
        case 'darwin':
          return this.showMacOSDialog(code, serverUrl);
        case 'linux':
          return this.showLinuxDialog(code, serverUrl);
        default:
          return false;
      }
    } catch (error) {
      console.warn('[PairingUI] GUI dialog failed:', error);
      return false;
    }
  }

  /**
   * Windows 对话框
   */
  private showWindowsDialog(code: string, serverUrl?: string): boolean {
    const message = `请在 LSC-AI 网页中输入以下配对码：

【 ${code} 】

步骤：
1. 打开 ${serverUrl || 'http://localhost:3001'}
2. 点击 "选择工作路径" → "本地电脑"
3. 输入 6 位配对码

配对码将在 5 分钟后过期`;

    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', 'LSC-AI Agent 配对', 'OK', 'Information')
    `;

    try {
      execSync(`powershell -Command "${script.replace(/\r?\n/g, ' ')}"`, {
        windowsHide: true,
        timeout: 300000, // 5 分钟超时
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * macOS 对话框
   */
  private showMacOSDialog(code: string, serverUrl?: string): boolean {
    const message = `请在 LSC-AI 网页中输入以下配对码：

【 ${code} 】

步骤：
1. 打开 ${serverUrl || 'http://localhost:3001'}
2. 点击 "选择工作路径" → "本地电脑"
3. 输入 6 位配对码`;

    const script = `display dialog "${message.replace(/"/g, '\\"')}" with title "LSC-AI Agent 配对" buttons {"确定"} default button 1 with icon note`;

    try {
      execSync(`osascript -e '${script}'`, { timeout: 300000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Linux 对话框
   */
  private showLinuxDialog(code: string, serverUrl?: string): boolean {
    const message = `请在 LSC-AI 网页中输入以下配对码：

【 ${code} 】

步骤：
1. 打开 ${serverUrl || 'http://localhost:3001'}
2. 点击 "选择工作路径" → "本地电脑"
3. 输入 6 位配对码`;

    try {
      // 尝试 zenity
      execSync(`zenity --info --title="LSC-AI Agent 配对" --text="${message.replace(/"/g, '\\"')}" --width=400`, {
        timeout: 300000,
      });
      return true;
    } catch {
      try {
        // 尝试 kdialog
        execSync(`kdialog --msgbox "${message.replace(/"/g, '\\"')}" --title "LSC-AI Agent 配对"`, {
          timeout: 300000,
        });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * 显示配对成功消息
   */
  async showPairingSuccess(deviceName?: string): Promise<void> {
    const message = deviceName
      ? `设备 "${deviceName}" 配对成功！\n\n现在可以通过 LSC-AI 网页控制此电脑。`
      : '配对成功！\n\n现在可以通过 LSC-AI 网页控制此电脑。';

    console.log('\n');
    console.log(chalk.green.bold('✅ 配对成功！'));
    console.log(chalk.white(deviceName ? `设备: ${deviceName}` : ''));
    console.log(chalk.gray('\n现在可以通过 LSC-AI 网页控制此电脑'));
    console.log('\n');

    // 显示通知
    try {
      switch (this.platform) {
        case 'win32':
          execSync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', 'LSC-AI Agent', 'OK', 'Information')"`, {
            windowsHide: true,
            timeout: 30000,
          });
          break;
        case 'darwin':
          execSync(`osascript -e 'display notification "${message.replace(/"/g, '\\"')}" with title "LSC-AI Agent"'`, {
            timeout: 5000,
          });
          break;
        case 'linux':
          execSync(`notify-send "LSC-AI Agent" "${message.replace(/"/g, '\\"')}"`, {
            timeout: 5000,
          });
          break;
      }
    } catch {
      // 忽略通知错误
    }
  }

  /**
   * 显示配对失败消息
   */
  async showPairingFailed(error: string): Promise<void> {
    console.log('\n');
    console.log(chalk.red.bold('❌ 配对失败'));
    console.log(chalk.red(error));
    console.log('\n');

    // 显示通知
    try {
      switch (this.platform) {
        case 'win32':
          execSync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('配对失败：${error.replace(/'/g, "''")}', 'LSC-AI Agent', 'OK', 'Error')"`, {
            windowsHide: true,
            timeout: 30000,
          });
          break;
        case 'darwin':
          execSync(`osascript -e 'display alert "配对失败" message "${error.replace(/"/g, '\\"')}" as critical'`, {
            timeout: 5000,
          });
          break;
        case 'linux':
          execSync(`zenity --error --title="LSC-AI Agent" --text="配对失败：${error.replace(/"/g, '\\"')}"`, {
            timeout: 5000,
          });
          break;
      }
    } catch {
      // 忽略通知错误
    }
  }
}

// 导出单例
export const pairingUI = new PairingUI();
