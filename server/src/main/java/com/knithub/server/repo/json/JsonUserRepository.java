package com.knithub.server.repo.json;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.knithub.server.domain.User;
import com.knithub.server.repo.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * {@link UserRepository} 的 JSON 文件实现（存储：{@code server/data/users.json}，
 * 字段 snake_case，与 PG 列名对齐）。
 *
 * <p>一切约束由代码层保证（技术方案 3.1）：username 唯一性依赖种子数据/注册
 * 写入侧保证，读取侧仅做大小写不敏感匹配（FT-01 决策 1/4）。
 */
@Component
public class JsonUserRepository implements UserRepository {

    private final JsonFileStore<User> store;

    public JsonUserRepository(@Value("${app.data-dir}") String dataDir, ObjectMapper objectMapper) {
        this.store = new JsonFileStore<>(
                Path.of(dataDir, "users.json"),
                new TypeReference<List<User>>() {
                },
                objectMapper);
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return store.readAll().stream()
                .filter(user -> user.getUsername().equalsIgnoreCase(username))
                .findFirst();
    }

    @Override
    public Optional<User> findById(Long id) {
        return store.readAll().stream()
                .filter(user -> user.getId().equals(id))
                .findFirst();
    }

    @Override
    public void save(User user) {
        List<User> users = new ArrayList<>(store.readAll());
        users.add(user);
        store.writeAll(users);
    }

    @Override
    public List<User> findAll() {
        return store.readAll();
    }
}
