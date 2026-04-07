package com.jewelry.system.repository;

import com.jewelry.system.entity.MaterialConfigEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MaterialConfigRepository extends JpaRepository<MaterialConfigEntry, Long> {

    Optional<MaterialConfigEntry> findByMaterialCode(String materialCode);
}
