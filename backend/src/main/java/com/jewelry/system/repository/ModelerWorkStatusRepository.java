package com.jewelry.system.repository;

import com.jewelry.system.entity.ModelerWorkStatus;
import com.jewelry.system.entity.ModelerWorkStatus.WorkMode;
import com.jewelry.system.entity.ModelerWorkStatus.WorkStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ModelerWorkStatusRepository extends JpaRepository<ModelerWorkStatus, Long> {
    Optional<ModelerWorkStatus> findByUserId(Long userId);
    
    @Query("SELECT m FROM ModelerWorkStatus m WHERE m.status = :status AND m.workMode != :excludeMode")
    List<ModelerWorkStatus> findAvailableModelers(@Param("status") WorkStatus status, @Param("excludeMode") WorkMode excludeMode);
    
    @Query("SELECT m FROM ModelerWorkStatus m WHERE m.status = 'AVAILABLE'")
    List<ModelerWorkStatus> findAllAvailable();
    
    @Query("SELECT m FROM ModelerWorkStatus m WHERE m.workMode IN ('AUTO', 'B2B_ONLY') AND m.status = 'AVAILABLE'")
    List<ModelerWorkStatus> findB2BAvailable();
    
    @Query("SELECT m FROM ModelerWorkStatus m WHERE m.workMode IN ('AUTO', 'C2C_ONLY') AND m.status = 'AVAILABLE'")
    List<ModelerWorkStatus> findC2CAvailable();
    
    @Modifying
    @Query("UPDATE ModelerWorkStatus m SET m.todoCount = m.todoCount + 1 WHERE m.userId = :userId")
    void incrementTodoCount(@Param("userId") Long userId);
    
    @Modifying
    @Query("UPDATE ModelerWorkStatus m SET m.todoCount = m.todoCount - 1 WHERE m.userId = :userId AND m.todoCount > 0")
    void decrementTodoCount(@Param("userId") Long userId);
}