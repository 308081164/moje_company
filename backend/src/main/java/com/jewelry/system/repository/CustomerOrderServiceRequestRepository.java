package com.jewelry.system.repository;

import com.jewelry.system.entity.CustomerOrderServiceRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CustomerOrderServiceRequestRepository extends JpaRepository<CustomerOrderServiceRequest, Long> {

    List<CustomerOrderServiceRequest> findByOrderIdOrderByCreatedAtDesc(Long orderId);

    List<CustomerOrderServiceRequest> findByOrderIdAndTypeOrderByCreatedAtDesc(Long orderId, String type);

    List<CustomerOrderServiceRequest> findByOrderIdInAndTypeOrderByCreatedAtDesc(
            Collection<Long> orderIds, String type);

    List<CustomerOrderServiceRequest> findByStatusInOrderByCreatedAtDesc(Collection<String> statuses);

    Optional<CustomerOrderServiceRequest> findFirstByOrderIdAndTypeAndStatusIn(
            Long orderId, String type, Collection<String> statuses);
}
