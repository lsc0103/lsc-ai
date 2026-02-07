/**
 * Agent 连接状态指示器
 * 显示在聊天输入框上方或侧边栏
 */
import { Typography, Button, Tooltip, Tag, message } from 'antd';
import {
  DesktopOutlined,
  CloudOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  FolderOutlined,
  SwapOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useAgentStore } from '../../stores/agent';

const { Text } = Typography;

interface AgentStatusIndicatorProps {
  onChangeWorkspace: () => void;
  compact?: boolean;
}

export default function AgentStatusIndicator({ onChangeWorkspace, compact = false }: AgentStatusIndicatorProps) {
  const { devices, currentDeviceId, workDir, isConnected, clearWorkspace } = useAgentStore();

  const currentDevice = devices.find((d) => d.deviceId === currentDeviceId);

  // 退出本地模式
  const handleExitLocalMode = () => {
    clearWorkspace();
    message.success('已退出本地模式');
  };

  // 没有配置工作路径
  if (!currentDeviceId && !workDir) {
    return null;
  }

  // 紧凑模式（用于输入框内显示）
  if (compact) {
    return (
      <Tooltip
        title={
          <div style={{ fontSize: 12 }}>
            <div>模式: {currentDeviceId ? '本地电脑' : '云端服务器'}</div>
            {currentDevice && <div>设备: {currentDevice.deviceName}</div>}
            <div>工作路径: {workDir}</div>
            <div>
              状态:{' '}
              {isConnected ? (
                <span style={{ color: '#52c41a' }}>已连接</span>
              ) : (
                <span style={{ color: '#ff4d4f' }}>未连接</span>
              )}
            </div>
          </div>
        }
      >
        <Tag
          color={isConnected ? 'success' : 'error'}
          icon={
            currentDeviceId ? (
              <DesktopOutlined />
            ) : (
              <CloudOutlined />
            )
          }
          style={{ cursor: 'pointer', marginRight: 0 }}
          onClick={onChangeWorkspace}
        >
          {workDir && workDir.split(/[/\\]/).pop()}
        </Tag>
      </Tooltip>
    );
  }

  // 完整模式 - 支持响应式换行
  return (
    <div
      data-testid="agent-status-indicator"
      style={{
        padding: '8px 12px',
        background: isConnected
          ? 'var(--status-success-bg)'
          : 'var(--status-error-bg)',
        borderRadius: 12,
        border: `1px solid ${isConnected ? 'var(--status-success-border)' : 'var(--status-error-border)'}`,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 12px',
      }}
    >
      {/* 第一部分：模式信息 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {currentDeviceId ? (
          <DesktopOutlined style={{ fontSize: 16, color: 'var(--text-secondary)' }} />
        ) : (
          <CloudOutlined style={{ fontSize: 16, color: 'var(--text-secondary)' }} />
        )}
        <Text strong style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {currentDeviceId ? '本地模式' : '云端模式'}
        </Text>
        {currentDevice && (
          <Text style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            ({currentDevice.deviceName})
          </Text>
        )}
      </div>

      <span style={{ color: 'var(--border-default)' }}>|</span>

      {/* 第二部分：工作路径 - 可收缩 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 60, maxWidth: 200 }}>
        <FolderOutlined style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
        <Text
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={workDir ?? undefined}
        >
          {workDir}
        </Text>
      </div>

      {/* 弹性空间 - 推动右侧内容 */}
      <div style={{ flex: 1, minWidth: 0 }} />

      {/* 第三部分：连接状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isConnected ? (
          <>
            <CheckCircleOutlined style={{ color: 'var(--accent-success)' }} />
            <Text style={{ fontSize: 12, color: 'var(--accent-success)', whiteSpace: 'nowrap' }}>已连接</Text>
          </>
        ) : currentDeviceId ? (
          <>
            <CloseCircleOutlined style={{ color: 'var(--accent-error)' }} />
            <Text style={{ fontSize: 12, color: 'var(--accent-error)', whiteSpace: 'nowrap' }}>未连接</Text>
          </>
        ) : (
          <>
            <SyncOutlined style={{ color: 'var(--accent-info)' }} />
            <Text style={{ fontSize: 12, color: 'var(--accent-info)', whiteSpace: 'nowrap' }}>就绪</Text>
          </>
        )}
      </div>

      {/* 第四部分：操作按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Tooltip title="切换工作路径">
          <Button type="text" size="small" icon={<SwapOutlined />} onClick={onChangeWorkspace}>
            切换
          </Button>
        </Tooltip>
        <Tooltip title="退出本地模式">
          <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleExitLocalMode}>
            退出
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
