package com.jewelry.system.repository;

import com.jewelry.system.entity.OrderAccessLink;
import com.jewelry.system.entity.OrderAccessLink.LinkStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OrderAccessLinkRepository extends JpaRepository<OrderAccessLink, Long> {
    Optional<OrderAccessLink> findByAccessToken(String accessToken);
    Optional<OrderAccessLink> findByOrderId(Long orderId);
    List<OrderAccessLink> findByB2bClientId(Long clientId);
    List<OrderAccessLink> findByStatus(LinkStatus status);
    void deleteByExpireTimeBefore(LocalDateTime time);
}