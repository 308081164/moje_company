package com.moje.jewelry3d.inlay.repository;

import com.moje.jewelry3d.inlay.entity.InlayAliasEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InlayAliasRepository extends JpaRepository<InlayAliasEntity, String> {

    List<InlayAliasEntity> findByInlayId(String inlayId);
}
