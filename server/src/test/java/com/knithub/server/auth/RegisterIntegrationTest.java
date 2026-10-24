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

import java.nio.file.Path;
import java.util.List;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FT-01-US-01 注册集成测试（MockMvc + @TempDir 隔离存储，与 LoginIntegrationTest 同构）。
 *
 * <p>覆盖 AC：注册成功即时登录态（AC-1）、重复用户名拒绝（AC-2）、
 * 密码长度下限边界（AC-3，与 AC-1 示例 2 构成边界对）、密码安全存储（AC-4）。
 */
@SpringBootTest
@AutoConfigureMockMvc
class RegisterIntegrationTest {

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
                user(1L, "zhinv", encoder.encode("admin123"),
                        "Admin", "https://example.com/admin.png", "2021-01-01T00:00:00Z"),
                user(2L, "woolenwhimsy", encoder.encode("knit123"),
                        "Sarah Chen", "https://example.com/sarah.png", "2021-03-14T00:00:00Z"));
        new ObjectMapper().writeValue(dataDir.resolve("users.json").toFile(), users);
    }

    /**
     * AC-1 示例 1：未登录访客以 snowflake/mittens2026 注册——注册成功、
     * 直接进入登录态（返回用户 + 会话 Cookie，无需再走登录流程）；
     * 账户资料按最小集生成（displayName 默认同用户名、avatar 为默认占位图）。
     */
    @Test
    void registerSuccessEstablishesSessionImmediately() throws Exception {
        seedUsers(); // 重置存储：保证 snowflake 未被前序用例注册（用例隔离）

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"snowflake\",\"password\":\"mittens2026\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("snowflake"))
                .andExpect(jsonPath("$.displayName").value("snowflake"))
                .andExpect(jsonPath("$.avatar").isNotEmpty())
                .andExpect(header().string("Set-Cookie", allOf(
                        containsString("sid="),
                        containsString("Path=/"),
                        containsString("Max-Age=604800"),
                        containsString("HttpOnly"),
                        containsString("SameSite=Lax"))))
                .andExpect(content().string(not(containsString("password"))));
    }

    /**
     * AC-2 示例 1：种子账号 woolenwhimsy 已存在，另一访客以同名注册——
     * 409 + 「用户名已被占用」，不产生新账号。
     */
    @Test
    void duplicateUsernameRejectedWithoutCreatingAccount() throws Exception {
        String before = java.nio.file.Files.readString(dataDir.resolve("users.json"));

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"woolenwhimsy\",\"password\":\"knit123\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("用户名已被占用"))
                .andExpect(content().string(not(containsString("password"))));

        String after = java.nio.file.Files.readString(dataDir.resolve("users.json"));
        assertEquals(before, after, "注册失败不得产生新账号（存储文件不得被修改）");
    }

    /**
     * AC-1 示例 2（边界下限）：密码恰好 6 位（knit12）——注册成功进入登录态。
     */
    @Test
    void registerWithExactlySixCharPasswordSucceeds() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newweaver\",\"password\":\"knit12\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("newweaver"))
                .andExpect(header().exists("Set-Cookie"));
    }

    /**
     * AC-3 示例 1（边界反例）：密码 knit1 仅 5 位——400 + 密码长度提示，
     * 不创建账号（与 AC-1 示例 2 的 6 位通过构成边界对）。
     */
    @Test
    void shortPasswordRejectedWithoutCreatingAccount() throws Exception {
        String before = java.nio.file.Files.readString(dataDir.resolve("users.json"));

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"newweaver\",\"password\":\"knit1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("密码至少需要 6 位"));

        String after = java.nio.file.Files.readString(dataDir.resolve("users.json"));
        assertEquals(before, after, "密码长度不足不得创建账号（存储文件不得被修改）");
    }

    /**
     * AC-4 示例 1：snowflake 用 mittens2026 注册后——服务端 JSON 文件中该用户
     * 密码字段为 BCrypt hash（$2a$ 前缀），文件中检索不到明文 mittens2026。
     */
    @Test
    void passwordStoredAsBcryptHashWithoutPlaintext() throws Exception {
        seedUsers(); // 重置存储：保证 snowflake 未被前序用例注册（用例隔离）

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"snowflake\",\"password\":\"mittens2026\"}"))
                .andExpect(status().isCreated());

        Path usersFile = dataDir.resolve("users.json");
        String stored = java.nio.file.Files.readString(usersFile);
        assertFalse(stored.contains("mittens2026"), "持久化文件中不得存在明文密码");

        com.fasterxml.jackson.databind.JsonNode snowflake = new ObjectMapper()
                .readTree(usersFile.toFile())
                .findParents("username").stream()
                .filter(node -> "snowflake".equals(node.get("username").asText()))
                .findFirst()
                .orElseThrow();
        String hash = snowflake.get("password_hash").asText();
        assertTrue(hash.startsWith("$2a$"), "密码须为 BCrypt hash，实际: " + hash);
        assertTrue(new BCryptPasswordEncoder().matches("mittens2026", hash),
                "hash 须能验证原密码（保证是密码的 hash 而非任意值）");
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
