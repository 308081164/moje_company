package com.jewelry.system.service;

import com.jewelry.system.entity.FileEntity;
import com.jewelry.system.enums.FileRelatedType;
import com.jewelry.system.repository.FileEntityRepository;
import com.jewelry.system.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderFileServiceGuestUploadTest {

    @Mock
    FileEntityRepository fileEntityRepository;
    @Mock
    FileStorageService fileStorageService;
    @Mock
    AliyunOssService aliyunOssService;
    @Mock
    UserRepository userRepository;

    @InjectMocks
    OrderFileService orderFileService;

    @Test
    void uploadDesignFileForGuest_persistsNullUploader() throws Exception {
        when(aliyunOssService.isEnabled()).thenReturn(true);
        when(aliyunOssService.uploadObject(any(), any())).thenReturn("https://oss.example/bucket/x.png");
        var file = new MockMultipartFile("files", "a.png", "image/png", new byte[]{1, 2, 3});

        orderFileService.uploadDesignFileForGuest(99L, file, "B端客户上传");

        ArgumentCaptor<FileEntity> cap = ArgumentCaptor.forClass(FileEntity.class);
        verify(fileEntityRepository).save(cap.capture());
        assertThat(cap.getValue().getUploaderId()).isNull();
        assertThat(cap.getValue().getRelatedId()).isEqualTo(99L);
        assertThat(cap.getValue().getRelatedType()).isEqualTo(FileRelatedType.ORDER);
    }
}
