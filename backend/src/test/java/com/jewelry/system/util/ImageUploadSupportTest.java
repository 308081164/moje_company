package com.jewelry.system.util;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class ImageUploadSupportTest {

    @Test
    void convertsBmpToPng() throws Exception {
        BufferedImage img = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream bmpOut = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(img, "bmp", bmpOut));

        MockMultipartFile bmp = new MockMultipartFile("file", "ring.bmp", "image/bmp", bmpOut.toByteArray());
        ImageUploadSupport.NormalizedUpload normalized = ImageUploadSupport.normalizeRasterUpload(bmp);

        assertTrue(normalized.convertedFromBmp());
        assertEquals("image/png", normalized.file().getContentType());
        assertTrue(normalized.file().getOriginalFilename().endsWith(".png"));
        assertTrue(normalized.file().getSize() > 0);
    }

    @Test
    void passesThroughPng() throws Exception {
        BufferedImage img = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream pngOut = new ByteArrayOutputStream();
        assertTrue(ImageIO.write(img, "png", pngOut));

        MockMultipartFile png = new MockMultipartFile("file", "ring.png", "image/png", pngOut.toByteArray());
        ImageUploadSupport.NormalizedUpload normalized = ImageUploadSupport.normalizeRasterUpload(png);

        assertFalse(normalized.convertedFromBmp());
        assertSame(png, normalized.file());
    }

    @Test
    void resolveMimeTypeFromBmpExtension() {
        MockMultipartFile file = new MockMultipartFile("file", "a.bmp", "application/octet-stream", new byte[]{1});
        assertEquals("image/bmp", ImageUploadSupport.resolveImageMimeType(file));
    }
}
