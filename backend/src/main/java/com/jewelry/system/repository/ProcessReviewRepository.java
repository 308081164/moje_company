package com.jewelry.system.repository;

import com.jewelry.system.entity.ProcessReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProcessReviewRepository extends JpaRepository<ProcessReview, Long> {

    Optional<ProcessReview> findTopByOrderIdOrderByIdDesc(Long orderId);
}
