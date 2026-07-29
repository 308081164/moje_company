package com.moje.jewelry3d.repository;

import com.moje.jewelry3d.entity.GenerateTaskEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GenerateTaskRepository extends JpaRepository<GenerateTaskEntity, String> {

    Page<GenerateTaskEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<GenerateTaskEntity> findByStatusInOrderByCreatedAtDesc(List<String> statuses);
}
