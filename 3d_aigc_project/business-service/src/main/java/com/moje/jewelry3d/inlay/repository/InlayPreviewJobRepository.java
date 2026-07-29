package com.moje.jewelry3d.inlay.repository;

import com.moje.jewelry3d.inlay.entity.InlayPreviewJobEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface InlayPreviewJobRepository extends JpaRepository<InlayPreviewJobEntity, String> {

    @Query("SELECT j FROM InlayPreviewJobEntity j WHERE j.status = 'pending' ORDER BY j.priority DESC, j.createdAt ASC")
    List<InlayPreviewJobEntity> findPendingJobs(Pageable pageable);

    long countByStatus(String status);

    List<InlayPreviewJobEntity> findByInlayId(String inlayId);

    void deleteByInlayId(String inlayId);
}
