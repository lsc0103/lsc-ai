/**
 * Client Agent 安装引导对话框
 */
import { useState, useEffect } from 'react';
import { Modal, Steps, Input, Button, Typography, Space, Alert, Spin, Divider } from 'antd';
import {
  DownloadOutlined,
  WindowsOutlined,
  AppleOutlined,
  LinuxOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { agentApi } from '../../services/api';
import { useAgentStore } from '../../stores/agent';

const { Text, Title, Paragraph } = Typography;

interface AgentInstallGuideProps {
  open: boolean;
  onClose: () => void;
  onPairingSuccess: () => void;
}

// 检测操作系统
function detectOS(): 'windows' | 'macos' | 'linux' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  return 'linux';
}

export default function AgentInstallGuide({ open, onClose, onPairingSuccess }: AgentInstallGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [pairingCode, setPairingCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState(false);

  const { setPairingCode: storePairingCode } = useAgentStore();
  const detectedOS = detectOS();

  // 生成配对码
  const generateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await agentApi.generatePairingCode();
      const code = response.data.code;
      setPairingCode(code);
      storePairingCode(code);
    } catch (err: any) {
      setError(err.response?.data?.message || '生成配对码失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开对话框时生成配对码（浏览器生成，给 Agent 输入用的）
  useEffect(() => {
    if (open && currentStep === 2 && !pairingCode) {
      generateCode();
    }
  }, [open, currentStep]);

  // 注意：不再自动轮询检查在线设备
  // 配对流程改为：Agent 显示配对码 → 用户在浏览器输入 → 点击"确认绑定"

  // 复制配对码
  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode);
  };

  // 确认配对（用户在浏览器输入 Agent 显示的配对码）
  const confirmPairing = async () => {
    if (inputCode.length !== 6) return;

    setLoading(true);
    setError(null);
    try {
      const response = await agentApi.confirmPairing(inputCode);
      if (response.data.success) {
        setPairingSuccess(true);
        setTimeout(() => {
          onPairingSuccess();
          onClose();
        }, 1500);
      } else {
        setError(response.data.error || '配对失败');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '配对请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 下载按钮配置
  const downloadOptions = {
    windows: {
      icon: <WindowsOutlined />,
      label: 'Windows 版本',
      filename: 'lsc-ai-client-1.0.0-win.exe',
      url: '/downloads/lsc-ai-client-win.exe',
    },
    macos: {
      icon: <AppleOutlined />,
      label: 'macOS 版本',
      filename: 'lsc-ai-client-1.0.0-mac.dmg',
      url: '/downloads/lsc-ai-client-mac.dmg',
    },
    linux: {
      icon: <LinuxOutlined />,
      label: 'Linux 版本',
      filename: 'lsc-ai-client-1.0.0-linux.deb',
      url: '/downloads/lsc-ai-client-linux.deb',
    },
  };

  const currentDownload = downloadOptions[detectedOS];

  const steps = [
    {
      title: '了解功能',
      content: (
        <div>
          <Alert
            type="info"
            showIcon
            message="为什么需要安装 Client Agent？"
            description="由于浏览器安全限制，AI 无法直接访问您电脑上的文件。安装 Client Agent 后，AI 就能在您的本地电脑上进行文件操作。"
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 16, background: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
              <Title level={5} style={{ color: '#52c41a', marginBottom: 8 }}>
                安装后可以做什么
              </Title>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                <li>本地代码开发（读写文件、执行命令）</li>
                <li>本地项目分析（读取代码、搜索）</li>
                <li>本地 Git 操作</li>
                <li>本地 Office 文档生成并保存</li>
                <li>启动/管理本地开发服务器</li>
              </ul>
            </div>
            <div style={{ padding: 16, background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
              <Title level={5} style={{ color: '#faad14', marginBottom: 8 }}>
                不安装也能使用的功能
              </Title>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                <li>RPA 浏览器自动化（服务器执行）</li>
                <li>定时任务调度（服务器执行）</li>
                <li>跨服务器监管（Sentinel Agent）</li>
                <li>查询业务系统数据（API 调用）</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '下载安装',
      content: (
        <div>
          <Paragraph>
            检测到您的操作系统：
            <Text strong style={{ marginLeft: 8 }}>
              {detectedOS === 'windows' ? 'Windows' : detectedOS === 'macos' ? 'macOS' : 'Linux'}
            </Text>
          </Paragraph>

          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              href={currentDownload.url}
              download={currentDownload.filename}
              style={{ height: 48, fontSize: 16, padding: '0 32px' }}
            >
              {currentDownload.icon}
              <span style={{ marginLeft: 8 }}>下载 {currentDownload.label}</span>
            </Button>
          </div>

          <Divider />

          <Paragraph type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
            其他版本：
            {detectedOS !== 'windows' && (
              <a href={downloadOptions.windows.url} style={{ marginLeft: 8 }}>
                Windows (.exe)
              </a>
            )}
            {detectedOS !== 'macos' && (
              <a href={downloadOptions.macos.url} style={{ marginLeft: 8 }}>
                macOS (.dmg)
              </a>
            )}
            {detectedOS !== 'linux' && (
              <a href={downloadOptions.linux.url} style={{ marginLeft: 8 }}>
                Linux (.deb)
              </a>
            )}
          </Paragraph>

          <Alert
            type="warning"
            showIcon
            message="安装步骤"
            description={
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li>下载上方安装包</li>
                <li>双击运行安装程序，按提示完成安装</li>
                <li>安装完成后会自动启动（开机自启）</li>
                <li>继续下一步完成配对</li>
              </ol>
            }
            style={{ marginTop: 16 }}
          />
        </div>
      ),
    },
    {
      title: '完成配对',
      content: (
        <div>
          {pairingSuccess ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
              <Title level={4} style={{ marginTop: 16, color: '#52c41a' }}>
                配对成功！
              </Title>
              <Paragraph>正在跳转...</Paragraph>
            </div>
          ) : (
            <>
              <Paragraph>
                请在 Client Agent 启动后的窗口中查看配对码，或在下方输入配对码完成绑定。
              </Paragraph>

              {error && (
                <Alert type="error" message={error} style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />
              )}

              <div
                style={{
                  background: '#f5f5f5',
                  padding: 24,
                  borderRadius: 8,
                  textAlign: 'center',
                  marginBottom: 16,
                }}
              >
                <Text type="secondary">您的配对码</Text>
                <div style={{ marginTop: 8 }}>
                  {loading ? (
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                  ) : (
                    <Space>
                      <Text
                        style={{
                          fontSize: 32,
                          fontWeight: 'bold',
                          letterSpacing: 8,
                          fontFamily: 'monospace',
                        }}
                      >
                        {pairingCode || '------'}
                      </Text>
                      <Button icon={<CopyOutlined />} onClick={copyCode} disabled={!pairingCode}>
                        复制
                      </Button>
                    </Space>
                  )}
                </div>
                <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
                  配对码有效期 5 分钟
                </Paragraph>
              </div>

              <Divider>输入 Agent 显示的配对码</Divider>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Input
                  placeholder="请输入 6 位配对码"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                  style={{ width: 200, textAlign: 'center', letterSpacing: 4, fontSize: 16 }}
                  maxLength={6}
                  onPressEnter={confirmPairing}
                />
                <Button
                  type="primary"
                  disabled={inputCode.length !== 6 || loading}
                  loading={loading}
                  onClick={confirmPairing}
                >
                  确认绑定
                </Button>
              </div>

              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Text type="secondary">
                  请在 Client Agent 窗口查看配对码，然后在上方输入
                </Text>
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal
      title="安装 LSC-AI Client Agent"
      open={open}
      onCancel={onClose}
      width={640}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={onClose}>取消</Button>
          <Space>
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>上一步</Button>
            )}
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
                下一步
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <Steps current={currentStep} items={steps.map((s) => ({ title: s.title }))} style={{ marginBottom: 24 }} />
      <div style={{ minHeight: 300 }}>{steps[currentStep].content}</div>
    </Modal>
  );
}
