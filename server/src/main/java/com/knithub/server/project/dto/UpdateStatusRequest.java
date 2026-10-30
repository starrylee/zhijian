package com.knithub.server.project.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * FT-02-US-03 状态切换请求体。
 */
public class UpdateStatusRequest {

    @NotBlank(message = "请选择目标状态")
    private String status;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
