package com.knithub.server.project.dto;

import com.knithub.server.domain.Project;

import java.util.List;

/**
 * 项目 API 响应（camelCase，对外契约），里程碑内嵌。
 */
public class ProjectResponse {

    private Long id;
    private String name;
    private String dueDate;
    private String status;
    private boolean isPublic;
    private List<MilestoneResponse> milestones;
    private String createdAt;
    private String lastActiveAt;

    public static ProjectResponse from(Project project) {
        ProjectResponse response = new ProjectResponse();
        response.id = project.getId();
        response.name = project.getName();
        response.dueDate = project.getDueDate();
        response.status = project.getStatus();
        response.isPublic = Boolean.TRUE.equals(project.getPublic());
        response.milestones = project.getMilestones().stream()
                .map(MilestoneResponse::from)
                .toList();
        response.createdAt = project.getCreatedAt();
        response.lastActiveAt = project.getLastActiveAt();
        return response;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDueDate() {
        return dueDate;
    }

    public String getStatus() {
        return status;
    }

    public boolean isPublic() {
        return isPublic;
    }

    public List<MilestoneResponse> getMilestones() {
        return milestones;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public String getLastActiveAt() {
        return lastActiveAt;
    }
}
