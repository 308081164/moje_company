package com.jewelry.system.service;

import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.OrderStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public final class OrderSpecifications {

    private OrderSpecifications() {
    }

    public static Specification<Order> build(
            String keyword,
            String status,
            Long designerId,
            Long modelerId,
            Long salesId,
            String startDate,
            String endDate
    ) {
        return (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (keyword != null && !keyword.isBlank()) {
                String k = "%" + keyword.trim() + "%";
                ps.add(cb.or(
                        cb.like(root.get("orderNumber"), k),
                        cb.like(root.get("customerName"), k),
                        cb.like(root.get("customerPhone"), k),
                        cb.like(root.get("customerWechat"), k)
                ));
            }
            if (status != null && !status.isBlank()) {
                try {
                    ps.add(cb.equal(root.get("status"), OrderStatus.fromString(status.trim())));
                } catch (IllegalArgumentException ignored) {
                    // 忽略无效状态，避免整页无结果
                }
            }
            if (designerId != null) {
                Join<Order, User> j = root.join("designer", JoinType.INNER);
                ps.add(cb.equal(j.get("id"), designerId));
            }
            if (modelerId != null) {
                Join<Order, User> j = root.join("modeler", JoinType.INNER);
                ps.add(cb.equal(j.get("id"), modelerId));
            }
            if (salesId != null) {
                Join<Order, User> j = root.join("salesMid", JoinType.INNER);
                ps.add(cb.equal(j.get("id"), salesId));
            }
            LocalDateTime start = parseStart(startDate);
            LocalDateTime end = parseEnd(endDate);
            if (start != null && end != null) {
                ps.add(cb.between(root.get("createdAt"), start, end));
            } else if (start != null) {
                ps.add(cb.greaterThanOrEqualTo(root.get("createdAt"), start));
            } else if (end != null) {
                ps.add(cb.lessThanOrEqualTo(root.get("createdAt"), end));
            }
            if (ps.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
    }

    private static LocalDateTime parseStart(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        if (s.length() <= 10) {
            return LocalDate.parse(s.trim()).atStartOfDay();
        }
        return LocalDateTime.parse(s.trim());
    }

    private static LocalDateTime parseEnd(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        if (s.length() <= 10) {
            return LocalDate.parse(s.trim()).atTime(23, 59, 59);
        }
        return LocalDateTime.parse(s.trim());
    }
}
