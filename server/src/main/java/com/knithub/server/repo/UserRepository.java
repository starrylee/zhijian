package com.knithub.server.repo;

import com.knithub.server.domain.User;

import java.util.List;
import java.util.Optional;

/**
 * 用户存储接口——Repository 抽象层（技术方案第 1、2 节）。
 *
 * <p>JSON 阶段由 {@code repo/json/JsonUserRepository} 实现；迁移 PG 时仅替换
 * {@code repo/json/} 包内实现，本接口即未来 PG 迁移契约，业务代码只依赖本接口。
 *
 * <p>方法集随各 US 需要增加，不预发明（当前：FT-01-US-02 登录所需的最小集）。
 */
public interface UserRepository {

    /**
     * 按用户名查找用户。
     *
     * <p>大小写不敏感（FT-01 决策 1/4：注册唯一性与登录匹配同一口径，
     * 由 Repository 层统一 lowercase 比对实现）。
     *
     * @param username 登录表单输入的用户名（任意大小写）
     * @return 命中的用户；不存在时为 empty
     */
    Optional<User> findByUsername(String username);

    /**
     * 按用户 id 查找用户。
     *
     * @param id 用户 id
     * @return 命中的用户；不存在时为 empty
     */
    Optional<User> findById(Long id);

    /**
     * 追加保存用户（FT-01-US-01 注册写入路径；id 由调用方分配）。
     */
    void save(User user);

    /**
     * 全量查询（FT-01-US-01 注册分配自增 id 用）。
     */
    List<User> findAll();
}
