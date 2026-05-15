package com.jewelry.system.repository;

import com.jewelry.system.entity.PortalJewelryCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PortalJewelryCategoryRepository extends JpaRepository<PortalJewelryCategory, Long> {

    Optional<PortalJewelryCategory> findBySlug(String slug);

    List<PortalJewelryCategory> findAllByEnabledTrueOrderBySortOrderAscIdAsc();
}
