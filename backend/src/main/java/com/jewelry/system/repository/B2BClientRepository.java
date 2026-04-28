package com.jewelry.system.repository;

import com.jewelry.system.entity.B2BClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface B2BClientRepository extends JpaRepository<B2BClient, Long> {
    Optional<B2BClient> findByContact(String contact);
    boolean existsByContact(String contact);
}