package com.knithub.server.domain;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * 里程碑领域实体，内嵌于 Project.milestones 数组（数组序 = 创建顺序）。
 * 存储字段 snake_case。实现于 FT-02-US-01。
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Milestone {

    private Long id;
    private String name;
    private String dueDate;
    private Boolean completed;
    private String createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDueDate() {
        return dueDate;
    }

    public void setDueDate(String dueDate) {
        this.dueDate = dueDate;
    }

    public Boolean getCompleted() {
        return completed;
    }

    public void setCompleted(Boolean completed) {
        this.completed = completed;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}
