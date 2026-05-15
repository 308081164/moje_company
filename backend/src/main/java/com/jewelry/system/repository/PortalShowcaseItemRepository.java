package com.jewelry.system.repository;

import com.jewelry.system.entity.PortalJewelryCategory;
import com.jewelry.system.entity.PortalShowcaseItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PortalShowcaseItemRepository extends JpaRepository<PortalShowcaseItem, Long> {

    List<PortalShowcaseItem> findByCategoryAndPublishedTrueOrderBySortOrderAscIdAsc(
            PortalJewelryCategory category);

    List<PortalShowcaseItem> findByCategory_IdOrderBySortOrderAscIdAsc(long categoryId);

    boolean existsByCategory_IdAndFile_Id(long categoryId, long fileId);

    long countByCategory_IdAndPublishedTrue(long categoryId);
}
