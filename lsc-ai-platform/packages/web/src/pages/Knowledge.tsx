import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Card,
  Row,
  Col,
  Empty,
  Modal,
  Form,
  Input,
  Spin,
  Popconfirm,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { knowledgeApi, type KnowledgeBase } from '../services/knowledge-api';

export default function KnowledgePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [searchText, setSearchText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadKnowledgeBases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await knowledgeApi.list({ search: searchText || undefined });
      const list = res.data?.data || res.data || [];
      setKnowledgeBases(Array.isArray(list) ? list : []);
    } catch {
      message.error('加载知识库列表失败');
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => {
    loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  const handleCreate = () => {
    setEditingKb(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (kb: KnowledgeBase, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingKb(kb);
    form.setFieldsValue({ name: kb.name, description: kb.description });
    setModalOpen(true);
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await knowledgeApi.delete(id);
      message.success('删除成功');
      loadKnowledgeBases();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingKb) {
        await knowledgeApi.update(editingKb.id, values);
        message.success('更新成功');
      } else {
        await knowledgeApi.create(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadKnowledgeBases();
    } catch {
      // form validation error or API error
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const filteredList = knowledgeBases.filter(
    (kb) =>
      !searchText ||
      kb.name.toLowerCase().includes(searchText.toLowerCase()) ||
      kb.description?.toLowerCase().includes(searchText.toLowerCase()),
  );

  return (
    <div className="h-full overflow-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-accent-800">知识库管理</h1>
            <p className="text-sm text-accent-500 mt-1">
              管理文档知识库，支持智能检索和 RAG 增强对话
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建知识库
          </Button>
        </div>

        {/* 搜索 */}
        <div className="mb-4">
          <Input.Search
            placeholder="搜索知识库..."
            allowClear
            onSearch={(val) => setSearchText(val)}
            onChange={(e) => {
              if (!e.target.value) setSearchText('');
            }}
            style={{ maxWidth: 360 }}
          />
        </div>

        {/* 知识库列表 */}
        <Spin spinning={loading}>
          {filteredList.length === 0 ? (
            <Card className="shadow-sm">
              <Empty
                description={searchText ? '没有匹配的知识库' : '暂无知识库'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                {!searchText && (
                  <Button type="primary" onClick={handleCreate}>
                    创建第一个知识库
                  </Button>
                )}
              </Empty>
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {filteredList.map((kb) => (
                <Col key={kb.id} xs={24} sm={12} md={8}>
                  <Card
                    hoverable
                    className="shadow-sm h-full"
                    onClick={() => navigate(`/knowledge/${kb.id}`)}
                    actions={[
                      <EditOutlined
                        key="edit"
                        onClick={(e) => handleEdit(kb, e)}
                      />,
                      <Popconfirm
                        key="delete"
                        title="确认删除"
                        description="删除后所有文档和向量数据将被清除，无法恢复。"
                        onConfirm={(e) => handleDelete(kb.id, e as unknown as React.MouseEvent)}
                        onCancel={(e) => e?.stopPropagation()}
                        okText="确认"
                        cancelText="取消"
                      >
                        <DeleteOutlined onClick={(e) => e.stopPropagation()} />
                      </Popconfirm>,
                    ]}
                  >
                    <Card.Meta
                      title={kb.name}
                      description={kb.description || '暂无描述'}
                    />
                    <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <FileTextOutlined /> {kb.documentCount ?? 0} 篇文档
                      </span>
                      <span className="flex items-center gap-1">
                        <DatabaseOutlined /> {kb.chunkCount ?? 0} 个分块
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      创建于 {formatDate(kb.createdAt)}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Spin>
      </motion.div>

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingKb ? '编辑知识库' : '新建知识库'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        okText={editingKb ? '保存' : '创建'}
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="知识库名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="例如：产品技术文档" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea
              rows={3}
              placeholder="简要描述知识库的用途和内容范围"
            />
          </Form.Item>
          <Form.Item name="projectId" label="关联项目（可选）">
            <Input placeholder="输入项目 ID" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
