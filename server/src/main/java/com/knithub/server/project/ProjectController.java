package com.knithub.server.project;

import com.knithub.server.auth.SessionManager;
import com.knithub.server.project.dto.AddMilestoneRequest;
import com.knithub.server.project.dto.CreateProjectRequest;
import com.knithub.server.project.dto.EditMilestoneRequest;
import com.knithub.server.project.dto.SetMilestoneCompletedRequest;
import com.knithub.server.project.dto.ProjectResponse;
import com.knithub.server.project.dto.UpdateStatusRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    /** FT-02-US-03 AC-1/AC-2：看板拖拽切换状态（4×4 自由互切）。 */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ProjectResponse> changeStatus(
            @CookieValue(value = "sid", required = false) String sid,
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusRequest request) {
        Long userId = requireUserId(sid);
        return ResponseEntity.ok(
                ProjectResponse.from(projectService.changeStatus(userId, id, request.getStatus())));
    }

    /** FT-02-US-04 AC-1：添加里程碑（名称必填、预计日期可选）。 */
    @PostMapping("/{id}/milestones")
    public ResponseEntity<ProjectResponse> addMilestone(
            @CookieValue(value = "sid", required = false) String sid,
            @PathVariable Long id,
            @Valid @RequestBody AddMilestoneRequest request) {
        Long userId = requireUserId(sid);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ProjectResponse.from(
                        projectService.addMilestone(userId, id, request.getName(), request.getDueDate())));
    }

    /** FT-02-US-04 AC-2：编辑里程碑（名称/预计日期）。 */
    @PatchMapping("/{id}/milestones/{milestoneId}")
    public ResponseEntity<ProjectResponse> editMilestone(
            @CookieValue(value = "sid", required = false) String sid,
            @PathVariable Long id,
            @PathVariable Long milestoneId,
            @Valid @RequestBody EditMilestoneRequest request) {
        Long userId = requireUserId(sid);
        return ResponseEntity.ok(ProjectResponse.from(projectService.editMilestone(
                userId, id, milestoneId, request.getName(), request.getDueDate())));
    }

    /** FT-02-US-04 AC-3/AC-6：手动完成 / 取消完成里程碑（双向翻转）。 */
    @PatchMapping("/{id}/milestones/{milestoneId}/completed")
    public ResponseEntity<ProjectResponse> setMilestoneCompleted(
            @CookieValue(value = "sid", required = false) String sid,
            @PathVariable Long id,
            @PathVariable Long milestoneId,
            @Valid @RequestBody SetMilestoneCompletedRequest request) {
        Long userId = requireUserId(sid);
        return ResponseEntity.ok(ProjectResponse.from(projectService.setMilestoneCompleted(
                userId, id, milestoneId, request.getCompleted())));
    }

    /** FT-02-US-04 AC-4：删除里程碑（轻量操作，无二次确认——AskMe 未要求）。 */
    @org.springframework.web.bind.annotation.DeleteMapping("/{id}/milestones/{milestoneId}")
    public ResponseEntity<ProjectResponse> deleteMilestone(
            @CookieValue(value = "sid", required = false) String sid,
            @PathVariable Long id,
            @PathVariable Long milestoneId) {
        Long userId = requireUserId(sid);
        return ResponseEntity.ok(ProjectResponse.from(projectService.deleteMilestone(userId, id, milestoneId)));
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

    /** 项目不归属当前会话用户 → 403（FT-02-US-03 AC-3 越权拒绝）。 */
    @ExceptionHandler(ProjectService.NotProjectOwnerException.class)
    public ResponseEntity<Map<String, String>> handleNotProjectOwner(ProjectService.NotProjectOwnerException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", "无权操作该项目"));
    }

    /** 里程碑不存在 → 404（FT-02-US-04）。 */
    @ExceptionHandler(ProjectService.MilestoneNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleMilestoneNotFound(ProjectService.MilestoneNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", "里程碑不存在"));
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
