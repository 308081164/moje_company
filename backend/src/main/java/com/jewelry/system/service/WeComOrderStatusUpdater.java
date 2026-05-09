package com.jewelry.system.service;

import com.jewelry.system.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WeComOrderStatusUpdater {

    private final OrderRepository orderRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveSuccess(Long orderId, String configId, String qrBase64) {
        orderRepository.findById(orderId).ifPresent(o -> {
            o.setWecomJoinConfigId(configId);
            o.setWecomJoinQrBase64(qrBase64);
            o.setWecomJoinError(null);
            orderRepository.save(o);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveFailure(Long orderId, String err) {
        String msg = err != null && err.length() > 900 ? err.substring(0, 900) : err;
        orderRepository.findById(orderId).ifPresent(o -> {
            o.setWecomJoinError(msg);
            orderRepository.save(o);
        });
    }
}
