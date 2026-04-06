package com.jewelry.system;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class JewelrySystemApplication {
    public static void main(String[] args) {
        SpringApplication.run(JewelrySystemApplication.class, args);
    }
}