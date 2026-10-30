package com.knithub.server.project.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.util.ArrayList;
import java.util.List;

/**
 * 创建项目请求体（camelCase API 契约，与 FT-01 DTO 约定一致）。
 * 名称必填、预计完成日期必填（AC-3）、里程碑可选（AC-2）。
 */
public class CreateProjectRequest {

    @NotBlank(message = "请填写项目名称")
    private String name;

    @NotBlank(message = "请选择预计完成日期")
    private String dueDate;

    @Valid
    private List<MilestoneRequest> milestones = new ArrayList<>();

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

    public List<MilestoneRequest> getMilestones() {
        return milestones;
    }

    public void setMilestones(List<MilestoneRequest> milestones) {
        this.milestones = milestones;
    }

    /** 里程碑条目：名称必填（AC-4）、预计日期可选（AC-2）。 */
    public static class MilestoneRequest {

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
}
