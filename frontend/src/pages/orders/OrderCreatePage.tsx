import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { orderService } from '@/services/orderService';
import { OrderSource } from '@/types/order';
import { orderSourceLabel } from '@/utils/orderLabels';

const { Title } = Typography;

const OrderCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      orderTime: dayjs(),
      depositAmount: 0,
      source: OrderSource.DOUYIN,
    });
  }, [form]);

  const source = Form.useWatch('source', form);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const payload = {
        source: values.source,
        sourceDetail: values.sourceDetail,
        depositAmount: Number(values.depositAmount),
        basicRequirements: values.basicRequirements,
        orderTime: (values.orderTime || dayjs()).format('YYYY-MM-DD HH:mm:ss'),
        style: values.style,
        materialInfo: values.materialInfo,
        customerContact: values.customerContact,
        customerName: values.customerName,
        customerWechat: values.customerWechat,
      };
      const created = await orderService.createOrder(payload);
      message.success('创建成功');
      navigate(`/orders/${created.baseInfo.id}`);
    } catch (e) {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card bordered={false}>
      <div
        style={{
          maxHeight: 'calc(100vh - 220px)',
          overflowY: 'auto',
          paddingRight: 8,
        }}
      >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
            返回列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            新建订单
          </Title>
        </Space>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{ maxWidth: 720 }}
        >
          <Form.Item name="customerName" label="客户姓名">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item
            name="customerContact"
            label="联系方式"
            rules={[{ required: true, message: '请输入手机或微信' }]}
          >
            <Input placeholder="手机或微信号" />
          </Form.Item>
          <Form.Item name="customerWechat" label="客户微信（若与联系方式不同）">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="source" label="订单来源" rules={[{ required: true }]}>
            <Select
              options={Object.values(OrderSource).map((s) => ({
                value: s,
                label: orderSourceLabel(s),
              }))}
            />
          </Form.Item>
          {source === OrderSource.RECOMMEND && (
            <Form.Item name="sourceDetail" label="达人昵称">
              <Input placeholder="达人推荐时填写" />
            </Form.Item>
          )}
          <Form.Item
            name="depositAmount"
            label="定金（元）"
            rules={[{ required: true, message: '请输入定金' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="style" label="款式">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="materialInfo" label="材质信息">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
          <Form.Item
            name="basicRequirements"
            label="基础需求"
            rules={[{ required: true, message: '请填写基础需求' }]}
          >
            <Input.TextArea rows={4} placeholder="必填" />
          </Form.Item>
          <Form.Item
            name="orderTime"
            label="下单时间"
            rules={[{ required: true, message: '请选择下单时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              提交创建
            </Button>
          </Form.Item>
        </Form>
      </Space>
      </div>
    </Card>
  );
};

export default OrderCreatePage;
