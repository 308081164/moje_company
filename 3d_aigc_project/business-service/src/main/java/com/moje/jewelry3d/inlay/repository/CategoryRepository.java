package com.moje.jewelry3d.inlay.repository;

import com.moje.jewelry3d.inlay.entity.CategoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRepository extends JpaRepository<CategoryEntity, String> {

    List<CategoryEntity> findByParentIdIsNullOrderBySortOrderAscNameAsc();

    List<CategoryEntity> findByParentIdOrderBySortOrderAscNameAsc(String parentId);

    Optional<CategoryEntity> findBySlug(String slug);
}
