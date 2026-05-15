package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderMarketingCopy;
import com.jewelry.system.enums.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface OrderMarketingCopyRepository extends JpaRepository<OrderMarketingCopy, Long> {

    boolean existsByOrder_Id(long orderId);

    Optional<OrderMarketingCopy> findByOrder_Id(long orderId);

    @Query("""
            SELECT mc FROM OrderMarketingCopy mc
            JOIN mc.order o
            WHERE mc.generationComplete = false AND o.status = :st
            ORDER BY mc.updatedAt DESC
            """)
    Page<OrderMarketingCopy> pagePending(@Param("st") OrderStatus status, Pageable pageable);
}
