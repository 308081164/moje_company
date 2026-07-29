package com.moje.jewelry3d.repository;

import com.moje.jewelry3d.entity.GenerateTaskAssetEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GenerateTaskAssetRepository extends JpaRepository<GenerateTaskAssetEntity, String> {

    List<GenerateTaskAssetEntity> findByTaskId(String taskId);

    Optional<GenerateTaskAssetEntity> findFirstByTaskIdAndAssetTypeOrderByCreatedAtDesc(String taskId, String assetType);

    void deleteByTaskId(String taskId);
}
