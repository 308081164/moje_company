package com.moje.jewelry3d.inlay.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.io.BufferedReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * 读取伴生 OBJ 的 .mesh.json 元数据，或检测已知 proxy 指纹（524v/1024f）。
 */
@Slf4j
public final class InlayMeshMetadataUtil {

    private static final int PROXY_VERTS = 524;
    private static final int PROXY_FACES = 1024;
    private static final String PROXY_HEADER = "# https://github.com/mikedh/trimesh";

    private InlayMeshMetadataUtil() {}

    public record MeshMeta(String method, boolean isProxy, int verts, int faces) {}

    public static MeshMeta readFromSidecar(Path objPath) {
        Path sidecar = objPath.getParent().resolve(objPath.getFileName().toString()
                .replaceFirst("\\.[^.]+$", "") + ".mesh.json");
        if (!Files.isRegularFile(sidecar)) {
            return null;
        }
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode node = mapper.readTree(sidecar.toFile());
            String method = node.path("mesh_method").asText(null);
            boolean proxy = node.path("mesh_is_proxy").asBoolean(false);
            int verts = node.path("verts").asInt(0);
            int faces = node.path("faces").asInt(0);
            return new MeshMeta(method, proxy, verts, faces);
        } catch (Exception e) {
            log.debug("Sidecar read failed: {}", sidecar);
            return null;
        }
    }

    public static boolean isKnownProxyObj(Path objPath) {
        if (!Files.isRegularFile(objPath)) return false;
        MeshMeta sidecar = readFromSidecar(objPath);
        if (sidecar != null) return sidecar.isProxy();
        return matchesProxyFingerprint(objPath);
    }

    public static boolean matchesProxyFingerprint(Path objPath) {
        try {
            byte[] head = Files.readAllBytes(objPath);
            String prefix = new String(head, 0, Math.min(head.length, 80), StandardCharsets.UTF_8);
            if (!prefix.contains(PROXY_HEADER)) return false;
            int[] topo = countObjTopology(objPath);
            return topo[0] == PROXY_VERTS && topo[1] == PROXY_FACES;
        } catch (Exception e) {
            return false;
        }
    }

    private static int[] countObjTopology(Path objPath) {
        int verts = 0;
        int faces = 0;
        try (BufferedReader reader = Files.newBufferedReader(objPath, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("v ")) verts++;
                else if (line.startsWith("f ")) faces++;
            }
        } catch (Exception ignored) {}
        return new int[]{verts, faces};
    }

    /** mesh_ready 语义：有真实（非 proxy）网格可用于 3D 预览/融合 */
    public static boolean isRealMeshReady(Path objPath) {
        if (!Files.isRegularFile(objPath)) return false;
        return !isKnownProxyObj(objPath);
    }

    public static MeshMeta resolveMeshMeta(Path objPath) {
        MeshMeta sidecar = readFromSidecar(objPath);
        if (sidecar != null) return sidecar;
        if (!Files.isRegularFile(objPath)) return null;
        int[] topo = countObjTopology(objPath);
        boolean proxy = matchesProxyFingerprint(objPath);
        String method = proxy ? "parametric_prong_legacy" : "legacy_obj";
        return new MeshMeta(method, proxy, topo[0], topo[1]);
    }
}
