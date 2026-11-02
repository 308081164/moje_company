import React, { useEffect, useRef, useState } from 'react';
import { Button, Space, Spin, Switch, Typography } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  fileIdFromUpload,
  meshPreviewKind,
  resolveModelSourceArrayBuffer,
} from '@/utils/modelSourcePreview';
import { readStepToOcctMeshes, type OcctMesh } from '@/utils/occtImport';

const { Text } = Typography;

export type ModelMeshViewportProps = {
  file: UploadFile;
  height?: number;
  /** 填满父容器（父级需有明确高度）；优先于 height */
  fill?: boolean;
  /** 控件叠在画布上，节省纵向空间 */
  overlayControls?: boolean;
  className?: string;
  onDownload?: (fileId: number, fileName: string) => void;
  /** 默认开启自动旋转 */
  defaultAutoRotate?: boolean;
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
  camera.position.set(center.x + dist, center.y + dist * 0.55, center.z + dist);
  controls.target.copy(center);
  camera.near = Math.max(maxDim / 200, 0.01);
  camera.far = maxDim * 200;
  camera.updateProjectionMatrix();
  controls.update();
}

function buildStepGroup(
  meshes: OcctMesh[],
  THREE: typeof import('three')
): import('three').Group {
  const group = new THREE.Group();
  const fallback = new THREE.MeshStandardMaterial({
    color: 0xd4af77,
    metalness: 0.55,
    roughness: 0.32,
  });
  for (const meshData of meshes) {
    if (!meshData.attributes?.position?.array?.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(meshData.attributes.position.array, 3)
    );
    if (meshData.attributes.normal?.array?.length) {
      geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3)
      );
    } else {
      geometry.computeVertexNormals();
    }
    if (meshData.index?.array?.length) {
      geometry.setIndex(meshData.index.array);
    }
    let material: import('three').Material = fallback;
    if (meshData.color && meshData.color.length >= 3) {
      material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(meshData.color[0], meshData.color[1], meshData.color[2]),
        metalness: 0.45,
        roughness: 0.4,
      });
    }
    group.add(new THREE.Mesh(geometry, material));
  }
  return group;
}

const ModelMeshViewport: React.FC<ModelMeshViewportProps> = ({
  file,
  height = 320,
  fill = false,
  overlayControls = false,
  className,
  onDownload,
  defaultAutoRotate = true,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<import('three/examples/jsm/controls/OrbitControls.js').OrbitControls | null>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const resizeRef = useRef<((w: number, h: number) => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(defaultAutoRotate);

  const name = file.name || '模型';
  const kind = meshPreviewKind(name);
  const fileId = fileIdFromUpload(file);
  /** 父组件常每次 render 新建 UploadFile；用 ref 取内容，effect 只跟 fileId/name 走，避免驳回时重下 STEP 卡死 UI */
  const fileRef = useRef(file);
  fileRef.current = file;

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    if (!mountRef.current || kind === 'none') {
      setLoading(false);
      setError(kind === 'none' ? '该格式暂不支持在线三维预览，请下载到本地查看' : null);
      return undefined;
    }

    let disposed = false;
    let renderer: import('three').WebGLRenderer | null = null;
    let frameId = 0;
    let camera: import('three').PerspectiveCamera | null = null;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const buffer = await resolveModelSourceArrayBuffer(fileRef.current);
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (disposed || !mountRef.current) return;

        const el = mountRef.current;
        const width = Math.max(el.clientWidth || 560, 1);
        const h = fill ? Math.max(el.clientHeight || height, 1) : height;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1c1f);
        camera = new THREE.PerspectiveCamera(45, width / h, 0.1, 100000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        el.innerHTML = '';
        el.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 0.95);
        key.position.set(3, 5, 4);
        scene.add(key);
        const fillLight = new THREE.DirectionalLight(0xddeeff, 0.35);
        fillLight.position.set(-4, 2, -2);
        scene.add(fillLight);

        const material = new THREE.MeshStandardMaterial({
          color: 0xd4af77,
          metalness: 0.55,
          roughness: 0.32,
        });

        let root: import('three').Object3D;
        if (kind === 'stl') {
          const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
          const geometry = new STLLoader().parse(buffer);
          geometry.computeVertexNormals();
          root = new THREE.Mesh(geometry, material);
        } else if (kind === 'obj') {
          const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
          root = new OBJLoader().parse(new TextDecoder().decode(buffer));
          root.traverse((child) => {
            const mesh = child as import('three').Mesh;
            if (mesh.isMesh) mesh.material = material;
          });
        } else if (kind === 'glb') {
          const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
          const gltf = await new GLTFLoader().parseAsync(buffer, '');
          root = gltf.scene;
        } else {
          const meshes = await readStepToOcctMeshes(buffer);
          root = buildStepGroup(meshes, THREE);
          if (root.children.length === 0) {
            throw new Error('STEP 未生成可显示网格');
          }
        }
        scene.add(root);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.autoRotate = autoRotate;
        controls.autoRotateSpeed = 1.6;
        fitCameraToObject(camera, controls, root, THREE);
        controlsRef.current = controls;
        fitRef.current = () => fitCameraToObject(camera!, controls, root, THREE);
        resizeRef.current = (w: number, nh: number) => {
          if (!renderer || !camera) return;
          camera.aspect = w / Math.max(nh, 1);
          camera.updateProjectionMatrix();
          renderer.setSize(w, Math.max(nh, 1));
        };

        const animate = () => {
          if (disposed) return;
          frameId = requestAnimationFrame(animate);
          controls.update();
          renderer!.render(scene, camera!);
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
      controlsRef.current = null;
      fitRef.current = null;
      resizeRef.current = null;
      renderer?.dispose();
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
  }, [fileId, name, kind, height, fill]);

  useEffect(() => {
    if (!fill || !mountRef.current) return undefined;
    const el = mountRef.current;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height: h } = entry.contentRect;
      if (width > 0 && h > 0) resizeRef.current?.(width, h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill, file, kind]);

  const controls = (
    <Space size={8} wrap>
      <span style={{ fontSize: 12, color: overlayControls ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)' }}>
        自动旋转
      </span>
      <Switch size="small" checked={autoRotate} onChange={setAutoRotate} />
      <Button size="small" icon={<ReloadOutlined />} onClick={() => fitRef.current?.()}>
        复位
      </Button>
      {fileId != null && onDownload ? (
        <Button size="small" icon={<DownloadOutlined />} onClick={() => onDownload(fileId, name)}>
          下载
        </Button>
      ) : null}
    </Space>
  );

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: fill ? '100%' : undefined,
        display: fill ? 'flex' : undefined,
        flexDirection: fill ? 'column' : undefined,
        position: 'relative',
        minHeight: fill ? 0 : undefined,
      }}
    >
      {!overlayControls ? (
        <Space wrap style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {name} · 拖拽旋转 / 滚轮缩放
          </Text>
          {controls}
        </Space>
      ) : (
        <div
          style={{
            position: 'absolute',
            zIndex: 2,
            top: 10,
            right: 10,
            left: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            拖拽旋转 / 滚轮缩放
          </Text>
          <div style={{ pointerEvents: 'auto' }}>{controls}</div>
        </div>
      )}
      <div
        ref={mountRef}
        style={{
          width: '100%',
          height: fill ? '100%' : height,
          flex: fill ? 1 : undefined,
          minHeight: fill ? 0 : undefined,
          borderRadius: overlayControls || fill ? 0 : 10,
          overflow: 'hidden',
          background: '#1a1c1f',
          border: overlayControls || fill ? 'none' : '1px solid #2c2f36',
          position: 'relative',
        }}
      />
      {loading ? (
        <div
          style={{
            position: fill || overlayControls ? 'absolute' : 'static',
            inset: fill || overlayControls ? 0 : undefined,
            display: 'grid',
            placeItems: 'center',
            marginTop: fill || overlayControls ? 0 : 8,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <Spin tip={kind === 'step' ? '正在解析 STEP…' : '加载模型…'} />
        </div>
      ) : null}
      {error ? (
        <Text
          type="danger"
          style={{
            display: 'block',
            marginTop: fill || overlayControls ? 0 : 8,
            position: fill || overlayControls ? 'absolute' : 'static',
            left: 12,
            bottom: 12,
            zIndex: 2,
            textShadow: fill || overlayControls ? '0 1px 2px #000' : undefined,
          }}
        >
          {error}
        </Text>
      ) : null}
    </div>
  );
};

export default ModelMeshViewport;
