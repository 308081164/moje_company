package com.jewelry.system.service;

import com.jewelry.system.entity.OperationLog;
import com.jewelry.system.repository.OperationLogRepository;
import com.jewelry.system.security.SecurityUserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final OperationLogRepository operationLogRepository;
    private final HttpServletRequest request;

    public void log(String type, String target, Long targetId, String details) {
        OperationLog log = new OperationLog();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof SecurityUserPrincipal p) {
            log.setUserId(p.getUserId());
            log.setUsername(p.getUsername());
        }
        log.setOperationType(type);
        log.setOperationTarget(target);
        log.setTargetId(targetId);
        log.setOperationDetails(details);
        String ip = request.getRemoteAddr();
        log.setIpAddress(ip);
        String ua = request.getHeader("User-Agent");
        log.setUserAgent(ua);
        operationLogRepository.save(log);
    }
}

