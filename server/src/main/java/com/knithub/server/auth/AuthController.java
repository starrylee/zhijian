package com.knithub.server.auth;

import com.knithub.server.auth.dto.LoginRequest;
import com.knithub.server.auth.dto.RegisterRequest;
import com.knithub.server.auth.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

/**
 * 鉴权接口层（REST /api/v1 前缀，技术方案第 2 节）。
 *
 * <p>FT-01-US-02 交付：{@code POST /api/v1/auth/login}——成功 200 +
 * UserResponse（camelCase）+ HttpOnly Cookie {@code sid}；凭据错误 401 +
 * 统一提示「用户名或密码错误」（不区分具体哪项错误，防用户名枚举，AC-2）。
 *
 * <p>后续端点随对应 US 交付：register（US-01）、me（US-03）、logout（US-04）。
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    /** Cookie {@code sid} 的 Max-Age：7 天（技术方案 3.5；会话本身无显式过期，决策 2）。 */
    static final Duration SESSION_COOKIE_MAX_AGE = Duration.ofDays(7);

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthService.LoginResult result = authService.login(request.getUsername(), request.getPassword());
        ResponseCookie cookie = ResponseCookie.from("sid", result.sid())
                .httpOnly(true)
                .sameSite("Lax")
                .maxAge(SESSION_COOKIE_MAX_AGE)
                .path("/")
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(UserResponse.from(result.user()));
    }

    /**
     * 凭据错误 → 401 + 统一提示（AC-2：用户名不存在与密码错误返回完全一致的响应）。
     */
    /**
     * 会话恢复查询（FT-01-US-03-M01）：页面加载时前端凭 Cookie sid 查当前用户。
     *
     * <p>无有效会话返回 401——未登录是正常态（游客态），前端静默处理、
     * 不向用户报错（AC-4）。
     */
    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@CookieValue(value = "sid", required = false) String sid) {
        return authService.me(sid)
                .map(user -> ResponseEntity.ok().body(UserResponse.from(user)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    /**
     * 注册并直接进入登录态（FT-01-US-01 AC-1）——成功 201 + UserResponse +
     * HttpOnly Cookie sid，无需再走登录流程。
     */
    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthService.LoginResult result = authService.register(request.getUsername(), request.getPassword());
        ResponseCookie cookie = ResponseCookie.from("sid", result.sid())
                .httpOnly(true)
                .sameSite("Lax")
                .maxAge(SESSION_COOKIE_MAX_AGE)
                .path("/")
                .build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(UserResponse.from(result.user()));
    }

    @ExceptionHandler(AuthService.InvalidCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleInvalidCredentials(AuthService.InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", "用户名或密码错误"));
    }

    /**
     * 用户名已被占用 → 409 + 明确提示（FT-01-US-01 AC-2）。
     */
    @ExceptionHandler(AuthService.UsernameTakenException.class)
    public ResponseEntity<Map<String, String>> handleUsernameTaken(AuthService.UsernameTakenException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", "用户名已被占用"));
    }

    /**
     * 请求参数校验失败 → 400 + 第一条校验消息（FT-01-US-01 AC-3：密码长度提示）。
     */
    @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(
            org.springframework.web.bind.MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(org.springframework.validation.FieldError::getDefaultMessage)
                .orElse("请求参数不合法");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", message));
    }

    // TODO FT-01-US-01: POST /api/v1/auth/register（注册；重复用户名 → 409）
    // TODO FT-01-US-03: GET /api/v1/auth/me（会话恢复，刷新不掉登录态）
    // TODO FT-01-US-04: POST /api/v1/auth/logout（登出销毁会话）
}
