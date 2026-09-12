package com.knithub.server;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 健康检查端点：{@code GET /api/health}。
 *
 * <p>README「环境检查清单」第 6 条依赖此接口验证后端是否已启动；
 * 返回 200 即代表服务存活（进程级探活，不依赖数据文件）。
 */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
