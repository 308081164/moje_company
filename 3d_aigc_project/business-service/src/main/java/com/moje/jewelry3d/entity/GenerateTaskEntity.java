package com.moje.jewelry3d.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "generate_task")
public class GenerateTaskEntity {

    @Id
    @Column(name = "task_id", length = 36)
    private String taskId;

    @Column(name = "task_type", nullable = false, length = 32)
    private String taskType;

    @Column(nullable = false, length = 16)
    private String status = "pending";

    @Column(name = "input_image_filename", length = 512)
    private String inputImageFilename;

    @Column(name = "inlay_structure_filename", length = 512)
    private String inlayStructureFilename;

    @Column(name = "output_filename", length = 512)
    private String outputFilename;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "params_json", columnDefinition = "TEXT")
    private String paramsJson = "{}";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
