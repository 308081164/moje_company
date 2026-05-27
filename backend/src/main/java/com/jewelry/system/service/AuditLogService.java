package com.jewelry.system.service;

import com.jewelry.system.entity.OperationLog;
import com.jewelry.system.repository.OperationLogRepository;
import com.jewelry.system.security.SecurityUserPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final OperationLogRepository operationLogRepository;

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
        populateRequestMeta(log);
        operationLogRepository.save(log);
    }

    private void populateRequestMeta(OperationLog log) {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (!(attrs instanceof ServletRequestAttributes servletAttrs)) {
            return;
        }
        HttpServletRequest request = servletAttrs.getRequest();
        log.setIpAddress(request.getRemoteAddr());
        log.setUserAgent(request.getHeader("User-Agent"));
    }
}
