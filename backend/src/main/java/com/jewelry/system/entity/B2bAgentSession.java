package com.jewelry.system.entity;

import com.jewelry.system.enums.B2bAgentSessionStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "b2b_agent_session")
@EntityListeners(AuditingEntityListener.class)
public class B2bAgentSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_token", nullable = false, unique = true, length = 64)
    private String publicToken;

    @Column(name = "client_id")
    private Long clientId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private B2bAgentSessionStatus status = B2bAgentSessionStatus.ACTIVE;

    @Column(name = "draft_json", columnDefinition = "JSON")
    private String draftJson;

    @Column(name = "committed_order_id")
    private Long committedOrderId;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
