package com.jewelry.system.entity;

import com.jewelry.system.enums.UserRole;
import com.jewelry.system.enums.UserStatus;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true, length = 50)
    private String username;
    
    @Column(nullable = false)
    private String password;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserRole role;
    
    @Column(name = "real_name", length = 100)
    private String realName;
    
    @Column(length = 20)
    private String phone;
    
    @Column(length = 100)
    private String email;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserStatus status = UserStatus.ACTIVE;
    
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    // 辅助方法
    public boolean isAdmin() {
        return UserRole.ADMIN.equals(this.role);
    }
    
    public boolean isSalesPre() {
        return UserRole.SALES_PRE.equals(this.role);
    }
    
    public boolean isSalesMid() {
        return UserRole.SALES_MID.equals(this.role);
    }
    
    public boolean isDesigner() {
        return UserRole.DESIGNER.equals(this.role);
    }
    
    public boolean isModeler() {
        return UserRole.MODELER.equals(this.role);
    }
    
    public boolean isFollowUp() {
        return UserRole.FOLLOW_UP.equals(this.role);
    }
    
    public boolean isActive() {
        return UserStatus.ACTIVE.equals(this.status);
    }
}