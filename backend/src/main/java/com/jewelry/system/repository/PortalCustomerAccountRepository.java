package com.jewelry.system.repository;

import com.jewelry.system.entity.PortalCustomerAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PortalCustomerAccountRepository extends JpaRepository<PortalCustomerAccount, Long> {

    boolean existsByContact(String contact);

    Optional<PortalCustomerAccount> findByContact(String contact);
}
