package com.jewelry.system.service;

import com.jewelry.system.entity.Order;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.enums.ServiceType;
import com.jewelry.system.enums.WorkspaceBannerPhase;
import org.springframework.stereotype.Service;

/**
 * 解析订单 Workspace 顶部提示条应展示的阶段。
 */
@Service
public class WorkspaceBannerService {

    public static boolean requiresCustomerBrief(Order order) {
        if (order == null || order.getSource() != OrderSource.C2C) {
            return false;
        }
        ServiceType st = order.getServiceType();
        return st == ServiceType.DESIGNER_DESIGN || st == ServiceType.CUSTOM_IMAGE;
    }

    public WorkspaceBannerPhase resolve(Order order, boolean briefSubmitted) {
        if (order == null || order.getStatus() == null) {
            return WorkspaceBannerPhase.NONE;
        }
        OrderStatus status = order.getStatus();
        if (status == OrderStatus.CANCELLED || status == OrderStatus.COMPLETED) {
            return WorkspaceBannerPhase.NONE;
        }
        if (requiresCustomerBrief(order) && !briefSubmitted) {
            return WorkspaceBannerPhase.NEED_BRIEF;
        }
        if (status == OrderStatus.PENDING_PRODUCTION || status == OrderStatus.PRODUCING) {
            return WorkspaceBannerPhase.PRODUCING;
        }
        if (status == OrderStatus.MODELING || status == OrderStatus.PENDING_REVIEW) {
            return WorkspaceBannerPhase.MODELING;
        }
        if (status == OrderStatus.DESIGNING || status == OrderStatus.PENDING_DESIGN_REVIEW) {
            return WorkspaceBannerPhase.DESIGNING;
        }
        if (status == OrderStatus.PENDING_MODEL && order.getModeler() != null) {
            return WorkspaceBannerPhase.MODELING;
        }
        if (status == OrderStatus.PENDING_DESIGN && order.getDesigner() != null) {
            return WorkspaceBannerPhase.DESIGNING;
        }
        if (status == OrderStatus.PENDING_DESIGN && order.getDesigner() == null) {
            return WorkspaceBannerPhase.QUEUED;
        }
        if (status == OrderStatus.PENDING_MODEL && order.getModeler() == null) {
            return WorkspaceBannerPhase.QUEUED;
        }
        return WorkspaceBannerPhase.NONE;
    }
}
