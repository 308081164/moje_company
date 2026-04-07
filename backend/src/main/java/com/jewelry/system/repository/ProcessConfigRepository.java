package com.jewelry.system.repository;

import com.jewelry.system.entity.ProcessConfigEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessConfigRepository extends JpaRepository<ProcessConfigEntry, Long> {
}
