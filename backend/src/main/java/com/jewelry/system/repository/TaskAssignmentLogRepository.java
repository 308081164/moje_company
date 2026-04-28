package com.jewelry.system.repository;

import com.jewelry.system.entity.TaskAssignmentLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskAssignmentLogRepository extends JpaRepository<TaskAssignmentLog, Long> {
    
    List<TaskAssignmentLog> findByOrderId(Long orderId);
    
    List<TaskAssignmentLog> findByOrderIdAndTaskType(Long orderId, String taskType);
    
    List<TaskAssignmentLog> findByFromUserId(Long fromUserId);
    
    List<TaskAssignmentLog> findByToUserId(Long toUserId);
}
