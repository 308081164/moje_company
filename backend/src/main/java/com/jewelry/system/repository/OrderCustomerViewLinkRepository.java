package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderCustomerViewLink;
import com.jewelry.system.entity.OrderCustomerViewLink.LinkStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrderCustomerViewLinkRepository extends JpaRepository<OrderCustomerViewLink, Long> {

    Optional<OrderCustomerViewLink> findByViewToken(String viewToken);

    Optional<OrderCustomerViewLink> findByOrderId(Long orderId);

    Optional<OrderCustomerViewLink> findByOrderIdAndStatus(Long orderId, LinkStatus status);
}
