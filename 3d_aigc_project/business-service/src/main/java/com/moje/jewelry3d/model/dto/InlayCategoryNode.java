package com.moje.jewelry3d.model.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 镶嵌结构目录分类树节点
 */
@Data
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public class InlayCategoryNode {

    /** 显示名称（目录名） */
    private String label;

    /** 相对路径（用于筛选，如 配件资料庫/微虎爪） */
    private String value;

    /** 该目录及子目录下的文件数量 */
    private long count;

    private List<InlayCategoryNode> children = new ArrayList<>();
}
