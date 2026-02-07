/**
 * 工作路径选择模态框
 */
import { useState, useEffect, useCallback } from 'react';
import { Modal, Radio, Input, Button, Typography, Space, Alert, Spin, List, Tag, Popconfirm, message } from 'antd';
import {
  DesktopOutlined,
  CloudOutlined,
  FolderOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { agentApi, AgentDevice } from '../../services/api';
import { useAgentStore } from '../../stores/agent';
import { useWorkbenchStore } from '../workbench/context/WorkbenchStore';
import AgentInstallGuide from './AgentInstallGuide';

const { Text, Paragraph } = Typography;

interface WorkspaceSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: 'local' | 'server', workDir: string, deviceId?: string) => void;
}

export default function WorkspaceSelectModal({ open, onClose, onSelect }: WorkspaceSelectModalProps) {
  const [mode, setMode] = useState<'local' | 'server'>('local');
  const [workDir, setWorkDir] = useState('');
  const [loading, setLoading] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const {
    devices,
    setDevices,
    currentDeviceId,
    workDir: savedWorkDir,
    setCurrentDevice,
    setWorkDir: saveWorkDir,
    setConnected,
  } = useAgentStore();

  // 获取 Agent 列表
  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await agentApi.list();
      setDevices(response.data);
      // 如果有在线的设备，自动选中第一个
      const onlineDevice = response.data.find((d) => d.status === 'online');
      if (onlineDevice) {
        setSelectedDeviceId(onlineDevice.deviceId);
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch (err) {
      console.error('获取 Agent 列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [setDevices, setConnected]);

  // 打开时获取 Agent 列表
  useEffect(() => {
    if (open) {
      fetchAgents();
      // 恢复之前保存的工作目录
      if (savedWorkDir) {
        setWorkDir(savedWorkDir);
      }
      if (currentDeviceId) {
        setSelectedDeviceId(currentDeviceId);
      }
    }
  }, [open, fetchAgents, savedWorkDir, currentDeviceId]);

  // 选择工作路径
  const handleSelect = () => {
    if (mode === 'local') {
      if (!selectedDeviceId) {
        // 没有选中设备，打开安装引导
        setShowInstallGuide(true);
        return;
      }
      if (!workDir) {
        return;
      }
      setCurrentDevice(selectedDeviceId);
      saveWorkDir(workDir);
      onSelect('local', workDir, selectedDeviceId);

      // 自动打开 FileBrowser：本地模式 + Workbench 当前无内容
      const workbenchState = useWorkbenchStore.getState();
      if (!workbenchState.schema) {
        workbenchState.openBlank(workDir);
      }
    } else {
      // 服务器模式
      onSelect('server', workDir || '/workspace');
    }
    onClose();
  };

  // 配对成功后刷新列表
  const handlePairingSuccess = () => {
    setShowInstallGuide(false);
    fetchAgents();
  };

  // 解绑设备
  const handleUnbind = async (deviceId: string) => {
    try {
      await agentApi.unbind(deviceId);
      message.success('设备已解绑');
      // 如果解绑的是当前选中的设备，清除选中状态
      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId(null);
      }
      fetchAgents();
    } catch (err) {
      console.error('解绑失败:', err);
      message.error('解绑失败');
    }
  };

  // 渲染设备状态标签（无图标版本）
  const renderStatus = (status: AgentDevice['status']) => {
    switch (status) {
      case 'online':
        return <Tag color="success">在线</Tag>;
      case 'busy':
        return <Tag color="processing">忙碌</Tag>;
      case 'offline':
        return <Tag color="default">离线</Tag>;
    }
  };

  // 在线设备
  const onlineDevices = devices.filter((d) => d.status !== 'offline');
  const hasOnlineDevice = onlineDevices.length > 0;

  return (
    <>
      <Modal
        title="选择工作路径"
        open={open && !showInstallGuide}
        onCancel={onClose}
        width={560}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleSelect} disabled={mode === 'local' && !workDir}>
              确定
            </Button>
          </div>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Radio value="local" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <DesktopOutlined style={{ fontSize: 18, marginRight: 8 }} />
                  <div>
                    <Text strong>本地电脑</Text>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      AI 可以读写您电脑上的文件、执行命令
                    </Text>
                  </div>
                </div>
              </Radio>
              <Radio value="server" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CloudOutlined style={{ fontSize: 18, marginRight: 8 }} />
                  <div>
                    <Text strong>云端服务器</Text>
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      AI 在服务器上工作，适合 RPA、定时任务等
                    </Text>
                  </div>
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        {mode === 'local' && (
          <div style={{ background: 'var(--glass-bg-light)', padding: 16, borderRadius: 8, border: '1px solid var(--border-light)' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin tip="正在检测 Client Agent..." />
              </div>
            ) : !hasOnlineDevice ? (
              <div>
                <Alert
                  type="warning"
                  showIcon
                  message="未检测到 Client Agent"
                  description="请先安装并启动 Client Agent，AI 才能在您的本地电脑上工作。"
                  style={{ marginBottom: 16 }}
                />
                <div style={{ textAlign: 'center' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowInstallGuide(true)}>
                    安装 Client Agent
                  </Button>
                  <Button style={{ marginLeft: 8 }} onClick={fetchAgents}>
                    刷新检测
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Paragraph style={{ margin: 0, color: 'var(--text-secondary)' }}>
                    <CheckCircleOutlined style={{ color: 'var(--accent-success)', marginRight: 8 }} />
                    检测到 {onlineDevices.length} 个在线设备
                  </Paragraph>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setShowInstallGuide(true)}>
                    添加新设备
                  </Button>
                </div>

                <List
                  size="small"
                  bordered
                  dataSource={devices}
                  style={{ marginBottom: 16, background: 'var(--glass-bg-subtle)', borderColor: 'var(--border-light)' }}
                  renderItem={(device) => (
                    <List.Item
                      style={{
                        cursor: device.status !== 'offline' ? 'pointer' : 'not-allowed',
                        background: selectedDeviceId === device.deviceId ? 'var(--glass-bg-medium)' : 'transparent',
                        opacity: device.status === 'offline' ? 0.5 : 1,
                        padding: '8px 12px',
                        borderColor: 'var(--border-light)',
                      }}
                      onClick={() => {
                        if (device.status !== 'offline') {
                          setSelectedDeviceId(device.deviceId);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
                        <DesktopOutlined style={{ fontSize: 18, color: 'var(--text-tertiary)', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                          {device.deviceName}
                        </span>
                        {renderStatus(device.status)}
                        <Popconfirm
                          title="解绑设备"
                          description="确定要解绑此设备吗？解绑后需要重新配对。"
                          onConfirm={(e) => {
                            e?.stopPropagation();
                            handleUnbind(device.deviceId);
                          }}
                          onCancel={(e) => e?.stopPropagation()}
                          okText="解绑"
                          cancelText="取消"
                        >
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                            style={{ flexShrink: 0 }}
                          />
                        </Popconfirm>
                      </div>
                    </List.Item>
                  )}
                />

                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ color: 'var(--text-secondary)' }}>
                    <FolderOutlined style={{ marginRight: 8 }} />
                    工作目录
                  </Text>
                </div>
                <Input
                  placeholder="例如：D:\projects\my-app 或 /home/user/projects"
                  value={workDir}
                  onChange={(e) => setWorkDir(e.target.value)}
                  prefix={<FolderOutlined />}
                />
                <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  请输入您电脑上的工作目录路径，AI 将在此目录下进行文件操作
                </Paragraph>
              </>
            )}
          </div>
        )}

        {mode === 'server' && (
          <div style={{ background: 'var(--glass-bg-light)', padding: 16, borderRadius: 8, border: '1px solid var(--border-light)' }}>
            <Alert
              type="info"
              showIcon
              message="云端模式"
              description="在此模式下，AI 将在服务器上执行操作，适合 RPA 自动化、定时任务等不需要访问本地文件的场景。"
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 8 }}>
              <Text strong style={{ color: 'var(--text-secondary)' }}>
                <FolderOutlined style={{ marginRight: 8 }} />
                服务器工作目录（可选）
              </Text>
            </div>
            <Input
              placeholder="留空使用默认目录"
              value={workDir}
              onChange={(e) => setWorkDir(e.target.value)}
              prefix={<FolderOutlined />}
            />
          </div>
        )}
      </Modal>

      <AgentInstallGuide
        open={showInstallGuide}
        onClose={() => setShowInstallGuide(false)}
        onPairingSuccess={handlePairingSuccess}
      />
    </>
  );
}
