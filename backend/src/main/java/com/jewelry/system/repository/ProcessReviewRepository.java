package com.jewelry.system.repository;

import com.jewelry.system.entity.ProcessReview;
import com.jewelry.system.enums.ReviewKind;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProcessReviewRepository extends JpaRepository<ProcessReview, Long> {

    Optional<ProcessReview> findTopByOrderIdOrderByIdDesc(Long orderId);

    Optional<ProcessReview> findTopByOrderIdAndReviewKindOrderByIdDesc(Long orderId, ReviewKind reviewKind);
}
