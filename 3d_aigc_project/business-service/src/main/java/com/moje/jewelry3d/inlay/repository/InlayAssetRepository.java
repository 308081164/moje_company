package com.moje.jewelry3d.inlay.repository;

import com.moje.jewelry3d.inlay.entity.InlayAssetEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InlayAssetRepository extends JpaRepository<InlayAssetEntity, String> {

    List<InlayAssetEntity> findByInlayIdAndCurrentTrue(String inlayId);

    List<InlayAssetEntity> findByInlayId(String inlayId);

    Optional<InlayAssetEntity> findByInlayIdAndAssetTypeAndCurrentTrue(String inlayId, String assetType);
}
