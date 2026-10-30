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

    /**
     * FT-02-US-04 AC-1 添加里程碑：按创建顺序追加到列表末尾，初始未完成。
     * 项目不存在 → 404；不归属当前用户 → 403（复用 changeStatus 的越权口径）。
     */
    public Project addMilestone(Long userId, Long projectId, String name, String dueDate) {
        Project project = requireOwnedProject(userId, projectId);
        Milestone milestone = new Milestone();
        milestone.setId(nextMilestoneId(project));
        milestone.setName(name);
        milestone.setDueDate(dueDate);
        milestone.setCompleted(false);
        milestone.setCreatedAt(Instant.now().toString());
        project.getMilestones().add(milestone);
        project.setLastActiveAt(Instant.now().toString());
        projectRepository.save(project);
        return project;
    }

    /**
     * FT-02-US-04 AC-2 编辑里程碑：原位替换名称/预计日期，数组序（=创建顺序）不变。
     * 里程碑不存在 → MilestoneNotFoundException（404）。
     */
    public Project editMilestone(Long userId, Long projectId, Long milestoneId,
                                 String name, String dueDate) {
        Project project = requireOwnedProject(userId, projectId);
        Milestone milestone = project.getMilestones().stream()
                .filter(m -> milestoneId.equals(m.getId()))
                .findFirst()
                .orElseThrow(MilestoneNotFoundException::new);
        milestone.setName(name);
        milestone.setDueDate(dueDate);
        project.setLastActiveAt(Instant.now().toString());
        projectRepository.save(project);
        return project;
    }

    /**
     * FT-02-US-04 AC-3/AC-6 手动完成/取消完成（双向翻转）：完成与否完全由用户手动决定。
     */
    public Project setMilestoneCompleted(Long userId, Long projectId, Long milestoneId, boolean completed) {
        Project project = requireOwnedProject(userId, projectId);
        Milestone milestone = project.getMilestones().stream()
                .filter(m -> milestoneId.equals(m.getId()))
                .findFirst()
                .orElseThrow(MilestoneNotFoundException::new);
        milestone.setCompleted(completed);
        project.setLastActiveAt(Instant.now().toString());
        projectRepository.save(project);
        return project;
    }

    /**
     * FT-02-US-04 AC-4 删除里程碑：原位移除，其余里程碑保持创建顺序（数组序天然不重排）。
     */
    public Project deleteMilestone(Long userId, Long projectId, Long milestoneId) {
        Project project = requireOwnedProject(userId, projectId);
        boolean removed = project.getMilestones()
                .removeIf(m -> milestoneId.equals(m.getId()));
        if (!removed) {
            throw new MilestoneNotFoundException();
        }
        project.setLastActiveAt(Instant.now().toString());
        projectRepository.save(project);
        return project;
    }

    /** 本人项目列表（AC-1：创建后出现在"项目"Tab）。 */
    public List<Project> listByUser(Long userId) {
        return projectRepository.findByUserId(userId);
    }

    /**
     * FT-02-US-03 状态切换：4×4 自由互切（含"已完成→待开始"重开），无方向约束。
     * 项目不存在或不归属当前用户 → 异常由控制器翻译为 404/403（AC-3）。
     */
    public Project changeStatus(Long userId, Long projectId, String status) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(ProjectNotFoundException::new);
        if (!project.getUserId().equals(userId)) {
            throw new NotProjectOwnerException();
        }
        project.setStatus(status);
        project.setLastActiveAt(Instant.now().toString());
        projectRepository.save(project);
        return project;
    }

    /** 项目不存在（或不便区分的场景统一归并）→ 404。 */
    static class ProjectNotFoundException extends RuntimeException {
    }

    /** 项目不归属当前会话用户 → 403（AC-3）。 */
    static class NotProjectOwnerException extends RuntimeException {
    }

    /** 里程碑不存在 → 404（FT-02-US-04）。 */
    static class MilestoneNotFoundException extends RuntimeException {
    }

    /** 项目存在且归属当前用户 → 返回；否则 404/403（FT-02-US-03/04 共用口径）。 */
    private Project requireOwnedProject(Long userId, Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(ProjectNotFoundException::new);
        if (!project.getUserId().equals(userId)) {
            throw new NotProjectOwnerException();
        }
        return project;
    }

    /** 里程碑 id 项目内自增：取现有最大 id + 1（删除不回收，保持唯一即可）。 */
    private long nextMilestoneId(Project project) {
        return project.getMilestones().stream()
                .map(Milestone::getId)
                .filter(id -> id != null)
                .max(Long::compareTo)
                .orElse(0L) + 1;
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
