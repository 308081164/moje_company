package com.jewelry.system.service;

import com.jewelry.system.dto.b2b.*;
import com.jewelry.system.entity.B2BClient;
import com.jewelry.system.repository.B2BClientRepository;
import com.jewelry.system.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class B2BClientService {

    private final B2BClientRepository clientRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public B2BClientLoginResponse register(B2BClientRegisterRequest req) {
        if (!StringUtils.hasText(req.getContact()) || !StringUtils.hasText(req.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "联系方式与密码不能为空");
        }
        String contact = normalizeContact(req.getContact());
        if (clientRepository.existsByContact(contact)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该联系方式已注册");
        }

        B2BClient client = new B2BClient();
        client.setContact(contact);
        client.setPassword(passwordEncoder.encode(req.getPassword()));
        client.setCompanyName(req.getCompanyName());
        client.setContactPerson(req.getContactPerson());
        client.setEmail(req.getEmail());

        clientRepository.save(client);

        B2BClientLoginRequest loginReq = new B2BClientLoginRequest();
        loginReq.setContact(contact);
        loginReq.setPassword(req.getPassword());
        return login(loginReq);
    }

    @Transactional
    public B2BClientLoginResponse login(B2BClientLoginRequest req) {
        if (!StringUtils.hasText(req.getContact()) || !StringUtils.hasText(req.getPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "联系方式与密码不能为空");
        }
        String rawContact = req.getContact().trim();
        String normalized = normalizeContact(rawContact);
        String digits = digitsOnly(normalized);
        B2BClient client = clientRepository.findByContactFlexible(rawContact, normalized, digits)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "联系方式或密码错误"));

        if (!verifyPassword(req.getPassword(), client)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "联系方式或密码错误");
        }

        if (B2BClient.ClientStatus.INACTIVE.equals(client.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "账号已禁用");
        }

        B2BClientLoginResponse response = new B2BClientLoginResponse();
        response.setId(client.getId());
        response.setContact(client.getContact());
        response.setCompanyName(client.getCompanyName());
        response.setContactPerson(client.getContactPerson());
        response.setEmail(client.getEmail());
        response.setCreatedAt(client.getCreatedAt());
        response.setAccessToken(jwtTokenProvider.createB2BAccessToken(client.getId(), client.getContact()));
        response.setExpiresIn(jwtTokenProvider.getAccessExpirationSeconds());

        return response;
    }

    public B2BClientResponse getByContact(String contact) {
        B2BClient client = clientRepository.findByContact(contact)
                .orElse(null);
        return client != null ? toDto(client) : null;
    }

    public B2BClient findByContact(String contact) {
        return clientRepository.findByContact(contact).orElse(null);
    }

    private boolean verifyPassword(String rawPassword, B2BClient client) {
        String stored = client.getPassword();
        if (passwordEncoder.matches(rawPassword, stored)) {
            return true;
        }
        // 兼容历史明文密码（导入或未加密数据），验证通过后自动升级为 BCrypt
        if (stored != null && !stored.startsWith("$2") && stored.equals(rawPassword)) {
            client.setPassword(passwordEncoder.encode(rawPassword));
            clientRepository.save(client);
            return true;
        }
        return false;
    }

    /** 手机号统一为 11 位数字；其他联系方式仅 trim */
    static String normalizeContact(String contact) {
        if (!StringUtils.hasText(contact)) {
            return "";
        }
        String trimmed = contact.trim();
        String digits = digitsOnly(trimmed);
        if (digits.length() >= 11) {
            if (digits.startsWith("86") && digits.length() > 11) {
                return digits.substring(digits.length() - 11);
            }
            if (digits.length() == 11) {
                return digits;
            }
        }
        return trimmed;
    }

    private static String digitsOnly(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("\\D", "");
    }

    private B2BClientResponse toDto(B2BClient client) {
        B2BClientResponse dto = new B2BClientResponse();
        dto.setId(client.getId());
        dto.setContact(client.getContact());
        dto.setCompanyName(client.getCompanyName());
        dto.setContactPerson(client.getContactPerson());
        dto.setEmail(client.getEmail());
        dto.setCreatedAt(client.getCreatedAt());
        return dto;
    }
}
