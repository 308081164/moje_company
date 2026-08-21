package com.jewelry.system.repository;

import com.jewelry.system.entity.PortalHomeBlock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PortalHomeBlockRepository extends JpaRepository<PortalHomeBlock, Long> {

    List<PortalHomeBlock> findByScopeOrderBySectionAscSortOrderAscIdAsc(String scope);

    List<PortalHomeBlock> findByScopeAndSectionOrderBySortOrderAscIdAsc(String scope, String section);
}
