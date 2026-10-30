package com.knithub.server.project;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.knithub.server.domain.User;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.file.Path;
import java.util.List;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FT-02-US-03 项目状态四栏切换集成测试（MockMvc + @TempDir 隔离存储）。
 *
 * <p>覆盖 AC：4×4 完全自由互切（AC-2）、越权切换被拒绝（AC-3）。
 */
@SpringBootTest
@AutoConfigureMockMvc
class ProjectStatusSwitchIntegrationTest {

    @TempDir
    static Path dataDir;

    @DynamicPropertySource
    static void overrideDataDir(DynamicPropertyRegistry registry) {
        registry.add("app.data-dir", () -> dataDir.toAbsolutePath().toString());
    }

    @Autowired
    private MockMvc mockMvc;

    @BeforeAll
    static void seedUsers() throws Exception {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        User iris = new User();
        iris.setId(10L);
        iris.setUsername("iris");
        iris.setPasswordHash(encoder.encode("knit123"));
        iris.setDisplayName("Iris");
        iris.setAvatar("https://example.com/iris.png");
        iris.setCreatedAt("2026-01-01T00:00:00Z");
        User luna = new User();
        luna.setId(20L);
        luna.setUsername("luna");
        luna.setPasswordHash(encoder.encode("knit456"));
        luna.setDisplayName("Luna");
        luna.setAvatar("https://example.com/luna.png");
        luna.setCreatedAt("2026-01-01T00:00:00Z");
        new ObjectMapper().writeValue(dataDir.resolve("users.json").toFile(), List.of(iris, luna));
    }

    @BeforeEach
    void resetProjects() throws Exception {
        java.nio.file.Files.writeString(dataDir.resolve("projects.json"), "[]");
    }

    /** AC-2 示例 1："圣诞袜"已完成 → 待开始（重开成功，无弹窗/方向阻断），再查仍为待开始。 */
    @Test
    void reopenCompletedProjectToTodo() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "圣诞袜");

        patchStatus(sid, projectId, "completed");
        patchStatus(sid, projectId, "todo")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(projectId))
                .andExpect(jsonPath("$.status").value("todo"));

        mockMvc.perform(get("/api/v1/projects").cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].status").value("todo"));
    }

    /** AC-2 示例 2（直达反例）："披肩"待开始 → 已完成 直达允许，无方向约束报错。 */
    @Test
    void directSwitchFromTodoToCompletedAllowed() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "披肩");

        patchStatus(sid, projectId, "completed")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("completed"));

        mockMvc.perform(get("/api/v1/projects").cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("completed"));
    }

    /** AC-2 备注：12 种跨栏移动全部允许（4 起点 × 4 终点，扣除原地），无任何方向约束。 */
    @Test
    void allTwelveCrossColumnMovesAllowed() throws Exception {
        String[] statuses = {"todo", "in-progress", "on-hold", "completed"};
        String sid = login("iris", "knit123");

        for (String from : statuses) {
            for (String to : statuses) {
                if (from.equals(to)) {
                    continue;
                }
                long projectId = createProject(sid, "项目-" + from + "-" + to);
                patchStatus(sid, projectId, from).andExpect(status().isOk());
                patchStatus(sid, projectId, to)
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status").value(to));
            }
        }
    }

    /** AC-3 示例 1（越权反例）：Luna 名下"贝雷帽"进行中，Iris 发起切换 → 拒绝，状态不变。 */
    @Test
    void switchOtherUsersProjectRejectedAndStatusUnchanged() throws Exception {
        String lunaSid = login("luna", "knit456");
        String irisSid = login("iris", "knit123");
        long projectId = createProject(lunaSid, "贝雷帽");
        patchStatus(lunaSid, projectId, "in-progress").andExpect(status().isOk());

        // Iris 以任何方式对其发起状态变更（AC 原文：提示无权限或项目不可见）
        patchStatus(irisSid, projectId, "completed")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("无权操作该项目"));

        // 反向断言："贝雷帽"仍为"进行中"（Iris 视角查询不到该他人项目）
        mockMvc.perform(get("/api/v1/projects").cookie(new jakarta.servlet.http.Cookie("sid", irisSid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        mockMvc.perform(get("/api/v1/projects").cookie(new jakarta.servlet.http.Cookie("sid", lunaSid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("贝雷帽"))
                .andExpect(jsonPath("$[0].status").value("in-progress"));
    }

    // ---- helpers ----

    private String login(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        return setCookie.substring("sid=".length(), setCookie.indexOf(';'));
    }

    private long createProject(String sid, String name) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/projects")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"dueDate\":\"2026-12-24\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return new ObjectMapper().readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private org.springframework.test.web.servlet.ResultActions patchStatus(String sid, long projectId, String status) throws Exception {
        return mockMvc.perform(patch("/api/v1/projects/" + projectId + "/status")
                .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}"));
    }
}
