package com.jewelry.system.service;

import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.SellerWallet;
import com.jewelry.system.entity.SellerWalletTxn;
import com.jewelry.system.entity.SellerWithdrawRequest;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.SellerWalletRepository;
import com.jewelry.system.repository.SellerWalletTxnRepository;
import com.jewelry.system.repository.SellerWithdrawRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
public class StorefrontWalletService {

    private final SellerWalletRepository walletRepository;
    private final SellerWalletTxnRepository txnRepository;
    private final SellerWithdrawRequestRepository withdrawRepository;
    private final OrderRepository orderRepository;

    @Transactional
    public SellerWallet requireWallet(Long accountId) {
        return walletRepository.findByAccountId(accountId).orElseGet(() -> {
            SellerWallet w = new SellerWallet();
            w.setAccountId(accountId);
            w.setAvailableBalance(BigDecimal.ZERO);
            w.setPendingBalance(BigDecimal.ZERO);
            w.setTotalEarned(BigDecimal.ZERO);
            w.setTotalWithdrawn(BigDecimal.ZERO);
            return walletRepository.save(w);
        });
    }

    @Transactional
    public void holdPayout(Order order) {
        if (order.getMarketplaceSellerId() == null || order.getSellerPayout() == null) {
            return;
        }
        if (txnRepository.findFirstByOrderIdAndType(order.getId(), "HOLD").isPresent()) {
            return;
        }
        BigDecimal amount = order.getSellerPayout();
        SellerWallet w = requireWallet(order.getMarketplaceSellerId());
        w.setPendingBalance(nz(w.getPendingBalance()).add(amount));
        walletRepository.save(w);
        saveTxn(order.getMarketplaceSellerId(), order.getId(), order.getListingId(), "HOLD", amount,
                "寄售订单待结算：" + order.getOrderNumber());
    }

    @Transactional
    public void settleOnCompleted(long orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null || order.getMarketplaceSellerId() == null || order.getSellerPayout() == null) {
            return;
        }
        if (txnRepository.findFirstByOrderIdAndType(orderId, "SETTLE").isPresent()) {
            return;
        }
        BigDecimal amount = order.getSellerPayout();
        SellerWallet w = requireWallet(order.getMarketplaceSellerId());
        BigDecimal pending = nz(w.getPendingBalance());
        if (pending.compareTo(amount) >= 0) {
            w.setPendingBalance(pending.subtract(amount));
        } else {
            w.setPendingBalance(BigDecimal.ZERO);
        }
        w.setAvailableBalance(nz(w.getAvailableBalance()).add(amount));
        w.setTotalEarned(nz(w.getTotalEarned()).add(amount));
        walletRepository.save(w);
        saveTxn(order.getMarketplaceSellerId(), orderId, order.getListingId(), "SETTLE", amount,
                "订单完成，可提现：" + order.getOrderNumber());
    }

    @Transactional
    public SellerWithdrawRequest withdraw(Long accountId, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "提现金额必须大于 0");
        }
        SellerWallet w = requireWallet(accountId);
        if (nz(w.getAvailableBalance()).compareTo(amount) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "可提现余额不足");
        }
        w.setAvailableBalance(w.getAvailableBalance().subtract(amount));
        w.setTotalWithdrawn(nz(w.getTotalWithdrawn()).add(amount));
        walletRepository.save(w);

        SellerWithdrawRequest req = new SellerWithdrawRequest();
        req.setAccountId(accountId);
        req.setAmount(amount);
        req.setStatus("PAID");
        req.setRemark("模拟提现已到账");
        withdrawRepository.save(req);
        saveTxn(accountId, null, null, "WITHDRAW", amount.negate(), "提现（模拟即时到账）");
        return req;
    }

    private void saveTxn(Long accountId, Long orderId, Long listingId, String type, BigDecimal amount, String remark) {
        SellerWalletTxn t = new SellerWalletTxn();
        t.setAccountId(accountId);
        t.setOrderId(orderId);
        t.setListingId(listingId);
        t.setType(type);
        t.setAmount(amount);
        t.setRemark(remark);
        txnRepository.save(t);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
