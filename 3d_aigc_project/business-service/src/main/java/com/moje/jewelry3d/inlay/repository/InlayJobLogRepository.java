package com.moje.jewelry3d.inlay.repository;

import com.moje.jewelry3d.inlay.entity.InlayJobLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InlayJobLogRepository extends JpaRepository<InlayJobLogEntity, String> {

    Page<InlayJobLogEntity> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
}
