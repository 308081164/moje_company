package com.moje.jewelry3d.inlay.repository;

import com.moje.jewelry3d.inlay.entity.TagEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends JpaRepository<TagEntity, String> {

    Optional<TagEntity> findByName(String name);

    List<TagEntity> findByNameContainingIgnoreCaseOrderByNameAsc(String name);
}
