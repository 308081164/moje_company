package com.jewelry.system.repository;

import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.enums.FileRelatedType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FileEntityRepository extends JpaRepository<FileEntity, Long> {

    List<FileEntity> findByRelatedTypeAndRelatedIdOrderByIdDesc(FileRelatedType relatedType, Long relatedId);
}
