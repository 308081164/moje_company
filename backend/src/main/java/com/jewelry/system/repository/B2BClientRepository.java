package com.jewelry.system.repository;

import com.jewelry.system.entity.B2BClient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface B2BClientRepository extends JpaRepository<B2BClient, Long> {
    Optional<B2BClient> findByContact(String contact);
    boolean existsByContact(String contact);

    @Query("""
            SELECT c FROM B2BClient c
            WHERE c.contact = :exact
               OR c.contact = :normalized
               OR REPLACE(REPLACE(REPLACE(c.contact, '+', ''), ' ', ''), '-', '') = :digits
            """)
    Optional<B2BClient> findByContactFlexible(
            @Param("exact") String exact,
            @Param("normalized") String normalized,
            @Param("digits") String digits);
}