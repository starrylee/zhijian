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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FT-01-US-04 登出集成测试（仿 MeIntegrationTest 模式：MockMvc +
 * @TempDir 隔离存储 + 种子 woolenwhimsy/knit123）。
 *
 * <p>覆盖 AC-2（登出后旧会话不可复用，防「登出仅清前端态」的假登出）：
 * 实例化示例 1——woolenwhimsy 登出后，携带登出前的旧 Cookie sid 请求
 * 会话查询接口 /api/v1/auth/me，必须返回 401（视为未登录）。
 *
 * <p>备注：实例化示例中 curl/开发者工具验证场景为 AI 草拟（story 已标注
 * 待与 PO 核实），此处以 MockMvc 等价实例化「携带旧 Cookie 再请求」。
 */
@SpringBootTest
@AutoConfigureMockMvc
class LogoutIntegrationTest {

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

    /**
     * AC-2 示例 1：登出后携带登出前的旧 Cookie 请求会话查询接口 → 401。
     */
    @Test
    void meWithOldCookieAfterLogoutReturns401() throws Exception {
        String sid = loginAndExtractSid("woolenwhimsy", "knit123");

        mockMvc.perform(post("/api/v1/auth/logout")
                        .cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/auth/me").cookie(new jakarta.servlet.http.Cookie("sid", sid)))
                .andExpect(status().isUnauthorized());
    }

    /**
     * 登录并从响应头 Set-Cookie 中提取 sid（供登出与 /me 携带 Cookie 复用）。
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
