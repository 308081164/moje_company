package com.jewelry.system.service;

import com.jewelry.system.dto.LoginRequest;
import com.jewelry.system.dto.LoginResponse;

public interface AuthService {

    LoginResponse login(LoginRequest loginRequest);

    void logout(String token);

    LoginResponse refreshToken(String refreshToken);

    Object getCurrentUser();
}

