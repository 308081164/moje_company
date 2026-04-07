import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Space,
  Table,
  Tabs,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SaveOutlined, ReloadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { orderService } from '@/services/orderService';
import type { ProcessInfo } from '@/types/order';
import { ProcessType } from '@/types/order';

const { Title, Text } = Typography;

type MaterialRow = { type: string; name: string; priceFormula: string; key: string };

const SystemConfigPage: React.FC = () => {
  const [priceForm] = Form.useForm();
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loadingMat, setLoadingMat] = useState(false);
  const [loadingProc, setLoadingProc] = useState(false);

  const loadPrice = useCallback(async () => {
    setLoadingPrice(true);
    try {
      const cfg = await orderService.getSystemConfig();
      priceForm.setFieldsValue({
        designBuyoutPrice: cfg.designBuyoutPrice,
        certificatePrice: cfg.certificatePrice,
        silverPriceFormula: cfg.silverPriceFormula,
        goldPriceFormula: cfg.goldPriceFormula,
      });
    } catch {
      message.error('加载价格配置失败');
    } finally {
      setLoadingPrice(false);
    }
  }, [priceForm]);

  const loadMaterials = async () => {
    setLoadingMat(true);
    try {
      const list = await orderService.getMaterialConfig();
      setMaterials(
        list.map((m, i) => ({
          type: m.type,
          name: m.name,
          priceFormula: m.priceFormula,
          key: `${m.type}-${i}`,
        }))
      );
    } catch {
      message.error('加载材质配置失败');
    } finally {
      setLoadingMat(false);
    }
  };

  const loadProcesses = async () => {
    setLoadingProc(true);
    try {
      const list = await orderService.getProcessConfig();
      setProcesses(list.length ? list : []);
    } catch {
      message.error('加载工艺配置失败');
    } finally {
      setLoadingProc(false);
    }
  };

  useEffect(() => {
    loadPrice();
    loadMaterials();
    loadProcesses();
  }, [loadPrice]);

  const savePrice = async () => {
    try {
      const v = await priceForm.validateFields();
      await orderService.updateSystemConfig(v);
      message.success('价格配置已保存');
      loadPrice();
    } catch {
      /* validated */
    }
  };

  const saveMaterials = async () => {
    setLoadingMat(true);
    try {
      await orderService.updateMaterialConfig(
        materials.map((m) => ({ type: m.type, name: m.name, priceFormula: m.priceFormula }))
      );
      message.success('材质配置已保存');
      await loadMaterials();
    } catch {
      message.error('保存材质失败');
    } finally {
      setLoadingMat(false);
    }
  };

  const saveProcesses = async () => {
    setLoadingProc(true);
    try {
      await orderService.updateProcessConfig(processes);
      message.success('工艺配置已保存');
      await loadProcesses();
    } catch {
      message.error('保存工艺失败');
    } finally {
      setLoadingProc(false);
    }
  };

  const materialColumns: ColumnsType<MaterialRow> = [
    {
      title: '材质代码',
      dataIndex: 'type',
      render: (_, r, index) => (
        <Input
          value={r.type}
          onChange={(e) => {
            const next = [...materials];
            next[index] = { ...next[index], type: e.target.value };
            setMaterials(next);
          }}
        />
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      render: (_, r, index) => (
        <Input
          value={r.name}
          onChange={(e) => {
            const next = [...materials];
            next[index] = { ...next[index], name: e.target.value };
            setMaterials(next);
          }}
        />
      ),
    },
    {
      title: '计价公式说明',
      dataIndex: 'priceFormula',
      render: (_, r, index) => (
        <Input
          value={r.priceFormula}
          onChange={(e) => {
            const next = [...materials];
            next[index] = { ...next[index], priceFormula: e.target.value };
            setMaterials(next);
          }}
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_, __, index) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => setMaterials(materials.filter((_, i) => i !== index))}
        >
          删除
        </Button>
      ),
    },
  ];

  const processColumns: ColumnsType<ProcessInfo> = [
    {
      title: '工艺名称',
      dataIndex: 'customProcess',
      render: (_, r, index) => (
        <Input
          value={r.customProcess}
          onChange={(e) => {
            const next = [...processes];
            next[index] = { ...next[index], customProcess: e.target.value };
            setProcesses(next);
          }}
        />
      ),
    },
    {
      title: '默认工费(元)',
      dataIndex: 'additionalCost',
      width: 140,
      render: (_, r, index) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={r.additionalCost}
          onChange={(val) => {
            const next = [...processes];
            next[index] = { ...next[index], additionalCost: Number(val) || 0 };
            setProcesses(next);
          }}
        />
      ),
    },
    {
      title: '说明',
      dataIndex: 'notes',
      render: (_, r, index) => (
        <Input
          value={r.notes}
          onChange={(e) => {
            const next = [...processes];
            next[index] = { ...next[index], notes: e.target.value };
            setProcesses(next);
          }}
        />
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_, __, index) => (
        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => setProcesses(processes.filter((_, i) => i !== index))}>
          删除
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>
        系统配置
      </Title>
      <Text type="secondary">
        与《功能设计文档》4.1 管理员配置、材质与工艺库一致：维护报价加价规则、可选材质及常见工艺默认工费。
      </Text>

      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'price',
            label: '价格与证书',
            children: (
              <Card bordered={false} loading={loadingPrice}>
                <Form form={priceForm} layout="vertical" style={{ maxWidth: 520 }}>
                  <Form.Item
                    name="designBuyoutPrice"
                    label="设计买断费用（元）"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    name="certificatePrice"
                    label="鉴定证书费用（元）"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item
                    name="silverPriceFormula"
                    label="银价加价（比例或说明，如 0.035 表示 3.5%）"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="goldPriceFormula"
                    label="金价加价（元/克或说明）"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item>
                    <Space>
                      <Button type="primary" icon={<SaveOutlined />} onClick={savePrice}>
                        保存
                      </Button>
                      <Button icon={<ReloadOutlined />} onClick={loadPrice}>
                        重新加载
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'material',
            label: '材质配置',
            children: (
              <Card bordered={false}>
                <Space style={{ marginBottom: 12 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() =>
                      setMaterials([
                        ...materials,
                        { type: '', name: '', priceFormula: '', key: `new-${Date.now()}` },
                      ])
                    }
                  >
                    新增材质
                  </Button>
                  <Button type="primary" icon={<SaveOutlined />} loading={loadingMat} onClick={saveMaterials}>
                    保存材质
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={loadMaterials}>
                    重新加载
                  </Button>
                </Space>
                <Table<MaterialRow>
                  rowKey="key"
                  loading={loadingMat}
                  columns={materialColumns}
                  dataSource={materials}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'process',
            label: '工艺配置',
            children: (
              <Card bordered={false}>
                <Space style={{ marginBottom: 12 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() =>
                      setProcesses([
                        ...processes,
                        {
                          processType: ProcessType.OTHER,
                          customProcess: '',
                          additionalCost: 0,
                          notes: '',
                        } as ProcessInfo,
                      ])
                    }
                  >
                    新增工艺
                  </Button>
                  <Button type="primary" icon={<SaveOutlined />} loading={loadingProc} onClick={saveProcesses}>
                    保存工艺
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={loadProcesses}>
                    重新加载
                  </Button>
                </Space>
                <Table<ProcessInfo>
                  rowKey={(_, i) => String(i)}
                  loading={loadingProc}
                  columns={processColumns}
                  dataSource={processes}
                  pagination={false}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default SystemConfigPage;
