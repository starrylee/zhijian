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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FT-02-US-04 里程碑管理集成测试（MockMvc + @TempDir 隔离存储）。
 *
 * <p>场景数据为 AI 草拟（待与 PO 核实）：用户 Iris / Luna、项目"毛衣"。
 */
@SpringBootTest
@AutoConfigureMockMvc
class ProjectMilestoneIntegrationTest {

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

    /** AC-1 示例 1：Iris 的项目"毛衣"（无里程碑）→ 添加"织前片"（预计日期 2026-10-15）→ 列表出现且未完成。 */
    @Test
    void addMilestoneAppendsAsNotCompleted() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "毛衣");

        mockMvc.perform(post("/api/v1/projects/" + projectId + "/milestones")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"织前片\",\"dueDate\":\"2026-10-15\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.milestones", hasSize(1)))
                .andExpect(jsonPath("$.milestones[0].name").value("织前片"))
                .andExpect(jsonPath("$.milestones[0].dueDate").value("2026-10-15"))
                .andExpect(jsonPath("$.milestones[0].completed").value(false));

        // 列表查询仍可见（持久化）
        mockMvc.perform(get("/api/v1/projects").cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].milestones", hasSize(1)))
                .andExpect(jsonPath("$[0].milestones[0].name").value("织前片"))
                .andExpect(jsonPath("$[0].milestones[0].completed").value(false));
    }

    /** AC-1 示例 2：已有"织前片"→ 再添加"织袖子"（不填日期）→ 按创建顺序追加到末尾。 */
    @Test
    void addSecondMilestoneWithoutDateAppendsInCreationOrder() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "毛衣");
        addMilestone(sid, projectId, "织前片", "2026-10-15").andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/projects/" + projectId + "/milestones")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"织袖子\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.milestones", hasSize(2)))
                .andExpect(jsonPath("$.milestones[0].name").value("织前片"))
                .andExpect(jsonPath("$.milestones[1].name").value("织袖子"))
                .andExpect(jsonPath("$.milestones[1].completed").value(false))
                // 未填日期 → 字段不下发（MilestoneResponse NON_NULL 契约）
                .andExpect(jsonPath("$.milestones[1].dueDate").doesNotExist());
    }

    /** AC-2 示例 1："织袖子"（无日期）→ 改名"织两只袖子"+ 补日期 2026-11-01 → 生效且仍排"织前片"之后。 */
    @Test
    void editMilestoneNameAndDueDateKeepsOrder() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "毛衣");
        addMilestone(sid, projectId, "织前片", "2026-10-15").andExpect(status().isCreated());
        addMilestone(sid, projectId, "织袖子", null).andExpect(status().isCreated());
        long sleeveId = fetchMilestones(sid).get(1).get("id").asLong();

        mockMvc.perform(patch("/api/v1/projects/" + projectId + "/milestones/" + sleeveId)
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"织两只袖子\",\"dueDate\":\"2026-11-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.milestones", hasSize(2)))
                .andExpect(jsonPath("$.milestones[0].name").value("织前片"))
                .andExpect(jsonPath("$.milestones[1].name").value("织两只袖子"))
                .andExpect(jsonPath("$.milestones[1].dueDate").value("2026-11-01"));

        // 持久化后查询仍保持顺序
        com.fasterxml.jackson.databind.JsonNode milestones = fetchMilestones(sid);
        org.junit.jupiter.api.Assertions.assertEquals("织前片", milestones.get(0).get("name").asText());
        org.junit.jupiter.api.Assertions.assertEquals("织两只袖子", milestones.get(1).get("name").asText());
        org.junit.jupiter.api.Assertions.assertEquals("2026-11-01", milestones.get(1).get("dueDate").asText());
    }

    /** AC-3 示例 1："织前片"未完成 → Iris 点击"完成该里程碑" → 变为已完成（完成标识）。 */
    @Test
    void completeMilestoneManuallyMarksCompleted() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "毛衣");
        addMilestone(sid, projectId, "织前片", "2026-10-15").andExpect(status().isCreated());
        long milestoneId = fetchMilestones(sid).get(0).get("id").asLong();

        mockMvc.perform(patch("/api/v1/projects/" + projectId + "/milestones/" + milestoneId + "/completed")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"completed\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.milestones[0].name").value("织前片"))
                .andExpect(jsonPath("$.milestones[0].completed").value(true));

        // 持久化后查询仍为已完成
        org.junit.jupiter.api.Assertions.assertTrue(fetchMilestones(sid).get(0).get("completed").asBoolean());
    }

    /**
     * AC-3 示例 2（规则反例）："织袖子"未完成、项目下已有 3 次打卡（FT-03 未接入，
     * 以多次项目活动操作模拟），Iris 不点击完成 → 无论多少次操作，里程碑保持未完成。
     */
    @Test
    void milestoneNeverAutoCompletedByOtherActivity() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "毛衣");
        addMilestone(sid, projectId, "织袖子", null).andExpect(status().isCreated());
        long milestoneId = fetchMilestones(sid).get(0).get("id").asLong();

        // 3 次"打卡"规模的其它项目活动：添加 2 个里程碑 + 状态切换
        addMilestone(sid, projectId, "缝合", null).andExpect(status().isCreated());
        addMilestone(sid, projectId, "收尾", null).andExpect(status().isCreated());
        mockMvc.perform(patch("/api/v1/projects/" + projectId + "/status")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"in-progress\"}"))
                .andExpect(status().isOk());

        com.fasterxml.jackson.databind.JsonNode milestone = fetchMilestones(sid).get(0);
        org.junit.jupiter.api.Assertions.assertEquals("织袖子", milestone.get("name").asText());
        org.junit.jupiter.api.Assertions.assertFalse(milestone.get("completed").asBoolean());
        org.junit.jupiter.api.Assertions.assertEquals(milestoneId, milestone.get("id").asLong());
    }

    /** AC-4 示例 1：删除中间的"织袖子" → 剩余"织前片"、"缝合"，仍按原顺序。 */
    @Test
    void deleteMiddleMilestoneKeepsRemainingOrder() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "毛衣");
        addMilestone(sid, projectId, "织前片", null).andExpect(status().isCreated());
        addMilestone(sid, projectId, "织袖子", null).andExpect(status().isCreated());
        addMilestone(sid, projectId, "缝合", null).andExpect(status().isCreated());
        long sleeveId = fetchMilestones(sid).get(1).get("id").asLong();

        mockMvc.perform(delete("/api/v1/projects/" + projectId + "/milestones/" + sleeveId)
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.milestones", hasSize(2)))
                .andExpect(jsonPath("$.milestones[0].name").value("织前片"))
                .andExpect(jsonPath("$.milestones[1].name").value("缝合"));

        // 持久化后仍保持原顺序
        com.fasterxml.jackson.databind.JsonNode milestones = fetchMilestones(sid);
        org.junit.jupiter.api.Assertions.assertEquals(2, milestones.size());
        org.junit.jupiter.api.Assertions.assertEquals("织前片", milestones.get(0).get("name").asText());
        org.junit.jupiter.api.Assertions.assertEquals("缝合", milestones.get(1).get("name").asText());
    }

    /** AC-5 示例 1：名称留空、日期 2026-12-20 保存 → 400 "里程碑名称必填"，未添加。 */
    @Test
    void addMilestoneWithBlankNameRejected() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "毛衣");

        mockMvc.perform(post("/api/v1/projects/" + projectId + "/milestones")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"dueDate\":\"2026-12-20\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("里程碑名称必填"));

        // 反向断言：里程碑未添加
        org.junit.jupiter.api.Assertions.assertEquals(0, fetchMilestones(sid).size());
    }

    /** AC-6 示例 1："织前片"误点为已完成 → 点击取消完成 → 恢复未完成。 */
    @Test
    void uncompleteMilestoneRestoresNotCompleted() throws Exception {
        String sid = login("iris", "knit123");
        long projectId = createProject(sid, "毛衣");
        addMilestone(sid, projectId, "织前片", null).andExpect(status().isCreated());
        long milestoneId = fetchMilestones(sid).get(0).get("id").asLong();
        // 误点完成
        mockMvc.perform(patch("/api/v1/projects/" + projectId + "/milestones/" + milestoneId + "/completed")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"completed\":true}"))
                .andExpect(status().isOk());

        // 取消完成（方案 A：双向翻转）
        mockMvc.perform(patch("/api/v1/projects/" + projectId + "/milestones/" + milestoneId + "/completed")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"completed\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.milestones[0].completed").value(false));

        // 持久化后仍为未完成
        org.junit.jupiter.api.Assertions.assertFalse(fetchMilestones(sid).get(0).get("completed").asBoolean());
    }

    // ---- helpers ----

    /** 解析项目里程碑列表（GET /api/v1/projects 首个项目）。 */
    private com.fasterxml.jackson.databind.JsonNode fetchMilestones(String sid) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/projects")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isOk())
                .andReturn();
        return new ObjectMapper().readTree(result.getResponse().getContentAsString())
                .get(0).get("milestones");
    }

    private String login(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        return setCookie.substring("sid=".length(), setCookie.indexOf(';'));
    }

    private org.springframework.test.web.servlet.ResultActions addMilestone(
            String sid, long projectId, String name, String dueDate) throws Exception {
        String body = dueDate == null
                ? "{\"name\":\"" + name + "\"}"
                : "{\"name\":\"" + name + "\",\"dueDate\":\"" + dueDate + "\"}";
        return mockMvc.perform(post("/api/v1/projects/" + projectId + "/milestones")
                .cookie(new jakarta.servlet.http.Cookie("sid", sid))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
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
}
