package com.jewelry.system.service;

import com.jewelry.system.dto.b2b.B2BOrderAccessDto;
import com.jewelry.system.dto.b2b.B2BOrderCreateRequest;
import com.jewelry.system.dto.order.OrderInfoDto;
import com.jewelry.system.entity.B2BClient;
import com.jewelry.system.entity.Order;
import com.jewelry.system.entity.OrderDetail;
import com.jewelry.system.entity.User;
import com.jewelry.system.enums.OrderSource;
import com.jewelry.system.enums.OrderStatus;
import com.jewelry.system.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
public class B2BOrderService {

    private final OrderRepository orderRepository;
    private final B2BClientRepository clientRepository;
    private final OrderDetailRepository orderDetailRepository;
    private final UserRepository userRepository;
    private final OrderAccessLinkService linkService;
    private final ModelerWorkStatusService modelerWorkStatusService;
    private final WebSocketService webSocketService;
    private final EmailNotificationService emailNotificationService;
    private final OrderQueryService orderQueryService;
    private final PasswordEncoder passwordEncoder;
    private final TaskAssignmentService taskAssignmentService;
    private final WeComCustomerGroupService weComCustomerGroupService;

    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

    @Transactional
    public B2BOrderAccessDto createOrder(B2BOrderCreateRequest req) {
        B2BClient client = null;
        
        if (req.getContact() != null && !req.getContact().isBlank()) {
            client = clientRepository.findByContact(req.getContact()).orElse(null);
            if (client == null && req.getPassword() != null && !req.getPassword().isBlank()) {
                client = registerClient(req);
            } else if (client != null && req.getPassword() != null && !req.getPassword().isBlank()) {
                if (!passwordEncoder.matches(req.getPassword(), client.getPassword())) {
                    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "密码错误");
                }
            }
        }

        if (client == null && (req.getContact() == null || req.getContact().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "联系方式不能为空");
        }

        Order order = new Order();
        order.setIsB2b(true); // 标记为B端订单
        order.setSource(OrderSource.INFLUENCER);
        order.setInfluencerName(req.getSourceDetail());
        order.setDeposit(req.getDepositAmount() != null ? BigDecimal.valueOf(req.getDepositAmount()) : BigDecimal.ZERO);
        order.setBasicRequirements(req.getBasicRequirements());
        order.setStyleInfo(req.getStyleInfo());
        order.setMaterialInfo(req.getMaterialInfo());
        order.setCustomerName(client != null ? client.getCompanyName() : req.getCompanyName());
        order.setCustomerPhone(client != null ? client.getContact() : req.getContact());
        order.setCustomerWechat(client != null ? client.getContact() : req.getContact());
        order.setOrderNumber(generateOrderNumber());
        order.setStatus(OrderStatus.PENDING_MODEL);

        orderRepository.save(order);

        // 使用智能任务分配寻找建模师
        Long modelerId = taskAssignmentService.findSuitableModelerForB2B();
        if (modelerId != null) {
            User modeler = userRepository.getReferenceById(modelerId);
            order.setModeler(modeler);
            order.setStatus(OrderStatus.MODELING);
            order.setAssignedToModelerAt(LocalDateTime.now());
            taskAssignmentService.incrementModelerTodo(modelerId, true);
            webSocketService.notifyNewOrder(modelerId, order.getId(), order.getOrderNumber());
        }

        orderRepository.save(order);

        B2BOrderAccessDto accessDto = linkService.createLink(order.getId(), client != null ? client.getId() : null);
        
        emailNotificationService.sendOrderNotification(order.getOrderNumber(), 
                client != null ? client.getContact() : req.getContact(), "B2B业务");

        Long oid = order.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    weComCustomerGroupService.scheduleAfterOrderCreated(oid);
                }
            });
        } else {
            weComCustomerGroupService.scheduleAfterOrderCreated(oid);
        }

        return accessDto;
    }

    public OrderInfoDto getOrderByToken(String token) {
        Order order = linkService.getOrderEntityByToken(token);
        return orderQueryService.getOrder(order.getId());
    }

    public List<OrderInfoDto> getClientOrders(Long clientId) {
        return orderRepository.findByCustomerPhone(
                clientRepository.findById(clientId)
                        .map(B2BClient::getContact)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "客户不存在"))
        ).stream()
        .map(o -> orderQueryService.getOrder(o.getId()))
        .toList();
    }

    private B2BClient registerClient(B2BOrderCreateRequest req) {
        B2BClient client = new B2BClient();
        client.setContact(req.getContact());
        client.setPassword(passwordEncoder.encode(req.getPassword()));
        client.setCompanyName(req.getCompanyName());
        client.setContactPerson(req.getContactPerson());
        client.setEmail(req.getEmail());
        return clientRepository.save(client);
    }

    private String generateOrderNumber() {
        String prefix = "B2B" + LocalDate.now().format(DAY);
        long n = orderRepository.countByOrderNumberStartingWith(prefix);
        return prefix + String.format("%04d", n + 1);
    }
}