package com.jewelry.system.controller;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(MethodArgumentNotValidException ex) {
        List<Map<String, String>> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(this::mapFieldError)
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("status", HttpStatus.BAD_REQUEST.value());
        response.put("error", "Validation Failed");
        response.put("message", "请求参数验证失败");
        response.put("details", errors);

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException ex) {
        List<Map<String, String>> errors = ex.getConstraintViolations()
                .stream()
                .map(this::mapConstraintViolation)
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("status", HttpStatus.BAD_REQUEST.value());
        response.put("error", "Validation Failed");
        response.put("message", "参数约束验证失败");
        response.put("details", errors);

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(ResponseStatusException ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("status", ex.getStatusCode().value());
        response.put("error", ex.getReason());
        response.put("message", ex.getReason());

        return new ResponseEntity<>(response, ex.getStatusCode());
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> handleDataAccessException(DataAccessException ex) {
        String root = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        boolean missingDesignVersionTable = root != null && root.contains("design_info_version");
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", LocalDateTime.now().toString());
        if (missingDesignVersionTable) {
            response.put("status", HttpStatus.SERVICE_UNAVAILABLE.value());
            response.put("error", "Service Unavailable");
            response.put("message", "设计稿版本功能需要数据库迁移 V38，请升级后端并执行 Flyway 迁移后再试");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
        response.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        response.put("error", "Database Error");
        response.put("message", root != null ? root : "数据库操作失败");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        Map<String, Object> response = new HashMap<>();
        response.put("timestamp", LocalDateTime.now().toString());
        response.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        response.put("error", "Internal Server Error");
        response.put("message", ex.getMessage());

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    private Map<String, String> mapFieldError(FieldError error) {
        Map<String, String> errorMap = new HashMap<>();
        errorMap.put("field", error.getField());
        errorMap.put("message", error.getDefaultMessage());
        errorMap.put("rejectedValue", error.getRejectedValue() != null ? error.getRejectedValue().toString() : null);
        return errorMap;
    }

    private Map<String, String> mapConstraintViolation(ConstraintViolation<?> violation) {
        Map<String, String> errorMap = new HashMap<>();
        errorMap.put("field", violation.getPropertyPath().toString());
        errorMap.put("message", violation.getMessage());
        errorMap.put("rejectedValue", violation.getInvalidValue() != null ? violation.getInvalidValue().toString() : null);
        return errorMap;
    }
}
