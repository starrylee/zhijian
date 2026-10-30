package com.knithub.server.project.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.knithub.server.domain.Milestone;

/**
 * 里程碑 API 响应（camelCase，对外契约）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MilestoneResponse {

    private Long id;
    private String name;
    private String dueDate;
    private boolean completed;
    private String createdAt;

    public static MilestoneResponse from(Milestone milestone) {
        MilestoneResponse response = new MilestoneResponse();
        response.id = milestone.getId();
        response.name = milestone.getName();
        response.dueDate = milestone.getDueDate();
        response.completed = Boolean.TRUE.equals(milestone.getCompleted());
        response.createdAt = milestone.getCreatedAt();
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

    public boolean isCompleted() {
        return completed;
    }

    public String getCreatedAt() {
        return createdAt;
    }
}
