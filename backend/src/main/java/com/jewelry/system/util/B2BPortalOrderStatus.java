package com.jewelry.system.util;

import com.jewelry.system.enums.OrderStatus;

/**
 * B 端门户顾客视角：合并设计阶段为「建模中」，建模打回为「需要操作」，建模完成后为「已完成」。
 */
public final class B2BPortalOrderStatus {

    public static final String BUCKET_MODELING = "MODELING";
    public static final String BUCKET_ACTION = "ACTION";
    public static final String BUCKET_DONE = "DONE";
    public static final String BUCKET_CANCELLED = "CANCELLED";

    private B2BPortalOrderStatus() {
    }

    public static String bucket(OrderStatus s) {
        if (s == null) {
            return BUCKET_MODELING;
        }
        return switch (s) {
            case CANCELLED -> BUCKET_CANCELLED;
            case MODELING -> BUCKET_ACTION;
            case PENDING_REVIEW, PENDING_PRODUCTION, PRODUCING, COMPLETED -> BUCKET_DONE;
            case PENDING_DESIGN, DESIGNING, PENDING_MODEL -> BUCKET_MODELING;
        };
    }

    public static String labelZh(OrderStatus s) {
        String b = bucket(s);
        if (BUCKET_CANCELLED.equals(b)) {
            return "已取消";
        }
        if (BUCKET_ACTION.equals(b)) {
            return "需要操作";
        }
        if (BUCKET_DONE.equals(b)) {
            return "已完成";
        }
        return "建模中";
    }
}
