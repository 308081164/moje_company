package com.jewelry.system.repository;

import com.jewelry.system.entity.Order;
import com.jewelry.system.enums.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    @EntityGraph(attributePaths = {"salesMid"})
    @Query("SELECT o FROM Order o")
    Page<Order> findAllWithSalesMid(Pageable pageable);

    @EntityGraph(attributePaths = {"salesMid", "salesPre", "designer", "modeler", "followUp"})
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findWithGraphById(@Param("id") Long id);

    long countByOrderNumberStartingWith(String prefix);

    long countByStatus(OrderStatus status);

    long countByCreatedAtAfter(LocalDateTime t);

    @Query("SELECT COALESCE(SUM(o.deposit), 0) FROM Order o")
    BigDecimal sumAllDeposit();

    @Query("SELECT COALESCE(SUM(o.deposit), 0) FROM Order o WHERE o.status = :st")
    BigDecimal sumDepositByStatus(@Param("st") OrderStatus st);

    @Query("SELECT o.source, COUNT(o), COALESCE(SUM(o.deposit), 0) FROM Order o GROUP BY o.source")
    List<Object[]> aggregateBySource();

    @Query("SELECT o.status, COUNT(o) FROM Order o GROUP BY o.status")
    List<Object[]> aggregateByStatus();

    long countByStatusAndUpdatedAtAfter(OrderStatus status, LocalDateTime t);

    List<Order> findByCustomerPhone(String customerPhone);

    // C端/B端统计相关
    long countByIsB2b(Boolean isB2b);

    long countByIsB2bAndStatus(Boolean isB2b, OrderStatus status);

    @Query("SELECT COALESCE(SUM(o.deposit), 0) FROM Order o WHERE o.isB2b = :isB2b")
    BigDecimal sumDepositByIsB2b(@Param("isB2b") Boolean isB2b);

    long countByCreatedAtAfterAndIsB2b(LocalDateTime t, Boolean isB2b);

    List<Order> findByModelerIdAndStatusIn(Long modelerId, List<OrderStatus> statuses);

    // 自动分配相关的统计方法
    long countBySalesMidIdAndStatusIn(Long salesMidId, List<OrderStatus> statuses);

    long countByDesignerIdAndStatusIn(Long designerId, List<OrderStatus> statuses);

    long countByModelerIdAndStatusIn(Long modelerId, List<OrderStatus> statuses);

    long countByFollowUpIdAndStatusIn(Long followUpId, List<OrderStatus> statuses);

    List<Order> findByB2bClientIdOrderByCreatedAtDesc(Long b2bClientId);

    Optional<Order> findByOrderNumber(String orderNumber);

    @Query("""
            SELECT DISTINCT o FROM Order o
            WHERE EXISTS (SELECT 1 FROM ModelingInfo mi WHERE mi.orderId = o.id)
            AND NOT EXISTS (SELECT 1 FROM OrderModelingArchive ma WHERE ma.orderId = o.id AND ma.completedAt IS NOT NULL)
            ORDER BY o.updatedAt DESC
            """)
    Page<Order> pageModelingArchiveSharedPool(Pageable pageable);
}
