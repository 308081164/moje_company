package com.jewelry.system.repository;

import com.jewelry.system.entity.Order;
import com.jewelry.system.enums.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long>, JpaSpecificationExecutor<Order> {

    @EntityGraph(attributePaths = {"salesMid"})
    @Query("SELECT o FROM Order o")
    Page<Order> findAllWithSalesMid(Pageable pageable);

    @EntityGraph(attributePaths = {"salesMid", "salesPre", "designer", "modeler", "followUp"})
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findWithGraphById(@Param("id") Long id);

    /**
     * 设计/建模阶段未指派且问卷已提交的 C 端订单（等待派单）。
     */
    @Query("""
            SELECT o FROM Order o
            WHERE o.status = :pendingDesign
              AND o.designer IS NULL
              AND EXISTS (
                    SELECT 1 FROM OrderCustomerBrief b
                    WHERE b.orderId = o.id AND b.submittedAt IS NOT NULL
              )
            """)
    List<Order> findAwaitingDesignerWithBriefSubmitted(@Param("pendingDesign") OrderStatus pendingDesign);

    @Query("""
            SELECT o FROM Order o
            WHERE o.status = :pendingModel
              AND o.modeler IS NULL
              AND EXISTS (
                    SELECT 1 FROM OrderCustomerBrief b
                    WHERE b.orderId = o.id AND b.submittedAt IS NOT NULL
              )
            """)
    List<Order> findAwaitingModelerWithBriefSubmitted(@Param("pendingModel") OrderStatus pendingModel);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);

    List<Order> findByMarketplaceSellerIdOrderByCreatedAtDesc(Long marketplaceSellerId);

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

    /** 设计阶段未指派设计师的订单（工作台/群聊会漏单） */
    List<Order> findByStatusInAndDesignerIsNull(Collection<OrderStatus> statuses);

    List<Order> findByDesignerIdAndStatusIn(Long designerId, Collection<OrderStatus> statuses);

    long countByModelerIdAndStatusIn(Long modelerId, List<OrderStatus> statuses);

    long countByFollowUpIdAndStatusIn(Long followUpId, List<OrderStatus> statuses);

    List<Order> findByB2bClientIdOrderByCreatedAtDesc(Long b2bClientId);

    Optional<Order> findFirstByB2bClientIdOrderByCreatedAtDesc(Long b2bClientId);

    Optional<Order> findByOrderNumber(String orderNumber);

    /**
     * 排队前方订单数：更高加急档，或同档更早入队（含同秒按 id）。
     */
    @Query("""
            SELECT COUNT(o) FROM Order o
            WHERE o.status IN :statuses
              AND (
                    COALESCE(o.priorityTier, 0) > :tier
                 OR (
                        COALESCE(o.priorityTier, 0) = :tier
                    AND (
                            COALESCE(o.queueEnteredAt, o.orderTime, o.createdAt) < :entered
                         OR (
                                COALESCE(o.queueEnteredAt, o.orderTime, o.createdAt) = :entered
                            AND o.id < :orderId
                            )
                        )
                    )
                  )
            """)
    long countAheadInQueue(
            @Param("statuses") Collection<OrderStatus> statuses,
            @Param("tier") int tier,
            @Param("entered") LocalDateTime entered,
            @Param("orderId") Long orderId);

    @Query("""
            SELECT DISTINCT o FROM Order o
            WHERE EXISTS (SELECT 1 FROM ModelingInfo mi WHERE mi.orderId = o.id)
            AND NOT EXISTS (SELECT 1 FROM OrderModelingArchive ma WHERE ma.orderId = o.id AND ma.completedAt IS NOT NULL)
            ORDER BY o.updatedAt DESC
            """)
    Page<Order> pageModelingArchiveSharedPool(Pageable pageable);
}
