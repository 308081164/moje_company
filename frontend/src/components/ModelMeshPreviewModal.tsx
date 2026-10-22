import React, { useEffect, useRef, useState } from 'react';
import { Modal, Spin, Typography, Button, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  fileIdFromUpload,
  meshPreviewKind,
  resolveModelSourceArrayBuffer,
} from '@/utils/modelSourcePreview';

export type ModelMeshPreviewModalProps = {
  open: boolean;
  file: UploadFile | null;
  onClose: () => void;
  onDownload?: (fileId: number, fileName: string) => void;
};

function fitCameraToObject(
  camera: import('three').PerspectiveCamera,
  controls: import('three/examples/jsm/controls/OrbitControls.js').OrbitControls,
  object: import('three').Object3D,
  THREE: typeof import('three')
) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const dist = maxDim * 2.4;
  camera.position.set(center.x + dist, center.y + dist * 0.5, center.z + dist);
  controls.target.copy(center);
  camera.near = maxDim / 100;
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();
}

const ModelMeshPreviewModal: React.FC<ModelMeshPreviewModalProps> = ({
  open,
  file,
  onClose,
  onDownload,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = file?.name || '模型文件';
  const kind = meshPreviewKind(name);
  const fileId = file ? fileIdFromUpload(file) : undefined;

  useEffect(() => {
    if (!open || !file || kind === 'none' || !mountRef.current) {
      return undefined;
    }

    let disposed = false;
    let renderer: import('three').WebGLRenderer | null = null;
    let frameId = 0;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const buffer = await resolveModelSourceArrayBuffer(file);
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        if (disposed || !mountRef.current) return;

        const width = mountRef.current.clientWidth || 640;
        const height = 420;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf4f4f5);

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mountRef.current.innerHTML = '';
        mountRef.current.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dir = new THREE.DirectionalLight(0xffffff, 0.85);
        dir.position.set(3, 5, 4);
        scene.add(dir);

        const material = new THREE.MeshStandardMaterial({
          color: 0xc9a96e,
          metalness: 0.35,
          roughness: 0.45,
        });

        let root: import('three').Object3D;
        if (kind === 'stl') {
          const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
          const geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          root = new THREE.Mesh(geometry, material);
        } else {
          const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
          const text = new TextDecoder().decode(buffer);
          root = new OBJLoader().parse(text);
          root.traverse((child: import('three').Object3D) => {
            const mesh = child as import('three').Mesh;
            if (mesh.isMesh) {
              mesh.material = material;
            }
          });
        }
        scene.add(root);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        fitCameraToObject(camera, controls, root, THREE);

        const animate = () => {
          if (disposed) return;
          frameId = requestAnimationFrame(animate);
          controls.update();
          renderer!.render(scene, camera);
        };
        animate();
      } catch (e) {
        if (!disposed) {
          setError(e instanceof Error ? e.message : '预览加载失败');
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void run();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      renderer?.dispose();
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, [open, file, kind]);

  return (
    <Modal
      title={`预览：${name}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnClose
    >
      {kind === 'none' ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            STEP / ZIP / JCD 等格式暂不支持在线三维预览，请下载后使用本地软件查看。
          </Typography.Text>
          {fileId != null && onDownload && (
            <Button icon={<DownloadOutlined />} onClick={() => onDownload(fileId, name)}>
              下载文件
            </Button>
          )}
        </Space>
      ) : (
        <>
          <div
            ref={mountRef}
            style={{
              width: '100%',
              height: 420,
              borderRadius: 8,
              overflow: 'hidden',
              background: '#f4f4f5',
            }}
          />
          {loading && (
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Spin tip="加载模型…" />
            </div>
          )}
          {error && (
            <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
              {error}
            </Typography.Text>
          )}
        </>
      )}
    </Modal>
  );
};

export default ModelMeshPreviewModal;
