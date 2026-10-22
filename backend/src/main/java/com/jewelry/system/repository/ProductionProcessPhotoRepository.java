package com.jewelry.system.repository;

import com.jewelry.system.entity.ProductionProcessPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductionProcessPhotoRepository extends JpaRepository<ProductionProcessPhoto, Long> {

    List<ProductionProcessPhoto> findByUploaderUserIdAndProcessCodeAndMatchedAtIsNullOrderByIdDesc(
            Long uploaderUserId, String processCode);

    long countByUploaderUserIdAndProcessCodeAndMatchedAtIsNull(Long uploaderUserId, String processCode);
}
