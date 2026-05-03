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
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class B2BClientService {

    private final B2BClientRepository clientRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public B2BClientResponse register(B2BClientRegisterRequest req) {
        if (clientRepository.existsByContact(req.getContact())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该联系方式已注册");
        }
        
        B2BClient client = new B2BClient();
        client.setContact(req.getContact());
        client.setPassword(passwordEncoder.encode(req.getPassword()));
        client.setCompanyName(req.getCompanyName());
        client.setContactPerson(req.getContactPerson());
        client.setEmail(req.getEmail());
        
        clientRepository.save(client);
        return toDto(client);
    }

    public B2BClientLoginResponse login(B2BClientLoginRequest req) {
        B2BClient client = clientRepository.findByContact(req.getContact())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "联系方式或密码错误"));
        
        if (!passwordEncoder.matches(req.getPassword(), client.getPassword())) {
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