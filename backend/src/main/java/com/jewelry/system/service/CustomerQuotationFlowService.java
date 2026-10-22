package com.jewelry.system.service;

import com.jewelry.system.dto.order.OrderSystemConfigDto;
import com.jewelry.system.dto.portal.CustomerQuotationOptionsRequest;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.Quotation;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.OrderEventType;
import com.jewelry.system.enums.ServiceType;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.QuotationRepository;
import com.jewelry.system.security.AccountKind;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

/**
 * C 端尾款流程：建模确认 → 售中录入基础费用 → 客户选择增值项 → 锁定报价并推送尾款。
 */
@Service
@RequiredArgsConstructor
public class CustomerQuotationFlowService {

    private final QuotationRepository quotationRepository;
    private final OrderConfigurationService orderConfigurationService;
    private final OrderEventService orderEventService;
    private final OrderPieceService orderPieceService;
    private final OrderRepository orderRepository;

    public boolean isBaseQuotationReady(Quotation quotation) {
        if (quotation == null) {
            return false;
        }
        return sumBaseAmount(quotation).compareTo(BigDecimal.ZERO) > 0;
    }

    public boolean awaitingCustomerOptions(Order order, Quotation quotation) {
        if (order == null || order.getServiceType() == ServiceType.STOREFRONT) {
            return false;
        }
        if (!orderPieceService.allModelConfirmed(order.getId())) {
            return false;
        }
        if (quotation != null && Boolean.TRUE.equals(quotation.getFinalized())) {
            return false;
        }
        return isBaseQuotationReady(quotation);
    }

    public boolean waitingStaffBaseQuote(Order order, Quotation quotation) {
        if (order == null || order.getServiceType() == ServiceType.STOREFRONT) {
            return false;
        }
        if (!orderPieceService.allModelConfirmed(order.getId())) {
            return false;
        }
        if (quotation != null && Boolean.TRUE.equals(quotation.getFinalized())) {
            return false;
        }
        return !isBaseQuotationReady(quotation);
    }

    @Transactional
    public void submitCustomerOptions(long orderId, long accountId, CustomerQuotationOptionsRequest req) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在"));
        if (order.getServiceType() == ServiceType.STOREFRONT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "商城订单不适用此报价流程");
        }
        if (!orderPieceService.allModelConfirmed(orderId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先确认全部建模稿后再选择报价选项");
        }
        Quotation q = quotationRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "售中尚未完成建模后的费用核算，请稍后再试"));
        if (Boolean.TRUE.equals(q.getFinalized())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "报价已确定，无需重复提交");
        }
        if (!isBaseQuotationReady(q)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "售中尚未完成建模后的费用核算，请稍后再试");
        }

        OrderSystemConfigDto cfg = orderConfigurationService.getOrderSystemConfig();
        boolean buyout = Boolean.TRUE.equals(req.getDesignBuyout());
        boolean cert = Boolean.TRUE.equals(req.getAppraisalCertificate());
        boolean confidential = Boolean.TRUE.equals(req.getConfidential());

        BigDecimal buyoutFee = buyout
                ? BigDecimal.valueOf(cfg.getDesignBuyoutPrice()).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal certFee = cert
                ? BigDecimal.valueOf(cfg.getCertificatePrice()).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        q.setHasDesignCopyright(buyout);
        q.setDesignCopyrightFee(buyoutFee);
        q.setHasAppraisalCertificate(cert);
        q.setAppraisalCertificateFee(certFee);
        q.setConfidential(confidential);

        BigDecimal total = sumBaseAmount(q).add(buyoutFee).add(certFee);
        q.setSubtotal(total);
        q.setTotalAmount(total);
        q.setFinalized(true);
        q.setFinalizedTime(LocalDateTime.now());
        quotationRepository.save(q);

        String quoteContent = buildQuoteSummary(q, buyout, cert, confidential);
        User salesMid = order.getSalesMid();
        Long staffId = salesMid != null ? salesMid.getId() : null;
        String staffRole = "SALES_MID";
        if (staffId == null && order.getDesigner() != null) {
            staffId = order.getDesigner().getId();
            staffRole = "DESIGNER";
        }
        if (staffId == null) {
            staffId = 0L;
        }

        orderEventService.record(orderId, OrderEventType.QUOTATION,
                AccountKind.STAFF, staffId, staffRole,
                "最终报价", quoteContent, null, null);

        if (!orderEventService.hasOpenBalancePayment(orderId)) {
            pushBalancePaymentRequest(order, staffId, staffRole, total);
        }
    }

    public BigDecimal resolveBalanceAmount(long orderId) {
        return quotationRepository.findByOrderId(orderId)
                .filter(q -> Boolean.TRUE.equals(q.getFinalized()))
                .map(Quotation::getTotalAmount)
                .orElse(BigDecimal.ZERO);
    }

    private void pushBalancePaymentRequest(Order order, Long staffId, String staffRole, BigDecimal total) {
        String amountText = "¥" + total.setScale(2, RoundingMode.HALF_UP).toPlainString();
        orderEventService.record(order.getId(), OrderEventType.BALANCE_PAYMENT,
                AccountKind.STAFF, staffId, staffRole,
                OrderEventType.BALANCE_PAYMENT.getDescription(),
                "尾款金额：" + amountText, null, null);
    }

    private static BigDecimal sumBaseAmount(Quotation q) {
        return nz(q.getLaborCost())
                .add(nz(q.getAdditionalLaborCost()))
                .add(nz(q.getOtherFees()));
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static String buildQuoteSummary(Quotation q, boolean buyout, boolean cert, boolean confidential) {
        StringBuilder sb = new StringBuilder();
        sb.append("工费及附加工费 ¥").append(sumBaseAmount(q).setScale(2, RoundingMode.HALF_UP).toPlainString());
        if (buyout) {
            sb.append("；设计买断 ¥").append(nz(q.getDesignCopyrightFee()).setScale(2, RoundingMode.HALF_UP).toPlainString());
        }
        if (cert) {
            sb.append("；鉴定证书 ¥").append(nz(q.getAppraisalCertificateFee()).setScale(2, RoundingMode.HALF_UP).toPlainString());
        }
        if (confidential) {
            sb.append("；保密不宣传：是");
        }
        sb.append("；合计 ¥").append(nz(q.getTotalAmount()).setScale(2, RoundingMode.HALF_UP).toPlainString());
        return sb.toString();
    }
}
