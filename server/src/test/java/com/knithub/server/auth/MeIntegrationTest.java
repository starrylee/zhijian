package com.knithub.server.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.knithub.server.domain.User;
import org.junit.jupiter.api.BeforeAll;
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

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FT-01-US-03-M01 会话恢复骨架集成测试（仿 LoginIntegrationTest 模式：
 * MockMvc + @TempDir 隔离存储 + 种子 woolenwhimsy/knit123）。
 *
 * <p>覆盖 AC-4：GET /api/v1/auth/me 会话查询接口契约——有效会话 200 +
 * UserResponse（camelCase，无 passwordHash）；无有效会话 401。
 */
@SpringBootTest
@AutoConfigureMockMvc
class MeIntegrationTest {

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
        List<User> users = List.of(
                user(2L, "woolenwhimsy", encoder.encode("knit123"),
                        "Sarah Chen", "https://example.com/sarah.png", "2021-03-14T00:00:00Z"));
        new ObjectMapper().writeValue(dataDir.resolve("users.json").toFile(), users);
    }

    @Test
    void meWithValidSessionReturnsUser() throws Exception {
        String sid = loginAndExtractSid("woolenwhimsy", "knit123");
        mockMvc.perform(get("/api/v1/auth/me").cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(2))
                .andExpect(jsonPath("$.username").value("woolenwhimsy"))
                .andExpect(jsonPath("$.displayName").value("Sarah Chen"))
                .andExpect(jsonPath("$.avatar").value("https://example.com/sarah.png"))
                .andExpect(content().string(not(containsString("password"))));
    }

    @Test
    void meWithoutSidReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meWithInvalidSidReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me").cookie(new jakarta.servlet.http.Cookie("sid", "stale-sid-after-server-restart")))
                .andExpect(status().isUnauthorized());
    }

    /**
     * 登录并从响应头 Set-Cookie 中提取 sid（供 /me 携带 Cookie 复用）。
     */
    private String loginAndExtractSid(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        return setCookie.substring(setCookie.indexOf("sid=") + 4, setCookie.indexOf(';'));
    }

    private static User user(long id, String username, String passwordHash,
                             String displayName, String avatar, String createdAt) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setPasswordHash(passwordHash);
        user.setDisplayName(displayName);
        user.setAvatar(avatar);
        user.setCreatedAt(createdAt);
        return user;
    }
}
