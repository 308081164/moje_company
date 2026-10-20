package com.jewelry.system.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jewelry.system.dto.order.OrderDesignUpdateRequest;
import com.jewelry.system.entity.DesignInfoVersion;
import com.jewelry.system.entity.OrderPiece;
import com.jewelry.system.repository.DesignInfoRepository;
import com.jewelry.system.repository.DesignInfoVersionRepository;
import com.jewelry.system.repository.OrderDetailRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DesignVersionServiceTest {

    @Mock
    private DesignInfoVersionRepository versionRepository;
    @Mock
    private DesignInfoRepository designInfoRepository;
    @Mock
    private OrderDetailRepository orderDetailRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private OrderPieceService orderPieceService;

    private DesignVersionService designVersionService;

    @BeforeEach
    void setUp() {
        designVersionService = new DesignVersionService(
                versionRepository,
                designInfoRepository,
                orderDetailRepository,
                orderRepository,
                userRepository,
                orderPieceService,
                new ObjectMapper());
    }

    @Test
    void createVersionSnapshotIncrementsVersionNo() {
        OrderPiece piece = new OrderPiece();
        piece.setId(10L);
        piece.setOrderId(1L);
        piece.setName("男戒");

        DesignInfoVersion v1 = new DesignInfoVersion();
        v1.setVersionNo(2);
        when(versionRepository.findByPieceIdOrderByVersionNoDesc(10L)).thenReturn(List.of(v1));
        when(versionRepository.save(any())).thenAnswer(inv -> {
            DesignInfoVersion v = inv.getArgument(0);
            v.setId(99L);
            return v;
        });

        OrderDesignUpdateRequest req = new OrderDesignUpdateRequest();
        req.setDesignNotes("note");
        designVersionService.createVersionSnapshot(1L, piece, req, false, "修订");

        ArgumentCaptor<DesignInfoVersion> cap = ArgumentCaptor.forClass(DesignInfoVersion.class);
        verify(versionRepository).save(cap.capture());
        assertEquals(3, cap.getValue().getVersionNo());
        assertEquals("修订", cap.getValue().getLabel());
    }
}
