package com.jewelry.system.repository;

import com.jewelry.system.entity.PortalCustomerOrderBinding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PortalCustomerOrderBindingRepository extends JpaRepository<PortalCustomerOrderBinding, Long> {

    List<PortalCustomerOrderBinding> findByPortalCustomerIdOrderByCreatedAtDesc(Long portalCustomerId);

    Optional<PortalCustomerOrderBinding> findByPortalCustomerIdAndOrderId(Long portalCustomerId, Long orderId);

    boolean existsByOrderId(Long orderId);

    Optional<PortalCustomerOrderBinding> findByOrderId(Long orderId);
}
