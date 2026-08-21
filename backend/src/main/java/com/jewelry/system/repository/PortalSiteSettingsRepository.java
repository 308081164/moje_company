package com.jewelry.system.repository;

import com.jewelry.system.entity.PortalSiteSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PortalSiteSettingsRepository extends JpaRepository<PortalSiteSettings, Long> {

    Optional<PortalSiteSettings> findByScope(String scope);
}
