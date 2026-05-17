import React, { useState } from 'react';
import { Form, Input, Modal, message } from 'antd';
import { inlayStructureService } from '@/services/inlayStructureService';

export interface SecondaryPasswordModalProps {
  open: boolean;
  title?: string;
  onCancel: () => void;
  onVerified: (password: string) => void | Promise<void>;
}

/** 二级密码弹窗（与取消订单、镶嵌结构超额删除校验规则一致） */
const SecondaryPasswordModal: React.FC<SecondaryPasswordModalProps> = ({
  open,
  title = '请输入二级密码',
  onCancel,
  onVerified,
}) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await inlayStructureService.verifySecondaryPassword(values.secondaryPassword);
      await onVerified(values.secondaryPassword);
      form.resetFields();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.message || e?.message || '二级密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="secondaryPassword"
          label="二级密码"
          rules={[{ required: true, message: '请输入二级密码' }]}
          extra="与系统管理员登录密码一致"
        >
          <Input.Password autoComplete="off" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SecondaryPasswordModal;
