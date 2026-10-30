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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FT-02-US-01 创建项目集成测试（MockMvc + @TempDir 隔离存储）。
 *
 * <p>覆盖 AC：成功创建项目（AC-1，初始状态 todo）、可选里程碑（AC-2）、
 * 必填项校验（AC-3）、里程碑名称必填（AC-4）、未登录不可创建（AC-5）。
 */
@SpringBootTest
@AutoConfigureMockMvc
class ProjectCreateIntegrationTest {

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
        User user = new User();
        user.setId(2L);
        user.setUsername("woolenwhimsy");
        user.setPasswordHash(encoder.encode("knit123"));
        user.setDisplayName("Sarah Chen");
        user.setAvatar("https://example.com/sarah.png");
        user.setCreatedAt("2021-03-14T00:00:00Z");
        new ObjectMapper().writeValue(dataDir.resolve("users.json").toFile(), List.of(user));
    }

    @BeforeEach
    void resetProjects() throws Exception {
        java.nio.file.Files.writeString(dataDir.resolve("projects.json"), "[]");
    }

    /** AC-1 示例 1：Iris 已登录，创建"祖母的生日披肩"（2026-10-31，无里程碑）。 */
    @Test
    void createProjectSuccessReturnsTodoStatusAndAppearsInList() throws Exception {
        String sid = login();

        MvcResult created = mockMvc.perform(post("/api/v1/projects")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"祖母的生日披肩\",\"dueDate\":\"2026-10-31\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("祖母的生日披肩"))
                .andExpect(jsonPath("$.dueDate").value("2026-10-31"))
                .andExpect(jsonPath("$.status").value("todo"))
                .andExpect(jsonPath("$.milestones").isEmpty())
                .andReturn();

        // 项目出现在本人项目列表中
        mockMvc.perform(get("/api/v1/projects").cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("祖母的生日披肩"))
                .andExpect(jsonPath("$[0].status").value("todo"));
    }

    /** AC-2 示例 1："圣诞袜"携带里程碑"织袜筒"（2026-12-01）与"收口"（不填日期）。 */
    @Test
    void createProjectWithMilestonesKeepsOrderAndIncomplete() throws Exception {
        String sid = login();

        mockMvc.perform(post("/api/v1/projects")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"圣诞袜","dueDate":"2026-12-24","milestones":[
                                  {"name":"织袜筒","dueDate":"2026-12-01"},
                                  {"name":"收口"}
                                ]}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("圣诞袜"))
                .andExpect(jsonPath("$.status").value("todo"))
                .andExpect(jsonPath("$.milestones", hasSize(2)))
                .andExpect(jsonPath("$.milestones[0].name").value("织袜筒"))
                .andExpect(jsonPath("$.milestones[0].dueDate").value("2026-12-01"))
                .andExpect(jsonPath("$.milestones[0].completed").value(false))
                .andExpect(jsonPath("$.milestones[1].name").value("收口"))
                .andExpect(jsonPath("$.milestones[1].dueDate").doesNotExist())
                .andExpect(jsonPath("$.milestones[1].completed").value(false));

        mockMvc.perform(get("/api/v1/projects").cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].milestones[0].name").value("织袜筒"))
                .andExpect(jsonPath("$[0].milestones[1].name").value("收口"));
    }

    /** AC-3 示例 1：名称留空 → 提示"请填写项目名称"，项目未创建。 */
    @Test
    void blankNameRejectedWithMessageAndNoProjectCreated() throws Exception {
        String sid = login();

        mockMvc.perform(post("/api/v1/projects")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"dueDate\":\"2026-11-15\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("请填写项目名称"));

        assertNoProjectCreated(sid);
    }

    /** AC-3 示例 2（反例）：日期未选 → 提示"请选择预计完成日期"，项目未创建。 */
    @Test
    void missingDueDateRejectedWithMessageAndNoProjectCreated() throws Exception {
        String sid = login();

        mockMvc.perform(post("/api/v1/projects")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"围巾\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("请选择预计完成日期"));

        assertNoProjectCreated(sid);
    }

    /** AC-4 示例 1：项目名称/日期已填，里程碑名称留空 → 提示"里程碑名称必填"，项目未创建。 */
    @Test
    void blankMilestoneNameRejectedAndNoProjectCreated() throws Exception {
        String sid = login();

        mockMvc.perform(post("/api/v1/projects")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"圣诞袜\",\"dueDate\":\"2026-12-24\","
                                + "\"milestones\":[{\"name\":\"\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("里程碑名称必填"));

        assertNoProjectCreated(sid);
    }

    /** AC-5 示例 1：未登录（无 sid）调用创建 → 401，项目未创建。 */
    @Test
    void createWithoutLoginRejectedAndNoProjectCreated() throws Exception {
        mockMvc.perform(post("/api/v1/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"祖母的生日披肩\",\"dueDate\":\"2026-10-31\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/projects"))
                .andExpect(status().isUnauthorized());
    }

    private void assertNoProjectCreated(String sid) throws Exception {
        mockMvc.perform(get("/api/v1/projects").cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    private String login() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"woolenwhimsy\",\"password\":\"knit123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        return setCookie.substring("sid=".length(), setCookie.indexOf(';'));
    }
}
