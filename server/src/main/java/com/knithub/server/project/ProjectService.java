package com.knithub.server.project;

import com.knithub.server.domain.Milestone;
import com.knithub.server.domain.Project;
import com.knithub.server.project.dto.CreateProjectRequest;
import com.knithub.server.repo.ProjectRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 项目域业务层：建档（FT-02-US-01）、归属过滤。
 */
@Service
public class ProjectService {

    private final ProjectRepository projectRepository;

    public ProjectService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    /**
     * 创建项目：初始状态 todo（AC-1），里程碑按填写顺序内嵌且均未完成（AC-2），
     * last_active_at 建档时 = 创建时间。
     */
    public Project create(Long userId, CreateProjectRequest request) {
        Project project = new Project();
        project.setId(nextId());
        project.setUserId(userId);
        project.setName(request.getName());
        project.setDueDate(request.getDueDate());
        project.setStatus("todo");
        project.setPublic(false);
        project.setMilestones(buildMilestones(request));
        String now = Instant.now().toString();
        project.setCreatedAt(now);
        project.setLastActiveAt(now);
        projectRepository.save(project);
        return project;
    }

    /** 本人项目列表（AC-1：创建后出现在"项目"Tab）。 */
    public List<Project> listByUser(Long userId) {
        return projectRepository.findByUserId(userId);
    }

    private List<Milestone> buildMilestones(CreateProjectRequest request) {
        List<Milestone> milestones = new ArrayList<>();
        long id = 1;
        for (CreateProjectRequest.MilestoneRequest item : request.getMilestones()) {
            Milestone milestone = new Milestone();
            milestone.setId(id++);
            milestone.setName(item.getName());
            milestone.setDueDate(item.getDueDate());
            milestone.setCompleted(false);
            milestone.setCreatedAt(Instant.now().toString());
            milestones.add(milestone);
        }
        return milestones;
    }

    private Long nextId() {
        return projectRepository.findAll().stream()
                .map(Project::getId)
                .filter(id -> id != null)
                .max(Long::compareTo)
                .orElse(0L) + 1;
    }
}
