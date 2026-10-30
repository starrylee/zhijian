package com.knithub.server.project.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * FT-02-US-04 添加里程碑请求体：名称必填（AC-5）、预计日期可选（AC-1）。
 */
public class AddMilestoneRequest {

    @NotBlank(message = "里程碑名称必填")
    private String name;

    private String dueDate;

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
}
