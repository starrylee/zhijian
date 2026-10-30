package com.knithub.server.project;

import com.knithub.server.auth.SessionManager;
import com.knithub.server.project.dto.CreateProjectRequest;
import com.knithub.server.project.dto.ProjectResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.util.List;
import java.util.Map;

/**
 * 项目域接口层（REST /api/v1/projects）。写操作须登录（sid Cookie）。
 * 实现于 FT-02-US-01（create + 本人列表）。
 */
@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final SessionManager sessionManager;

    public ProjectController(ProjectService projectService, SessionManager sessionManager) {
        this.projectService = projectService;
        this.sessionManager = sessionManager;
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> create(
            @CookieValue(value = "sid", required = false) String sid,
            @Valid @RequestBody CreateProjectRequest request) {
        Long userId = requireUserId(sid);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ProjectResponse.from(projectService.create(userId, request)));
    }

    @GetMapping
    public ResponseEntity<List<ProjectResponse>> list(
            @CookieValue(value = "sid", required = false) String sid) {
        Long userId = requireUserId(sid);
        return ResponseEntity.ok(projectService.listByUser(userId).stream()
                .map(ProjectResponse::from)
                .toList());
    }

    private Long requireUserId(String sid) {
        return sessionManager.getUserId(sid)
                .orElseThrow(NotLoggedInException::new);
    }

    /** 未登录 → 401（FT-02-US-01 AC-5）。 */
    static class NotLoggedInException extends RuntimeException {
    }

    @ExceptionHandler(NotLoggedInException.class)
    public ResponseEntity<Map<String, String>> handleNotLoggedIn(NotLoggedInException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", "请先登录"));
    }

    /** 请求参数校验失败 → 400 + 第一条校验消息（AC-3/AC-4，与 FT-01 约定一致）。 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(org.springframework.validation.FieldError::getDefaultMessage)
                .orElse("请求参数不合法");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", message));
    }
}
