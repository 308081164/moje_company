import React, { useState } from 'react';
import { Button, Input, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { JEWELRY_TYPE_OPTIONS, jewelryTypeLabel } from '@/constants/jewelryType';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { orderService } from '@/services/orderService';
import type { OrderPieceInfo } from '@/types/order';

const { Text } = Typography;

export type OrderPieceSwitcherProps = {
  orderId: number;
  pieces: OrderPieceInfo[];
  activePieceId: number | null;
  canEdit: boolean;
  onSelectPiece: (pieceId: number) => void;
  onPiecesChanged: (focusPieceId?: number) => void | Promise<void>;
  /** 嵌套在其它 Modal 内时提高子 Modal 层级，避免被遮挡 */
  nestedModalZIndex?: number;
};

const OrderPieceSwitcher: React.FC<OrderPieceSwitcherProps> = ({
  orderId,
  pieces,
  activePieceId,
  canEdit,
  onSelectPiece,
  onPiecesChanged,
  nestedModalZIndex = 1100,
}) => {
  const [renameOpen, setRenameOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addJewelryType, setAddJewelryType] = useState<string | undefined>(undefined);
  const [renamingPiece, setRenamingPiece] = useState<OrderPieceInfo | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);

  const nestedModalProps = {
    zIndex: nestedModalZIndex,
    getContainer: () => document.body,
    mask: true,
  };

  const openAddPiece = () => {
    setAddName('');
    setAddJewelryType(undefined);
    setAddOpen(true);
  };

  const submitAddPiece = async () => {
    const trimmed = addName.trim();
    if (!trimmed) {
      message.warning('请输入单件名称');
      return;
    }
    if (!addJewelryType) {
      message.warning('请选择珠宝类型');
      return;
    }
    setBusy(true);
    try {
      const created = await orderService.createOrderPiece(orderId, trimmed, addJewelryType);
      message.success('已添加单件');
      setAddOpen(false);
      await onPiecesChanged(created.id);
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const openRename = (p: OrderPieceInfo) => {
    setRenamingPiece(p);
    setRenameValue(p.name);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    if (!renamingPiece) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      message.warning('名称不能为空');
      return;
    }
    setBusy(true);
    try {
      await orderService.renameOrderPiece(orderId, renamingPiece.id, trimmed);
      message.success('单件名称已更新');
      setRenameOpen(false);
      await onPiecesChanged();
    } catch (e: unknown) {
      message.error(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (pieces.length === 0) {
    return canEdit ? (
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">当前订单尚无单件记录。</Text>
        <Button size="small" type="link" loading={busy} onClick={openAddPiece}>
          添加第一件
        </Button>
      </div>
    ) : null;
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        单件切换（每单最多 5 件）
      </Text>
      <Space wrap align="center">
        {pieces.map((p) => (
          <Tag
            key={p.id}
            color={p.id === activePieceId ? 'gold' : 'default'}
            style={{ cursor: 'pointer', padding: '4px 10px', marginInlineEnd: 0 }}
            onClick={() => onSelectPiece(p.id)}
          >
            <span>{p.name}</span>
            {p.jewelryType ? ` ·${jewelryTypeLabel(p.jewelryType)}` : ''}
            {p.designConfirmed ? ' ·设计已确认' : ''}
            {p.modelConfirmed ? ' ·建模已确认' : ''}
            {canEdit && (
              <EditOutlined
                style={{ marginLeft: 6, fontSize: 12 }}
                onClick={(e) => {
                  e.stopPropagation();
                  openRename(p);
                }}
              />
            )}
          </Tag>
        ))}
        {canEdit && pieces.length < 5 && (
          <Button
            size="small"
            icon={<PlusOutlined />}
            loading={busy}
            onClick={(e) => {
              e.stopPropagation();
              openAddPiece();
            }}
          >
            添加单件
          </Button>
        )}
      </Space>

      <Modal
        title="添加单件"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => void submitAddPiece()}
        confirmLoading={busy}
        destroyOnClose
        {...nestedModalProps}
      >
        <Input
          maxLength={50}
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder="如男戒、女戒、项链"
          onPressEnter={() => void submitAddPiece()}
        />
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>珠宝类型</Text>
          <Select
            style={{ width: '100%' }}
            placeholder="请选择类型（决定手寸/链长是否必填）"
            value={addJewelryType}
            onChange={setAddJewelryType}
            options={JEWELRY_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
      </Modal>

      <Modal
        title="编辑单件名称"
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        onOk={() => void submitRename()}
        confirmLoading={busy}
        destroyOnClose
        {...nestedModalProps}
      >
        <Input
          maxLength={50}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="如男戒、女戒、项链"
        />
      </Modal>
    </div>
  );
};

export default OrderPieceSwitcher;
