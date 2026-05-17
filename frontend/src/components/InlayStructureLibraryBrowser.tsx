import React, { useCallback, useEffect, useState } from 'react';
import {
  Breadcrumb,
  Button,
  Input,
  Modal,
  Space,
  Table,
  Typography,
  Upload,
  message,
  Tag,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  FolderAddOutlined,
  ReloadOutlined,
  UploadOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  inlayStructureService,
  type InlayStructureDeleteQuota,
  type InlayStructureEntry,
} from '@/services/inlayStructureService';
import SecondaryPasswordModal from '@/components/SecondaryPasswordModal';

const { Text } = Typography;

export interface InlayStructureLibraryBrowserProps {
  /** 嵌入订单页时可缩小高度 */
  compact?: boolean;
}

const InlayStructureLibraryBrowser: React.FC<InlayStructureLibraryBrowserProps> = ({ compact }) => {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<InlayStructureEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState<InlayStructureDeleteQuota | null>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pendingDeletePath, setPendingDeletePath] = useState<string | null>(null);

  const pathParam = currentPath === '/' ? '' : currentPath.replace(/^\//, '');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, q] = await Promise.all([
        inlayStructureService.list(pathParam),
        inlayStructureService.deleteQuota(),
      ]);
      setEntries(list.entries || []);
      setCurrentPath(list.currentPath?.startsWith('/') ? list.currentPath : `/${list.currentPath || ''}`);
      setQuota(q);
    } catch (e: any) {
      message.error(e?.response?.data?.message || '加载镶嵌结构库失败');
    } finally {
      setLoading(false);
    }
  }, [pathParam]);

  useEffect(() => {
    load();
  }, [load]);

  const breadcrumbItems = () => {
    const parts = pathParam ? pathParam.split('/').filter(Boolean) : [];
    const items: { title: React.ReactNode }[] = [
      {
        title: (
          <a
            onClick={(e) => {
              e.preventDefault();
              setCurrentPath('/');
            }}
          >
            根目录
          </a>
        ),
      },
    ];
    let acc = '';
    parts.forEach((p) => {
      acc = acc ? `${acc}${p}/` : `${p}/`;
      const clickPath = `/${acc}`;
      items.push({
        title: (
          <a
            onClick={(e) => {
              e.preventDefault();
              setCurrentPath(clickPath);
            }}
          >
            {p}
          </a>
        ),
      });
    });
    return items;
  };

  const openDir = (row: InlayStructureEntry) => {
    if (!row.directory) return;
    const p = row.path.endsWith('/') ? row.path : `${row.path}/`;
    setCurrentPath(p.startsWith('/') ? p : `/${p}`);
  };

  const handleMkdir = () => {
    let name = '';
    Modal.confirm({
      title: '新建文件夹',
      content: (
        <Input
          placeholder="文件夹名称"
          onChange={(e) => {
            name = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        if (!name.trim()) {
          message.warning('请输入名称');
          return Promise.reject();
        }
        await inlayStructureService.createDirectory(pathParam, name.trim());
        message.success('已创建');
        await load();
      },
    });
  };

  const handleRename = (row: InlayStructureEntry) => {
    let newName = row.name;
    Modal.confirm({
      title: row.directory ? '重命名文件夹' : '重命名文件',
      content: (
        <Input
          defaultValue={row.name}
          onChange={(e) => {
            newName = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        if (!newName.trim()) return Promise.reject();
        const p = row.directory && !row.path.endsWith('/') ? `${row.path}/` : row.path;
        await inlayStructureService.rename(p, newName.trim());
        message.success('已重命名');
        await load();
      },
    });
  };

  const handleMove = (row: InlayStructureEntry) => {
    let target = pathParam;
    Modal.confirm({
      title: '移动到目录',
      content: (
        <Input
          placeholder="目标目录相对路径，如 子目录/ 或留空表示根目录"
          defaultValue={pathParam}
          onChange={(e) => {
            target = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        const from = row.directory && !row.path.endsWith('/') ? `${row.path}/` : row.path;
        await inlayStructureService.move(from, target || '');
        message.success('已移动');
        await load();
      },
    });
  };

  const doDelete = async (path: string, secondaryPassword?: string) => {
    const p = path.endsWith('/') || !path.includes('.') ? (path.endsWith('/') ? path : `${path}/`) : path;
    await inlayStructureService.remove(p, secondaryPassword);
    message.success('已删除');
    setPendingDeletePath(null);
    setPwdOpen(false);
    await load();
  };

  const handleDelete = async (row: InlayStructureEntry) => {
    const p = row.directory && !row.path.endsWith('/') ? `${row.path}/` : row.path;
    Modal.confirm({
      title: '确认删除',
      content: `确定删除「${row.name}」？此操作不可恢复。`,
      okType: 'danger',
      onOk: async () => {
        if (quota?.requiresSecondaryPassword) {
          setPendingDeletePath(p);
          setPwdOpen(true);
          return;
        }
        await doDelete(p);
      },
    });
  };

  const columns: ColumnsType<InlayStructureEntry> = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (_, row) => (
        <Space>
          {row.directory ? <FolderOutlined /> : <FileOutlined />}
          {row.directory ? (
            <a onClick={() => openDir(row)}>{row.name}</a>
          ) : (
            <span>{row.name}</span>
          )}
        </Space>
      ),
    },
    {
      title: '大小',
      width: 100,
      render: (_, row) => (row.directory ? '—' : row.size != null ? `${Math.round(row.size / 1024)} KB` : '—'),
    },
    {
      title: '操作',
      width: 220,
      render: (_, row) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleRename(row)}>
            重命名
          </Button>
          <Button type="link" size="small" onClick={() => handleMove(row)}>
            移动
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space wrap>
          <Text type="secondary">
            今日删除：{quota?.usedToday ?? 0} / {quota?.dailyLimit ?? 3}
            {quota?.requiresSecondaryPassword ? (
              <Tag color="orange" style={{ marginLeft: 8 }}>
                超额删除需二级密码
              </Tag>
            ) : (
              <Tag color="green" style={{ marginLeft: 8 }}>
                剩余免费 {quota?.remainingFree ?? 0} 次
              </Tag>
            )}
          </Text>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            刷新
          </Button>
          <Button icon={<FolderAddOutlined />} onClick={handleMkdir}>
            新建文件夹
          </Button>
          <Upload
            showUploadList={false}
            beforeUpload={(file) => {
              inlayStructureService
                .upload(pathParam, file)
                .then(() => {
                  message.success('上传成功');
                  load();
                })
                .catch((e: any) => message.error(e?.response?.data?.message || '上传失败'));
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>上传文件</Button>
          </Upload>
        </Space>
        <Breadcrumb items={breadcrumbItems()} />
        <Table
          rowKey="path"
          size={compact ? 'small' : 'middle'}
          loading={loading}
          columns={columns}
          dataSource={entries}
          pagination={false}
          scroll={{ y: compact ? 280 : 480 }}
        />
      </Space>
      <SecondaryPasswordModal
        open={pwdOpen}
        title="今日删除次数已用完，请输入二级密码"
        onCancel={() => {
          setPwdOpen(false);
          setPendingDeletePath(null);
        }}
        onVerified={async (pwd) => {
          if (pendingDeletePath) {
            await doDelete(pendingDeletePath, pwd);
          }
        }}
      />
    </div>
  );
};

export default InlayStructureLibraryBrowser;
