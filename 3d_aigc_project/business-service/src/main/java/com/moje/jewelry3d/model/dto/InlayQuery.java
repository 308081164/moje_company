package com.moje.jewelry3d.model.dto;

import lombok.Builder;
import lombok.Data;

/**
 * 镶嵌结构查询条件
 */
@Data
@Builder
public class InlayQuery {

    /** 关键词（匹配文件名或相对路径） */
    private String keyword;

    /** 文件格式，如 JCD / OBJ / MESH（OBJ+GLB+STL 合集，不区分大小写） */
    private String format;

    /** 是否仅有预览图 */
    private Boolean hasPreview;

    /** 仅返回可直接用于融合管线的项（mesh 本体或带伴生 mesh 的 JCD） */
    private Boolean meshReady;

    /** 目录分类（相对路径前缀，如 配件资料库/微虎爪） */
    private String category;

    private int page;

    private int pageSize;
}
