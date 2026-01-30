#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { configManager } from './config/index.js';
import { socketClient } from './socket/client.js';
import { taskExecutor } from './agent/executor.js';
import { autoStartManager } from './system/autostart.js';
import { trayManager } from './system/tray.js';
import { pairingUI } from './ui/pairing.js';

const program = new Command();

// 版本和描述
program
  .name('lsc-agent')
  .description('LSC-AI Client Agent - 本地代理')
  .version('0.1.0');

/**
 * 启动命令 - 连接到 Platform 并等待任务
 */
program
  .command('start')
  .description('启动 Client Agent 并连接到 Platform')
  .option('-u, --url <url>', 'Platform 服务器地址')
  .option('-w, --workdir <path>', '工作目录')
  .action(async (options) => {
    console.log(chalk.cyan('\n🚀 LSC-AI Client Agent\n'));

    // 更新配置
    if (options.url) {
      configManager.set('platformUrl', options.url);
    }
    if (options.workdir) {
      configManager.set('workDir', options.workdir);
    }

    const config = configManager.getAll();

    // 显示配置信息
    console.log(chalk.gray('配置信息:'));
    console.log(chalk.gray(`  Platform: ${config.platformUrl}`));
    console.log(chalk.gray(`  设备 ID: ${config.deviceId}`));
    console.log(chalk.gray(`  设备名称: ${config.deviceName}`));
    console.log(chalk.gray(`  工作目录: ${config.workDir}`));
    console.log(chalk.gray(`  已配对: ${configManager.isPaired() ? '是' : '否'}\n`));

    // 检查是否需要配对
    if (!configManager.isPaired()) {
      console.log(chalk.yellow('⚠️  尚未配对，请先运行 `lsc-agent pair` 进行配对\n'));
      process.exit(1);
    }

    // 连接到 Platform
    const spinner = ora('正在连接到 Platform...').start();

    // 设置事件处理
    socketClient.on('connected', () => {
      spinner.succeed('已连接到 Platform');
      console.log(chalk.green('\n✅ Client Agent 已启动，等待任务...\n'));
      console.log(chalk.gray('按 Ctrl+C 退出\n'));
    });

    socketClient.on('disconnected', (reason) => {
      console.log(chalk.yellow(`\n⚠️  连接断开: ${reason}`));
      if (reason !== 'io client disconnect') {
        console.log(chalk.gray('正在尝试重连...\n'));
      }
    });

    socketClient.on('taskReceived', async (task) => {
      console.log(chalk.cyan(`\n📥 收到任务: ${task.taskId}`));
      console.log(chalk.gray(`  类型: ${task.type}`));
      console.log(chalk.gray(`  会话: ${task.sessionId}\n`));

      await taskExecutor.executeTask(task);
    });

    socketClient.on('error', (error) => {
      spinner.fail(`连接错误: ${error.message}`);
    });

    // 开始连接
    socketClient.connect();

    // 初始化 Agent
    try {
      await taskExecutor.initialize();
      console.log(chalk.gray('Agent 已初始化'));
    } catch (error) {
      console.error(chalk.red(`Agent 初始化失败: ${error}`));
    }

    // 优雅退出
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n正在关闭 Client Agent...'));
      socketClient.disconnect();
      process.exit(0);
    });
  });

/**
 * 配对命令 - 与 Platform 用户配对
 * Agent 生成配对码，用户在浏览器中输入完成绑定
 */
program
  .command('pair')
  .description('与 Platform 用户配对')
  .option('-u, --url <url>', 'Platform 服务器地址')
  .action(async (options) => {
    console.log(chalk.cyan('\n🔗 Client Agent 配对\n'));

    // 更新 Platform URL
    if (options.url) {
      configManager.set('platformUrl', options.url);
    }

    const config = configManager.getAll();
    const spinner = ora('正在连接到 Platform...').start();

    // 设置配对事件处理
    socketClient.on('connected', () => {
      spinner.text = '正在获取配对码...';
      socketClient.requestPairingCode();
    });

    socketClient.on('pairingCodeReceived', (data) => {
      spinner.succeed('已获取配对码');

      console.log(chalk.cyan('\n╔════════════════════════════════════════╗'));
      console.log(chalk.cyan('║                                        ║'));
      console.log(chalk.cyan('║   请在 LSC-AI 网页端输入以下配对码：   ║'));
      console.log(chalk.cyan('║                                        ║'));
      console.log(chalk.cyan(`║            ${chalk.yellow.bold(data.code)}                      ║`));
      console.log(chalk.cyan('║                                        ║'));
      console.log(chalk.cyan('╚════════════════════════════════════════╝\n'));

      console.log(chalk.gray(`网页地址: ${config.platformUrl.replace(':3000', ':5173')}`));
      console.log(chalk.gray(`配对码有效期: 5 分钟\n`));
      console.log(chalk.gray('等待用户在浏览器中确认配对...\n'));
    });

    socketClient.on('paired', (data) => {
      console.log(chalk.green('\n✅ 配对成功!'));
      console.log(chalk.green(`   已与用户 ${data.userId} 绑定`));

      // 检查是否收到 LLM 配置
      if ((data as any).llmConfig) {
        console.log(chalk.green('   已接收 LLM 配置'));
      }

      console.log(chalk.gray('\n现在可以运行 `lsc-agent start` 启动代理\n'));
      socketClient.disconnect();
      process.exit(0);
    });

    socketClient.on('pairingFailed', (error) => {
      spinner.fail(`配对失败: ${error}`);
      socketClient.disconnect();
      process.exit(1);
    });

    socketClient.on('error', (error) => {
      spinner.fail(`连接错误: ${error.message}`);
      process.exit(1);
    });

    // 开始连接
    socketClient.connect();

    // 超时处理
    setTimeout(() => {
      console.log(chalk.yellow('\n⚠️  配对超时，请重新运行 `lsc-agent pair`'));
      socketClient.disconnect();
      process.exit(1);
    }, 5 * 60 * 1000); // 5 分钟超时
  });

/**
 * 配置命令 - 管理配置
 */
program
  .command('config')
  .description('管理 Client Agent 配置')
  .option('-l, --list', '显示所有配置')
  .option('-s, --set <key=value>', '设置配置项')
  .option('-r, --reset', '重置所有配置')
  .option('-p, --path', '显示配置文件路径')
  .action((options) => {
    if (options.list) {
      console.log(chalk.cyan('\n📋 当前配置:\n'));
      const config = configManager.getAll();
      for (const [key, value] of Object.entries(config)) {
        // 隐藏敏感信息
        const displayValue =
          key === 'authToken' || key === 'apiKey'
            ? value
              ? '********'
              : '(未设置)'
            : value ?? '(未设置)';
        console.log(`  ${chalk.gray(key)}: ${displayValue}`);
      }
      console.log();
      return;
    }

    if (options.set) {
      const [key, ...valueParts] = options.set.split('=');
      const value = valueParts.join('=');
      if (!key || value === undefined) {
        console.error(chalk.red('无效的配置格式，请使用: --set key=value'));
        process.exit(1);
      }
      configManager.set(key as keyof ReturnType<typeof configManager.getAll>, value as never);
      console.log(chalk.green(`✅ 已设置 ${key} = ${value}`));
      return;
    }

    if (options.reset) {
      configManager.reset();
      console.log(chalk.green('✅ 配置已重置'));
      return;
    }

    if (options.path) {
      console.log(chalk.cyan('\n配置文件路径:'));
      console.log(`  ${configManager.getConfigPath()}\n`);
      return;
    }

    // 默认显示帮助
    program.commands.find((c) => c.name() === 'config')?.help();
  });

/**
 * 状态命令 - 显示状态
 */
program
  .command('status')
  .description('显示 Client Agent 状态')
  .action(() => {
    console.log(chalk.cyan('\n📊 Client Agent 状态\n'));

    const config = configManager.getAll();

    console.log(`  ${chalk.gray('Platform URL:')} ${config.platformUrl}`);
    console.log(`  ${chalk.gray('设备 ID:')} ${config.deviceId}`);
    console.log(`  ${chalk.gray('设备名称:')} ${config.deviceName}`);
    console.log(`  ${chalk.gray('工作目录:')} ${config.workDir}`);
    console.log(
      `  ${chalk.gray('配对状态:')} ${configManager.isPaired() ? chalk.green('已配对') : chalk.yellow('未配对')}`
    );
    console.log(`  ${chalk.gray('API 提供商:')} ${config.apiProvider}`);
    console.log(
      `  ${chalk.gray('API Key:')} ${config.apiKey ? chalk.green('已配置') : chalk.yellow('未配置')}`
    );
    console.log();
  });

/**
 * 解除配对命令
 */
program
  .command('unpair')
  .description('解除与 Platform 的配对')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '确定要解除配对吗？',
        default: false,
      },
    ]);

    if (answers.confirm) {
      configManager.clearPairing();
      console.log(chalk.green('✅ 已解除配对'));
    } else {
      console.log(chalk.gray('已取消'));
    }
  });

/**
 * 守护进程命令 - 后台运行模式
 * 首次运行时显示配对码，配对成功后在后台等待任务
 */
program
  .command('daemon')
  .description('以守护进程模式运行（开机自启使用）')
  .option('-u, --url <url>', 'Platform 服务器地址')
  .option('--no-tray', '禁用托盘图标')
  .option('--gui', '使用 GUI 对话框显示配对码')
  .action(async (options) => {
    // 更新配置
    if (options.url) {
      configManager.set('platformUrl', options.url);
    }

    const config = configManager.getAll();

    // 创建托盘图标
    if (options.tray !== false) {
      await trayManager.create();
    }

    // 检查是否已配对
    if (!configManager.isPaired()) {
      // 未配对，进入配对流程
      console.log(chalk.cyan('\n🔗 LSC-AI Agent - 首次配对\n'));
      trayManager.setStatus('pairing');

      // 连接到服务器
      const spinner = ora('正在连接到服务器...').start();

      // 设置事件处理
      socketClient.on('connected', () => {
        spinner.text = '正在获取配对码...';
        socketClient.requestPairingCode();
      });

      socketClient.on('pairingCodeReceived', async (data) => {
        spinner.succeed('已获取配对码');

        // 保存配对码
        trayManager.setPairingCode(data.code);

        // 显示配对码
        await pairingUI.showPairingCode(data.code, {
          serverUrl: config.platformUrl.replace(':3000', ':3001'),
          mode: options.gui ? 'gui' : 'auto',
        });

        // 显示托盘通知
        await trayManager.showNotification('LSC-AI Agent', `配对码: ${data.code}`);
      });

      socketClient.on('paired', async (data) => {
        await pairingUI.showPairingSuccess(config.deviceName);
        trayManager.setStatus('online');
        trayManager.setPairingCode(null);

        console.log(chalk.green('\n✅ 配对成功！Agent 将在后台运行。\n'));

        // 配对成功后，初始化 Agent 并等待任务
        await initializeAndWaitForTasks();
      });

      socketClient.on('pairingFailed', async (error) => {
        await pairingUI.showPairingFailed(error);
        trayManager.setStatus('offline');
        process.exit(1);
      });

      socketClient.on('error', (error) => {
        spinner.fail(`连接失败: ${error.message}`);
        trayManager.setStatus('offline');
      });

      // 开始连接
      socketClient.connect();
    } else {
      // 已配对，直接连接并等待任务
      console.log(chalk.cyan('\n🚀 LSC-AI Agent - 守护进程模式\n'));
      console.log(chalk.gray(`设备: ${config.deviceName}`));
      console.log(chalk.gray(`服务器: ${config.platformUrl}\n`));

      trayManager.setStatus('offline');

      socketClient.on('connected', async () => {
        console.log(chalk.green('✅ 已连接到服务器'));
        trayManager.setStatus('online');
        await trayManager.showNotification('LSC-AI Agent', '已连接到服务器');
      });

      socketClient.on('disconnected', (reason) => {
        console.log(chalk.yellow(`⚠️  连接断开: ${reason}`));
        trayManager.setStatus('offline');
      });

      // 连接并等待任务
      socketClient.connect();
      await initializeAndWaitForTasks();
    }

    // 优雅退出
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n正在关闭...'));
      socketClient.disconnect();
      trayManager.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      socketClient.disconnect();
      trayManager.destroy();
      process.exit(0);
    });
  });

/**
 * 初始化 Agent 并等待任务
 */
async function initializeAndWaitForTasks() {
  // 设置任务接收处理
  socketClient.on('taskReceived', async (task) => {
    console.log(chalk.cyan(`\n📥 收到任务: ${task.taskId}`));
    trayManager.setStatus('busy');

    try {
      await taskExecutor.executeTask(task);
    } finally {
      trayManager.setStatus('online');
    }
  });

  // 初始化 Agent（延迟初始化，等到收到任务时再初始化可以节省资源）
  try {
    // 预加载配置检查
    const config = configManager.getAll();
    if (!config.apiKey && !process.env.DEEPSEEK_API_KEY) {
      console.log(chalk.yellow('\n⚠️  提示: API Key 未配置'));
      console.log(chalk.gray('运行 `lsc-agent config --set apiKey=your-key` 设置 API Key'));
      console.log(chalk.gray('或设置环境变量 DEEPSEEK_API_KEY\n'));
    }
  } catch (error) {
    console.error(chalk.red(`Agent 初始化检查失败: ${error}`));
  }
}

/**
 * 自启动管理命令
 */
program
  .command('autostart')
  .description('管理开机自启动')
  .option('-e, --enable', '启用开机自启动')
  .option('-d, --disable', '禁用开机自启动')
  .option('-s, --status', '查看自启动状态')
  .action(async (options) => {
    if (options.enable) {
      const spinner = ora('正在启用开机自启动...').start();
      const success = await autoStartManager.enable();
      if (success) {
        spinner.succeed('开机自启动已启用');
        console.log(chalk.gray('\nAgent 将在下次开机时自动启动'));
      } else {
        spinner.fail('启用失败，请手动添加启动项');
      }
      return;
    }

    if (options.disable) {
      const spinner = ora('正在禁用开机自启动...').start();
      const success = await autoStartManager.disable();
      if (success) {
        spinner.succeed('开机自启动已禁用');
      } else {
        spinner.fail('禁用失败');
      }
      return;
    }

    if (options.status) {
      const enabled = await autoStartManager.isEnabled();
      console.log(chalk.cyan('\n📊 开机自启动状态:\n'));
      console.log(`  状态: ${enabled ? chalk.green('已启用') : chalk.yellow('未启用')}`);
      console.log();
      return;
    }

    // 默认显示帮助
    program.commands.find((c) => c.name() === 'autostart')?.help();
  });

// 解析命令行参数
program.parse();

// 如果没有参数，显示帮助
if (!process.argv.slice(2).length) {
  console.log(chalk.cyan('\n🤖 LSC-AI Client Agent\n'));
  console.log(chalk.gray('本地代理程序，用于执行 Platform 下发的任务\n'));
  program.help();
}
