package com.jewelry.system.service;

import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.entity.Order;
import com.jewelry.system.enums.FileRelatedType;
import com.jewelry.system.repository.FileEntityRepository;
import com.jewelry.system.repository.OrderRepository;
import com.jewelry.system.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderFileServiceAgentAttachTest {

    @Mock
    FileEntityRepository fileEntityRepository;
    @Mock
    FileStorageService fileStorageService;
    @Mock
    AliyunOssService aliyunOssService;
    @Mock
    UserRepository userRepository;
    @Mock
    OrderRepository orderRepository;

    @InjectMocks
    OrderFileService orderFileService;

    @Test
    void attachGuestDesignFromOssUrl_copiesToOrderDesignAndPersists() {
        when(aliyunOssService.isEnabled()).thenReturn(true);
        when(orderRepository.findById(42L)).thenReturn(Optional.of(new Order()));
        when(aliyunOssService.resolveObjectKeyFromUrl("https://bucket.oss-cn-hangzhou.aliyuncs.com/b2b-agent/1/a.jpg"))
                .thenReturn("b2b-agent/1/a.jpg");
        when(aliyunOssService.objectExists("b2b-agent/1/a.jpg")).thenReturn(true);
        when(aliyunOssService.publicUrl(any())).thenAnswer(inv -> "https://bucket.oss-cn-hangzhou.aliyuncs.com/" + inv.getArgument(0));

        orderFileService.attachGuestDesignFromOssUrl(
                42L,
                "https://bucket.oss-cn-hangzhou.aliyuncs.com/b2b-agent/1/a.jpg",
                "Agent 上传参考图");

        verify(aliyunOssService).copyObject(eq("b2b-agent/1/a.jpg"), org.mockito.ArgumentMatchers.startsWith("order/42/design/"));

        ArgumentCaptor<FileEntity> cap = ArgumentCaptor.forClass(FileEntity.class);
        verify(fileEntityRepository).save(cap.capture());
        FileEntity saved = cap.getValue();
        assertThat(saved.getRelatedId()).isEqualTo(42L);
        assertThat(saved.getRelatedType()).isEqualTo(FileRelatedType.ORDER);
        assertThat(saved.getFileType()).isEqualTo("DESIGN");
        assertThat(saved.getUploaderId()).isNull();
        assertThat(saved.getFilePath()).startsWith("order/42/design/");
    }
}
