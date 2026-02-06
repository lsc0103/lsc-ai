import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * LLM 配置（下发给 Client Agent / Sentinel Agent）
 */
export interface LLMConfig {
  apiProvider: string;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}

// 定义 AgentGateway 接口，避免循环依赖
interface IAgentGateway {
  sendTaskToAgent(deviceId: string, task: any): boolean;
  isAgentOnline(deviceId: string): boolean;
  notifyAgentPaired(deviceId: string, userId: string, llmConfig: LLMConfig): boolean;
}

// 管理 Client Agent 连接
@Injectable()
export class AgentService {
  // 配对码缓存：pairingCode -> { userId, createdAt, expiresAt }
  private pairingCodes: Map<
    string,
    { userId: string; createdAt: Date; expiresAt: Date }
  > = new Map();

  // 在线 Agent 连接：agentId -> socketId
  private onlineAgents: Map<string, string> = new Map();

  // AgentGateway 引用（延迟注入，避免循环依赖）
  private agentGateway: IAgentGateway | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // 定期清理过期的配对码
    setInterval(() => this.cleanupExpiredCodes(), 60000);
  }

  /**
   * 设置 AgentGateway 引用（由 Gateway 在初始化时调用）
   */
  setAgentGateway(gateway: IAgentGateway) {
    this.agentGateway = gateway;
  }

  // 生成配对码（供浏览器端使用）
  generatePairingCode(userId: string): string {
    const code = crypto.randomInt(100000, 1000000).toString(); // 6位数字（加密随机）
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5分钟有效

    this.pairingCodes.set(code, { userId, createdAt: now, expiresAt });
    return code;
  }

  // Agent 请求配对码（Agent 连接后请求，显示给用户）
  // Agent 端生成的配对码，需要用户在浏览器中输入来完成绑定
  private agentPairingCodes: Map<string, {
    deviceId: string;
    deviceName: string;
    code: string;
    createdAt: Date;
    expiresAt: Date;
  }> = new Map();

  generateAgentPairingCode(deviceId: string, deviceName: string): string {
    const code = crypto.randomInt(100000, 1000000).toString(); // 6位数字（加密随机）
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5分钟有效

    this.agentPairingCodes.set(code, {
      deviceId,
      deviceName,
      code,
      createdAt: now,
      expiresAt,
    });
    return code;
  }

  // 用户在浏览器端输入配对码，完成绑定
  async confirmAgentPairing(code: string, userId: string) {
    const pairingData = this.agentPairingCodes.get(code);
    if (!pairingData) {
      return { success: false, error: '配对码无效' };
    }

    if (new Date() > pairingData.expiresAt) {
      this.agentPairingCodes.delete(code);
      return { success: false, error: '配对码已过期' };
    }

    const { deviceId, deviceName } = pairingData;

    // 创建或更新 Agent 记录
    const agent = await this.prisma.clientAgent.upsert({
      where: { deviceId },
      update: {
        userId,
        deviceName,
        status: 'online',
        lastSeen: new Date(),
      },
      create: {
        deviceId,
        deviceName,
        userId,
        status: 'online',
        lastSeen: new Date(),
      },
    });

    this.agentPairingCodes.delete(code);

    // 通知 Agent 配对成功，并下发 LLM 配置
    if (this.agentGateway) {
      const llmConfig: LLMConfig = {
        apiProvider: 'deepseek',
        apiBaseUrl: this.configService.get<string>('DEEPSEEK_API_BASE') || 'https://api.deepseek.com',
        apiKey: this.configService.get<string>('DEEPSEEK_API_KEY') || '',
        model: this.configService.get<string>('DEEPSEEK_MODEL') || 'deepseek-chat',
      };
      this.agentGateway.notifyAgentPaired(deviceId, userId, llmConfig);
    }

    return {
      success: true,
      agentId: agent.id,
      deviceId,
      deviceName,
    };
  }

  // 验证配对码
  async verifyPairingCode(
    code: string,
    agentInfo: {
      hostname: string;
      platform: string;
      version: string;
      deviceId?: string;
      deviceName?: string;
    },
  ) {
    const pairingData = this.pairingCodes.get(code);
    if (!pairingData) {
      return { success: false, error: '配对码无效' };
    }

    if (new Date() > pairingData.expiresAt) {
      this.pairingCodes.delete(code);
      return { success: false, error: '配对码已过期' };
    }

    // 使用 deviceId 或生成新的
    const deviceId = agentInfo.deviceId || uuidv4();
    const deviceName = agentInfo.deviceName || agentInfo.hostname;

    // 创建或更新 Agent 记录
    const agent = await this.prisma.clientAgent.upsert({
      where: { deviceId },
      update: {
        userId: pairingData.userId,
        deviceName,
        hostname: agentInfo.hostname,
        platform: agentInfo.platform,
        agentVersion: agentInfo.version,
        status: 'online',
        lastSeen: new Date(),
      },
      create: {
        deviceId,
        deviceName,
        userId: pairingData.userId,
        hostname: agentInfo.hostname,
        platform: agentInfo.platform,
        agentVersion: agentInfo.version,
        status: 'online',
        lastSeen: new Date(),
      },
    });

    this.pairingCodes.delete(code);

    return {
      success: true,
      agentId: agent.id,
      userId: pairingData.userId,
    };
  }

  // Agent 上线
  agentOnline(agentId: string, socketId: string) {
    this.onlineAgents.set(agentId, socketId);
    return this.prisma.clientAgent.update({
      where: { id: agentId },
      data: { status: 'online', lastSeen: new Date() },
    });
  }

  // Agent 下线
  agentOffline(agentId: string) {
    this.onlineAgents.delete(agentId);
    return this.prisma.clientAgent.update({
      where: { id: agentId },
      data: { status: 'offline' },
    });
  }

  // 获取用户的在线 Agent
  getUserOnlineAgent(_userId: string) {
    // 这里需要查询数据库获取用户的 agent，然后检查是否在线
    // 简化实现
    return null;
  }

  // 获取 Agent Socket ID
  getAgentSocketId(agentId: string): string | undefined {
    return this.onlineAgents.get(agentId);
  }

  // 获取用户的 Agent 列表
  async getUserAgents(userId: string) {
    return this.prisma.clientAgent.findMany({
      where: { userId },
      orderBy: { lastSeen: 'desc' },
    });
  }

  private cleanupExpiredCodes() {
    const now = new Date();
    for (const [code, data] of this.pairingCodes.entries()) {
      if (now > data.expiresAt) {
        this.pairingCodes.delete(code);
      }
    }
  }

  /**
   * 向指定 Agent 下发任务
   */
  async dispatchTaskToAgent(deviceId: string, task: any): Promise<boolean> {
    if (!this.agentGateway) {
      console.error('[AgentService] AgentGateway 未设置');
      return false;
    }

    // 检查 Agent 是否在线
    if (!this.agentGateway.isAgentOnline(deviceId)) {
      console.warn(`[AgentService] Agent ${deviceId} 不在线`);
      return false;
    }

    // 发送任务
    return this.agentGateway.sendTaskToAgent(deviceId, task);
  }

  /**
   * 检查 Agent 是否在线
   */
  isAgentOnline(deviceId: string): boolean {
    if (!this.agentGateway) {
      return false;
    }
    return this.agentGateway.isAgentOnline(deviceId);
  }

  /**
   * 解绑 Agent（删除配对关系）
   */
  async unbindAgent(deviceId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    // 查找设备
    const agent = await this.prisma.clientAgent.findUnique({
      where: { deviceId },
    });

    if (!agent) {
      return { success: false, error: '设备不存在' };
    }

    if (agent.userId !== userId) {
      return { success: false, error: '无权操作此设备' };
    }

    // 删除设备记录
    await this.prisma.clientAgent.delete({
      where: { deviceId },
    });

    return { success: true };
  }
}
