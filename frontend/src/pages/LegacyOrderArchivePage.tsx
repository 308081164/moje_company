import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { legacyArchiveService, type LegacyOrderArchive, type LegacySegment } from '@/services/legacyArchiveService';

const { Text } = Typography;
const { TextArea } = Input;

const LegacyOrderArchivePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<LegacyOrderArchive[]>([]);
  const [kw, setKw] = useState('');
  const [seg, setSeg] = useState<LegacySegment | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LegacyOrderArchive | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await legacyArchiveService.page({ page, size, keyword: kw || undefined, segment: seg });
      setRows(res.content || []);
      setTotal(res.totalElements ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, size, kw, seg]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ segment: 'UNKNOWN' });
    setModalOpen(true);
  };

  const openEdit = (r: LegacyOrderArchive) => {
    setEditing(r);
    form.setFieldsValue({
      ...r,
      attachmentsJson: r.attachmentsJson || '',
    });
    setModalOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    if (editing) {
      await legacyArchiveService.update(editing.id, v);
      message.success('已更新');
    } else {
      await legacyArchiveService.create(v);
      message.success('已创建');
    }
    setModalOpen(false);
    void load();
  };

  const columns: ColumnsType<LegacyOrderArchive> = [
    { title: '归档号', dataIndex: 'archiveCode', width: 160 },
    { title: '端', dataIndex: 'segment', width: 80 },
    { title: '客户', dataIndex: 'customerName', ellipsis: true },
    { title: '电话', dataIndex: 'customerPhone', width: 120 },
    { title: '下单日', dataIndex: 'orderDate', width: 110 },
    {
      title: '操作',
      width: 100,
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => openEdit(r)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <Card title="历史订单归档录入" loading={loading}>
      <Text type="secondary">将线下 B 端 / C 端历史订单结构化录入系统，便于检索与后续对接。</Text>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input placeholder="关键词（归档号/客户/款式摘要）" value={kw} onChange={(e) => setKw(e.target.value)} style={{ width: 220 }} />
        <Select
          allowClear
          placeholder="端"
          style={{ width: 120 }}
          value={seg}
          onChange={(v) => setSeg(v)}
          options={[
            { value: 'B2B', label: 'B2B' },
            { value: 'C2C', label: 'C2C' },
            { value: 'UNKNOWN', label: '未知' },
          ]}
        />
        <Button type="primary" onClick={() => { setPage(0); void load(); }}>
          查询
        </Button>
        <Button onClick={() => openCreate()}>新建归档</Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={{
          current: page + 1,
          pageSize: size,
          total,
          onChange: (p) => setPage(p - 1),
        }}
      />

      <Modal
        title={editing ? '编辑归档' : '新建归档'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void submit()}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="segment" label="B端/C端" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'B2B', label: 'B2B' },
                { value: 'C2C', label: 'C2C' },
                { value: 'UNKNOWN', label: '未知' },
              ]}
            />
          </Form.Item>
          <Form.Item name="customerName" label="客户称呼/公司">
            <Input />
          </Form.Item>
          <Form.Item name="customerPhone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="customerWechat" label="微信">
            <Input />
          </Form.Item>
          <Form.Item name="orderDate" label="下单日期 yyyy-MM-dd">
            <Input placeholder="2020-01-15" />
          </Form.Item>
          <Form.Item name="completedDate" label="完成日期 yyyy-MM-dd">
            <Input />
          </Form.Item>
          <Form.Item name="styleSummary" label="款式摘要">
            <Input />
          </Form.Item>
          <Form.Item name="materialSummary" label="材质摘要">
            <Input />
          </Form.Item>
          <Form.Item name="requirements" label="需求说明">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="designNotes" label="设计相关">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="modelingNotes" label="建模相关">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="quotationNotes" label="报价/金额备注">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="attachmentsJson"
            label="附件 JSON（[{&quot;name&quot;:&quot;&quot;,&quot;url&quot;:&quot;&quot;}]）"
          >
            <TextArea rows={3} placeholder='例如 [{"name":"旧系统截图","url":"https://..."}]' />
          </Form.Item>
          <Form.Item name="internalRemark" label="内部备注">
            <TextArea rows={2} />
          </Form.Item>
          {editing && (
            <Text type="secondary">归档编号：{editing.archiveCode}（不可改）</Text>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default LegacyOrderArchivePage;
