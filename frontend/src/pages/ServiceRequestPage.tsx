import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  serviceRequestService,
  type CustomerServiceRequest,
} from '@/services/serviceRequestService';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const TYPE_LABEL: Record<string, { color: string; label: string }> = {
  REFUND: { color: 'orange', label: '退款' },
  COMPLAINT: { color: 'red', label: '投诉' },
};

const STATUS_LABEL: Record<string, { color: string; label: string }> = {
  OPEN: { color: 'processing', label: '待处理' },
  IN_PROGRESS: { color: 'blue', label: '处理中' },
  RESOLVED: { color: 'success', label: '已解决' },
  REJECTED: { color: 'default', label: '未通过' },
  CANCELLED: { color: 'default', label: '已取消' },
};

const CATEGORY_LABEL: Record<string, string> = {
  QUALITY: '质量问题',
  SERVICE: '服务问题',
  DELAY: '进度延误',
  SHIPPING: '物流问题',
  OTHER: '其他',
  CHANGE_OF_MIND: '计划有变',
  DESIGN_UNSATISFIED: '设计不满意',
  PRICE: '价格相关',
};

const fmtTime = (v?: string | null) => (v ? v.replace('T', ' ').slice(0, 19) : '-');
const fmtMoney = (v?: number | null) =>
  v === null || v === undefined ? '-' : `$${Number(v).toFixed(2)}`;

const ServiceRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CustomerServiceRequest[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [current, setCurrent] = useState<CustomerServiceRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await serviceRequestService.listOpen();
      setRows(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e || '加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!typeFilter) return rows;
    return rows.filter((r) => r.type === typeFilter);
  }, [rows, typeFilter]);

  const openResolve = (row: CustomerServiceRequest) => {
    if (row.type === 'REFUND' && !isAdmin) {
      message.warning('仅管理员可以处理退款申请');
      return;
    }
    setCurrent(row);
    form.setFieldsValue({
      status: 'RESOLVED',
      staffNote: '',
    });
    setModalOpen(true);
  };

  const submitResolve = async () => {
    if (!current) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await serviceRequestService.resolve(current.id, {
        status: values.status,
        staffNote: values.staffNote || undefined,
      });
      message.success('已更新申请状态');
      setModalOpen(false);
      setCurrent(null);
      await load();
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown })?.errorFields) return;
      message.error(String((e as Error)?.message || e || '处理失败'));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<CustomerServiceRequest> = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      render: (t: string) => {
        const meta = TYPE_LABEL[t] || { color: 'default', label: t };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '订单号',
      dataIndex: 'orderNumber',
      width: 160,
      render: (v: string, row) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/orders/${row.orderId}`)}>
          {v || `#${row.orderId}`}
        </Button>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (c?: string) => CATEGORY_LABEL[c || ''] || c || '-',
    },
    {
      title: '金额',
      dataIndex: 'requestedAmount',
      width: 110,
      render: (v?: number) => fmtMoney(v),
    },
    {
      title: '说明',
      dataIndex: 'reason',
      ellipsis: true,
      render: (v: string) => (
        <Paragraph ellipsis={{ rows: 2, tooltip: v }} style={{ marginBottom: 0 }}>
          {v}
        </Paragraph>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => {
        const meta = STATUS_LABEL[s] || { color: 'default', label: s };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      width: 170,
      render: fmtTime,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, row) => {
        const canHandle = row.type !== 'REFUND' || isAdmin;
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => navigate(`/orders/${row.orderId}`)}>
              订单
            </Button>
            <Button
              type="link"
              size="small"
              disabled={!canHandle}
              onClick={() => openResolve(row)}
            >
              处理
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              售后申请
            </Title>
            <Text type="secondary">客户投诉与退款申请。退款仅管理员可处理。</Text>
          </div>
          <Space wrap>
            <Select
              allowClear
              placeholder="类型筛选"
              style={{ width: 140 }}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v)}
              options={[
                { value: 'REFUND', label: '退款' },
                { value: 'COMPLAINT', label: '投诉' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              刷新
            </Button>
          </Space>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          scroll={{ x: 980 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={current?.type === 'REFUND' ? '处理退款申请' : '处理投诉'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setCurrent(null);
        }}
        onOk={() => void submitResolve()}
        confirmLoading={saving}
        okText="提交"
        destroyOnClose
      >
        {current && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">订单 {current.orderNumber || current.orderId}</Text>
            <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{current.reason}</Paragraph>
            {current.requestedAmount != null && (
              <Text>申请金额：{fmtMoney(current.requestedAmount)}</Text>
            )}
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="status"
            label="处理结果"
            rules={[{ required: true, message: '请选择处理结果' }]}
          >
            <Select
              options={[
                { value: 'IN_PROGRESS', label: '标记处理中' },
                { value: 'RESOLVED', label: '已解决 / 同意退款' },
                { value: 'REJECTED', label: '未通过 / 拒绝' },
              ]}
            />
          </Form.Item>
          <Form.Item name="staffNote" label="处理备注（将同步到订单聊天）">
            <TextArea rows={3} maxLength={1000} placeholder="可选，客户可见于订单事件" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ServiceRequestPage;
