package com.jewelry.system.repository;

import com.jewelry.system.entity.ModelingInfo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ModelingInfoRepository extends JpaRepository<ModelingInfo, Long> {

    Optional<ModelingInfo> findByOrderId(Long orderId);
}
