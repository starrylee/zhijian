package com.knithub.server.repo;

import com.knithub.server.domain.Project;

import java.util.List;
import java.util.Optional;

/**
 * 项目存储抽象（JSON 文件实现于 repo/json，PG 迁移只换实现）。
 */
public interface ProjectRepository {

    /** 新增或按 id 覆盖保存（FT-02-US-03 状态切换复用同一路径）。 */
    void save(Project project);

    Optional<Project> findById(Long id);

    List<Project> findByUserId(Long userId);

    List<Project> findAll();
}
