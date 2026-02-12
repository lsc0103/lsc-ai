import { useState, useRef, useEffect, useCallback, KeyboardEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dropdown, Tooltip, message, Spin, Select } from 'antd';
import {
  PlusOutlined,
  SendOutlined,
  AudioOutlined,
  PaperClipOutlined,
  FolderOpenOutlined,
  StopOutlined,
  FileOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  AppstoreOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useChatStore } from '../../stores/chat';
import { useAgentStore } from '../../stores/agent';
import { sessionApi, uploadApi, agentApi, FileInfo } from '../../services/api';
import { sendChatMessage, connectSocket, stopGeneration } from '../../services/socket';
import { WorkspaceSelectModal, AgentStatusIndicator } from '../agent';
import { useWorkbenchStore, useWorkbenchVisible } from '../workbench';
import { knowledgeApi, type KnowledgeBase } from '../../services/knowledge-api';

/**
 * 聊天输入框组件
 *
 * 玻璃拟态设计：
 * - 半透明玻璃背景
 * - 边缘高光效果
 * - 聚焦时发光边框
 */
// 文件类型图标映射
const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return <FileImageOutlined className="text-[var(--accent-info)]" />;
  }
  if (mimeType === 'application/pdf') {
    return <FilePdfOutlined className="text-[var(--accent-error)]" />;
  }
  return <FileOutlined className="text-[var(--text-tertiary)]" />;
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ChatInput() {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const {
    isLoading,
    isNewChat,
    currentSessionId,
    pendingMessage,
    setLoading,
    addSession,
    setCurrentSession,
    addMessage,
    setPendingMessage,
  } = useChatStore();

  const { currentDeviceId, workDir, isConnected: agentConnected, setDevices, setConnected } = useAgentStore();

  // Workbench 状态
  const workbenchVisible = useWorkbenchVisible();
  const { toggle: toggleWorkbench, openBlank: openBlankWorkbench } = useWorkbenchStore();

  // 页面加载时检查 Agent 连接状态
  useEffect(() => {
    if (currentDeviceId) {
      agentApi.list().then((response) => {
        setDevices(response.data);
        const currentDevice = response.data.find((d) => d.deviceId === currentDeviceId);
        setConnected(currentDevice?.status === 'online');
      }).catch((err) => {
        console.error('检查 Agent 状态失败:', err);
        setConnected(false);
      });
    }
  }, [currentDeviceId, setDevices, setConnected]);

  // 加载知识库列表
  useEffect(() => {
    knowledgeApi.list().then((res) => {
      const list = res.data?.items ?? [];
      setKnowledgeBases(Array.isArray(list) ? list : []);
    }).catch(() => {
      // 静默失败，知识库功能为可选
    });
  }, []);

  // P2-18: Agent 连接成功后自动打开 FileBrowser（仅当 Workbench 为空时）
  useEffect(() => {
    if (agentConnected && currentDeviceId && workDir) {
      const workbenchState = useWorkbenchStore.getState();
      if (!workbenchState.schema) {
        workbenchState.openBlank(workDir);
      }
    }
  }, [agentConnected, currentDeviceId, workDir]);

  // 自动调整高度
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  // 生成会话标题
  const generateTitle = (msg: string): string => {
    const title = msg.trim().slice(0, 30);
    return title.length < msg.trim().length ? `${title}...` : title;
  };

  // 初始化 Socket 连接
  useEffect(() => {
    connectSocket().catch((err) => {
      console.error('Socket 连接失败:', err);
    });
  }, []);

  // 核心发送消息逻辑
  const sendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    try {
      let sessionId: string;
      let isCreatingNew = false;

      if (isNewChat || !currentSessionId) {
        isCreatingNew = true;
        const title = generateTitle(messageContent);
        const response = await sessionApi.create({ title });
        const newSession = response.data;
        sessionId = newSession.id;
        addSession(newSession);
        setCurrentSession(newSession.id);
      } else {
        sessionId = currentSessionId;
      }

      // 先添加用户消息到store（确保messages不为空），再导航
      // 这样Chat.tsx的useEffect检测到URL变化时，loadSession的guard
      // (messages.length > 0) 能正确阻止重复加载
      const userMessage = {
        id: `temp-user-${Date.now()}`,
        role: 'user' as const,
        content: messageContent,
        attachments: uploadedFiles.length > 0 ? uploadedFiles.map(f => ({
          id: f.id,
          filename: f.filename,
          originalName: f.originalName,
          mimeType: f.mimeType,
          size: f.size,
          url: f.url,
        })) : undefined,
        createdAt: new Date().toISOString(),
      };
      addMessage(userMessage);

      // 新会话创建后才需要导航
      if (isCreatingNew) {
        navigate(`/chat/${sessionId}`);
      }

      const fileIds = uploadedFiles.map(f => f.id);
      setUploadedFiles([]);

      // 从 Zustand store 直接读取最新 Agent 状态，避免 useCallback 闭包捕获旧值
      const agentState = useAgentStore.getState();
      const latestDeviceId = agentState.currentDeviceId;
      const latestWorkDir = agentState.workDir;

      await sendChatMessage(
        sessionId,
        messageContent,
        {
          onStart: () => {
            console.log('[Chat] 开始接收流式响应');
          },
          onChunk: (chunk) => {
            console.log('[Chat] 收到内容块:', chunk.slice(0, 50));
          },
          onToolCall: (toolCall) => {
            console.log('[Chat] 工具调用:', toolCall.name, toolCall.arguments);
          },
          onToolResult: (result) => {
            console.log('[Chat] 工具结果:', result.name, result.success ? '成功' : '失败');
          },
          onDone: (fullContent, toolCallsCount) => {
            console.log('[Chat] 流式响应完成，总长度:', fullContent.length, '工具调用:', toolCallsCount);
          },
          onError: (error) => {
            console.error('[Chat] 发送消息失败:', error);
            message.error(error || '发送消息失败');
          },
        },
        {
          fileIds: fileIds.length > 0 ? fileIds : undefined,
          deviceId: latestDeviceId || undefined,
          workDir: latestWorkDir || undefined,
          knowledgeBaseId: selectedKbId || undefined,
        }
      );
    } catch (error: any) {
      console.error('发送消息失败:', error);
      message.error(error.response?.data?.message || '发送消息失败');
      setLoading(false);
    }
  }, [isLoading, isNewChat, currentSessionId, addSession, setCurrentSession, addMessage, navigate, setLoading, uploadedFiles, selectedKbId]);

  // 监听待发送消息
  useEffect(() => {
    if (pendingMessage && !isLoading) {
      setPendingMessage(null);
      sendMessage(pendingMessage);
    }
  }, [pendingMessage, isLoading, setPendingMessage, sendMessage]);

  // 发送消息
  const handleSend = async () => {
    if (!value.trim() || isLoading) return;

    const messageContent = value.trim();
    setValue('');

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await sendMessage(messageContent);
  };

  // 键盘事件
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 文件上传处理
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const response = await uploadApi.upload(file, currentSessionId || undefined);
        const uploadedFile = response.data.data;
        setUploadedFiles((prev) => [...prev, uploadedFile]);
        message.success(`${file.name} 上传成功`);
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      message.error('文件上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 移除已上传的文件
  const handleRemoveFile = async (fileId: string) => {
    try {
      await uploadApi.delete(fileId);
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除文件失败');
    }
  };

  // 加号菜单
  const plusMenuItems = [
    {
      key: 'file',
      icon: <PaperClipOutlined />,
      label: '添加图片和文件',
    },
    {
      key: 'workdir',
      icon: <FolderOpenOutlined />,
      label: '选择工作路径',
    },
    {
      key: 'workbench',
      icon: <AppstoreOutlined />,
      label: workbenchVisible ? '关闭工作台' : '打开工作台',
    },
  ];

  const handlePlusMenuClick = ({ key }: { key: string }) => {
    if (key === 'file') {
      fileInputRef.current?.click();
    } else if (key === 'workdir') {
      setShowWorkspaceModal(true);
    } else if (key === 'workbench') {
      if (workbenchVisible) {
        // 如果已打开，则切换关闭
        toggleWorkbench();
      } else {
        // 打开空白 Workbench，如果有工作目录则显示文件浏览器
        openBlankWorkbench(workDir || undefined);
      }
    }
  };

  // 工作路径选择处理
  const handleWorkspaceSelect = (mode: 'local' | 'server', selectedWorkDir: string, deviceId?: string) => {
    console.log('Workspace selected:', { mode, selectedWorkDir, deviceId });
    message.success(`已选择工作路径: ${selectedWorkDir}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      {/* 工作路径选择模态框 */}
      <WorkspaceSelectModal
        open={showWorkspaceModal}
        onClose={() => setShowWorkspaceModal(false)}
        onSelect={handleWorkspaceSelect}
      />

      {/* Agent 状态指示器 - 带动画过渡 */}
      <AnimatePresence>
        {(currentDeviceId || workDir) && (
          <motion.div
            className="mb-3"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <AgentStatusIndicator
              onChangeWorkspace={() => setShowWorkspaceModal(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 知识库引用选择 */}
      {knowledgeBases.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <BookOutlined className="text-[var(--text-tertiary)]" />
          <Select
            allowClear
            placeholder="引用知识库（可选）"
            value={selectedKbId}
            onChange={(val) => setSelectedKbId(val)}
            options={knowledgeBases.map((kb) => ({
              label: kb.name,
              value: kb.id,
            }))}
            style={{ width: 220 }}
            size="small"
            className="knowledge-select"
          />
          {selectedKbId && (
            <span className="text-xs text-[var(--text-tertiary)]">
              对话将检索此知识库
            </span>
          )}
        </div>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.json,.xml,.html,.css,.js,.ts,.jsx,.tsx,.zip,.rar"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 已上传文件列表 */}
      {(uploadedFiles.length > 0 || uploading) && (
        <div className="mb-2 p-3 glass-basic rounded-xl">
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-2">
              <Spin indicator={<LoadingOutlined spin />} size="small" />
              <span>正在上传...</span>
            </div>
          )}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                    'bg-[var(--glass-bg-light)] border border-[var(--border-light)]',
                    'text-sm text-[var(--text-secondary)]',
                  )}
                >
                  {getFileIcon(file.mimeType)}
                  <span className="max-w-[120px] truncate">{file.originalName}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">({formatFileSize(file.size)})</span>
                  <button
                    onClick={() => handleRemoveFile(file.id)}
                    className="ml-1 text-[var(--text-tertiary)] hover:text-[var(--accent-error)] transition-colors"
                  >
                    <CloseCircleOutlined />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <motion.div
        className={clsx(
          'relative flex items-center gap-2 p-2 rounded-2xl overflow-hidden',
          'bg-[var(--glass-bg-medium)]',
          'backdrop-blur-[var(--glass-blur-md)]',
          'border transition-all duration-200',
          isFocused
            ? 'border-[var(--accent-primary)] shadow-[var(--glass-glow-focus)]'
            : 'border-[var(--border-default)]',
        )}
        style={{
          // 顶部边缘高光
          boxShadow: isFocused
            ? 'var(--glass-glow-focus), inset 0 1px 0 rgba(200, 225, 255, 0.3)'
            : 'inset 0 1px 0 rgba(200, 225, 255, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1)',
        }}
        layout
      >
        {/* 加号按钮 */}
        <Dropdown
          menu={{ items: plusMenuItems, onClick: handlePlusMenuClick }}
          trigger={['click']}
          placement="topLeft"
        >
          <Button
            type="text"
            icon={<PlusOutlined />}
            className={clsx(
              'flex-shrink-0 w-9 h-9 rounded-xl',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              'hover:bg-[var(--glass-bg-light)]',
            )}
          />
        </Dropdown>

        {/* 输入框 */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="输入消息，Shift+Enter 换行..."
            rows={1}
            className={clsx(
              'w-full resize-none bg-transparent border-none outline-none',
              'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)]',
              'py-2 px-1',
            )}
            style={{ maxHeight: '200px' }}
          />
        </div>

        {/* 右侧按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* 语音输入 */}
          <Tooltip title="语音输入（开发中）">
            <Button
              type="text"
              icon={<AudioOutlined />}
              className={clsx(
                'w-9 h-9 rounded-xl',
                'text-[var(--text-tertiary)]',
                'hover:bg-[var(--glass-bg-light)]',
              )}
              disabled
            />
          </Tooltip>

          {/* 发送/停止按钮 */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="stop"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Tooltip title="停止生成">
                  <Button
                    type="primary"
                    danger
                    icon={<StopOutlined />}
                    onClick={() => stopGeneration()}
                    className="w-9 h-9 rounded-xl"
                  />
                </Tooltip>
              </motion.div>
            ) : (
              <motion.div
                key={value.trim() ? 'send' : 'empty'}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  disabled={!value.trim()}
                  className={clsx(
                    'w-9 h-9 rounded-xl',
                    !value.trim() && 'opacity-50',
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* 底部提示 */}
      <p className="text-center text-xs text-[var(--text-tertiary)] mt-2">
        LSC-AI 可能会出错，请核实重要信息
      </p>
    </div>
  );
}
