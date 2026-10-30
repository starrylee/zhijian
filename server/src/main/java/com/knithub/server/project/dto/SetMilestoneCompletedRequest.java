package com.knithub.server.project.dto;

import jakarta.validation.constraints.NotNull;

/**
 * FT-02-US-04 手动完成/取消完成里程碑请求体（AC-3 / AC-6 双向翻转）。
 */
public class SetMilestoneCompletedRequest {

    @NotNull(message = "completed 不能为空")
    private Boolean completed;

    public Boolean getCompleted() {
        return completed;
    }

    public void setCompleted(Boolean completed) {
        this.completed = completed;
    }
}
