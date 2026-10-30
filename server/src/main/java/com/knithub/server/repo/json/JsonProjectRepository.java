package com.knithub.server.repo.json;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.knithub.server.domain.Project;
import com.knithub.server.repo.ProjectRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * {@link ProjectRepository} 的 JSON 文件实现（存储：server/data/projects.json，snake_case）。
 */
@Component
public class JsonProjectRepository implements ProjectRepository {

    private final JsonFileStore<Project> store;

    public JsonProjectRepository(@Value("${app.data-dir}") String dataDir, ObjectMapper objectMapper) {
        this.store = new JsonFileStore<>(
                Path.of(dataDir, "projects.json"),
                new TypeReference<List<Project>>() {
                },
                objectMapper);
    }

    @Override
    public void save(Project project) {
        List<Project> projects = new ArrayList<>(store.readAll());
        int index = -1;
        for (int i = 0; i < projects.size(); i++) {
            if (project.getId() != null && project.getId().equals(projects.get(i).getId())) {
                index = i;
                break;
            }
        }
        if (index >= 0) {
            projects.set(index, project);
        } else {
            projects.add(project);
        }
        store.writeAll(projects);
    }

    @Override
    public java.util.Optional<Project> findById(Long id) {
        return store.readAll().stream()
                .filter(project -> project.getId().equals(id))
                .findFirst();
    }

    @Override
    public List<Project> findByUserId(Long userId) {
        return store.readAll().stream()
                .filter(project -> project.getUserId().equals(userId))
                .toList();
    }

    @Override
    public List<Project> findAll() {
        return store.readAll();
    }
}
