package com.moje.jewelry3d;

import com.moje.jewelry3d.common.BusinessException;
import com.moje.jewelry3d.common.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Spring Boot 启动类
 * 3D AIGC 珠宝设计业务服务入口
 * 服务端口: 8854
 */
@Slf4j
@SpringBootApplication
@RestControllerAdvice
@EnableScheduling
public class Jewelry3dApplication {

    public static void main(String[] args) {
        SpringApplication.run(Jewelry3dApplication.class, args);
        log.info("========================================");
        log.info("  Jewelry3D Business Service 启动成功!");
        log.info("  访问地址: http://localhost:8854");
        log.info("  API文档: http://localhost:8854/api/system/info");
        log.info("========================================");
    }

    /**
     * 全局业务异常处理
     */
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusinessException(BusinessException e) {
        log.warn("业务异常: {}", e.getMessage());
        return Result.error(e.getCode(), e.getMessage());
    }

    /**
     * 全局未知异常处理
     */
    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        log.error("系统异常", e);
        return Result.error(500, "系统内部错误: " + e.getMessage());
    }
}
