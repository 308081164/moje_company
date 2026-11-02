declare module 'occt-import-js' {
  type OcctFactory = (opts?: {
    locateFile?: (path: string, scriptDirectory?: string) => string;
  }) => Promise<{
    ReadStepFile: (content: Uint8Array, params: unknown) => {
      success?: boolean;
      meshes?: unknown[];
    };
  }>;
  const occtimportjs: OcctFactory;
  export default occtimportjs;
}
