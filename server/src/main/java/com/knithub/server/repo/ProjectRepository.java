package com.knithub.server.repo;

import com.knithub.server.domain.Project;

import java.util.List;

/**
 * 项目存储抽象（JSON 文件实现于 repo/json，PG 迁移只换实现）。
 */
public interface ProjectRepository {

    void save(Project project);

    List<Project> findByUserId(Long userId);

    List<Project> findAll();
}
