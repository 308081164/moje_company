/** occt-import-js 无类型封装：浏览器内解析 STEP/STP。 */

export type OcctMesh = {
  name?: string;
  color?: number[];
  index?: { array: number[] };
  attributes?: {
    position?: { array: number[] };
    normal?: { array: number[] };
  };
  brep_faces?: { first: number; last: number; color?: number[] | null }[];
};

export type OcctResult = {
  success?: boolean;
  meshes?: OcctMesh[];
};

type OcctModule = {
  ReadStepFile: (content: Uint8Array, params: unknown) => OcctResult;
};

type OcctFactory = (opts?: { locateFile?: (path: string, scriptDir?: string) => string }) => Promise<OcctModule>;

let occtPromise: Promise<OcctModule> | null = null;

function resolveWasmUrl(file: string): string {
  if (typeof window === 'undefined') return file;
  try {
    return new URL(file, window.location.href).toString();
  } catch {
    return file;
  }
}

export async function getOcctModule(): Promise<OcctModule> {
  if (!occtPromise) {
    occtPromise = (async () => {
      // CJS 工厂：webpack 会打包 js，wasm 由 CopyWebpackPlugin 放到 dist 根目录
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const factory = require('occt-import-js') as OcctFactory;
      return factory({
        locateFile: (path) => (path.endsWith('.wasm') ? resolveWasmUrl(path) : path),
      });
    })();
  }
  return occtPromise;
}

export async function readStepToOcctMeshes(buffer: ArrayBuffer): Promise<OcctMesh[]> {
  const occt = await getOcctModule();
  // 先让出主线程，避免驳回等点击后立刻被同步 WASM 解析饿死，按钮一直转圈
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  const result = occt.ReadStepFile(new Uint8Array(buffer), null);
  if (!result?.success || !result.meshes?.length) {
    throw new Error('STEP 解析失败或模型为空');
  }
  return result.meshes;
}
