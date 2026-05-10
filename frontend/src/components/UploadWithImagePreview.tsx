import React, { useCallback, useState } from 'react';
import { Image, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { isLikelyRasterImageFile, resolveUploadFileImageSrc } from '@/utils/orderUploadFileList';

export type UploadWithImagePreviewProps = Omit<UploadProps, 'onPreview' | 'fileList'> & {
  fileList: UploadFile[];
  /** 为 true 时：非栅格图扩展名的文件点击「预览」改为新窗口打开 URL（如 STL）。 */
  imageOnlyRasterPreview?: boolean;
};

/**
 * 在 Ant Design Upload 上统一：受控 fileList + 点击缩略图/预览时使用 Image 预览（可缩放），
 * 避免仅依赖 Upload 默认行为导致部分 customRequest 场景下预览异常。
 */
const UploadWithImagePreview: React.FC<UploadWithImagePreviewProps> = ({
  fileList,
  imageOnlyRasterPreview,
  ...rest
}) => {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState('');

  const onPreview = useCallback<NonNullable<UploadProps['onPreview']>>(
    (file) => {
      const u = resolveUploadFileImageSrc(file)?.trim();
      if (!u) {
        message.warning('暂无可预览地址');
        return;
      }
      if (imageOnlyRasterPreview && !isLikelyRasterImageFile(file)) {
        window.open(u, '_blank', 'noopener,noreferrer');
        return;
      }
      setSrc(u);
      setOpen(true);
    },
    [imageOnlyRasterPreview]
  );

  return (
    <>
      <Upload {...rest} fileList={fileList} onPreview={onPreview} />
      {src ? (
        <Image
          key={src}
          alt="预览"
          style={{ display: 'none' }}
          src={src}
          preview={{
            visible: open,
            onVisibleChange: (v) => {
              setOpen(v);
              if (!v) setSrc('');
            },
          }}
        />
      ) : null}
    </>
  );
};

export default UploadWithImagePreview;
