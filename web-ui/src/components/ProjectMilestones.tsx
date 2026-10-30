import { useState } from "react";

/**
 * FT-02-US-04 里程碑管理面板（本人后端项目卡片内挂载）。
 *
 * 行为契约：
 * - 添加：POST /api/v1/projects/{id}/milestones（名称必填、预计日期可选），按创建顺序追加
 * - 编辑：PATCH /api/v1/projects/{id}/milestones/{mid}
 * - 完成/取消完成：PATCH /api/v1/projects/{id}/milestones/{mid}/completed
 * - 删除：DELETE /api/v1/projects/{id}/milestones/{mid}
 */

export interface MilestoneItem {
  id: number;
  name: string;
  dueDate?: string;
  completed: boolean;
}

export interface MilestoneProject {
  id: number;
  milestones: MilestoneItem[];
}

interface ProjectMilestonesProps {
  project: MilestoneProject;
  onProjectUpdated: (project: MilestoneProject) => void;
}

export default function ProjectMilestones({ project, onProjectUpdated }: ProjectMilestonesProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // FT-02-US-04 AC-2：编辑态（一次编辑一条）
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  async function request(path: string, init: RequestInit, fallbackMessage: string) {
    const response = await fetch(`/api/v1/projects/${project.id}${path}`, init);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? fallbackMessage);
      return null;
    }
    setError(null);
    return (await response.json()) as MilestoneProject;
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    // AC-5：名称必填（客户端前置校验，与后端 400 口径一致）
    if (!name.trim()) {
      setError("里程碑名称必填");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await request("/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(dueDate ? { dueDate } : {}),
        }),
      }, "添加里程碑失败，请稍后重试");
      if (updated) {
        setName("");
        setDueDate("");
        setShowForm(false);
        onProjectUpdated(updated);
      }
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    // AC-5：编辑时名称同样必填
    if (!editName.trim()) {
      setError("里程碑名称必填");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await request(`/milestones/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), dueDate: editDueDate || undefined }),
      }, "编辑里程碑失败，请稍后重试");
      if (updated) {
        setEditingId(null);
        onProjectUpdated(updated);
      }
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  /** AC-4：删除里程碑（轻量操作，无二次确认）。 */
  async function handleDelete(milestone: MilestoneItem) {
    setError(null);
    try {
      const updated = await request(`/milestones/${milestone.id}`, { method: "DELETE" }, "删除里程碑失败，请稍后重试");
      if (updated) {
        onProjectUpdated(updated);
      }
    } catch {
      setError("网络异常，请稍后重试");
    }
  }

  /** AC-3/AC-6：手动完成 / 取消完成（双向翻转）。 */
  async function handleToggleCompleted(milestone: MilestoneItem) {
    setError(null);
    try {
      const updated = await request(`/milestones/${milestone.id}/completed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !milestone.completed }),
      }, "操作失败，请稍后重试");
      if (updated) {
        onProjectUpdated(updated);
      }
    } catch {
      setError("网络异常，请稍后重试");
    }
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
      <p className="text-xs font-bold mb-2" style={{ color: "var(--muted-foreground)" }}>
        里程碑
      </p>
      {project.milestones.length > 0 && (
        <ul className="space-y-1.5 mb-2" data-testid="milestone-list">
          {project.milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              editing={editingId === milestone.id}
              editName={editName}
              editDueDate={editDueDate}
              onEditName={setEditName}
              onEditDueDate={setEditDueDate}
              onStartEdit={() => {
                setEditingId(milestone.id);
                setEditName(milestone.name);
                setEditDueDate(milestone.dueDate ?? "");
                setError(null);
              }}
              onCancelEdit={() => setEditingId(null)}
              onSubmitEdit={handleEdit}
              submitting={submitting}
              onToggleCompleted={handleToggleCompleted}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs mb-2" style={{ color: "#B3402A" }}>
          {error}
        </p>
      )}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-xs font-medium"
          style={{ color: "var(--primary)" }}
        >
          添加里程碑
        </button>
      ) : (
        <MilestoneForm
          formId={`add-${project.id}`}
          name={name}
          dueDate={dueDate}
          onNameChange={setName}
          onDueDateChange={setDueDate}
          onSubmit={handleAdd}
          onCancel={() => {
            setShowForm(false);
            setName("");
            setDueDate("");
            setError(null);
          }}
          submitting={submitting}
        />
      )}
    </div>
  );
}

/** 名称 + 预计日期表单（添加与编辑共用，label htmlFor 以 formId 区分）。 */
function MilestoneForm({
  formId,
  name,
  dueDate,
  onNameChange,
  onDueDateChange,
  onSubmit,
  onCancel,
  submitting,
}: {
  formId: string;
  name: string;
  dueDate: string;
  onNameChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const inputStyle = { border: "1px solid var(--border)", background: "var(--background)" };
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div>
        <label htmlFor={`milestone-name-${formId}`} className="block text-xs mb-0.5" style={{ color: "var(--muted-foreground)" }}>
          里程碑名称
        </label>
        <input
          id={`milestone-name-${formId}`}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full rounded-md px-2 py-1 text-sm"
          style={inputStyle}
        />
      </div>
      <div>
        <label htmlFor={`milestone-due-${formId}`} className="block text-xs mb-0.5" style={{ color: "var(--muted-foreground)" }}>
          预计日期（可选）
        </label>
        <input
          type="date"
          id={`milestone-due-${formId}`}
          aria-label="预计日期"
          value={dueDate}
          onChange={(e) => onDueDateChange(e.target.value)}
          className="w-full rounded-md px-2 py-1 text-sm"
          style={inputStyle}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md px-3 py-1 text-xs font-semibold"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1 text-xs"
          style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
        >
          取消
        </button>
      </div>
    </form>
  );
}

/** 单条里程碑：展示态（名称/日期/完成标识 + 编辑入口）或内联编辑表单。 */
function MilestoneRow({
  milestone,
  editing,
  editName,
  editDueDate,
  onEditName,
  onEditDueDate,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onToggleCompleted,
  onDelete,
  submitting,
}: {
  milestone: MilestoneItem;
  editing: boolean;
  editName: string;
  editDueDate: string;
  onEditName: (value: string) => void;
  onEditDueDate: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (event: React.FormEvent) => void;
  onToggleCompleted: (milestone: MilestoneItem) => void;
  onDelete: (milestone: MilestoneItem) => void;
  submitting: boolean;
}) {
  if (editing) {
    return (
      <li className="text-xs py-1" style={{ color: "var(--foreground)" }}>
        <MilestoneForm
          formId={`edit-${milestone.id}`}
          name={editName}
          dueDate={editDueDate}
          onNameChange={onEditName}
          onDueDateChange={onEditDueDate}
          onSubmit={onSubmitEdit}
          onCancel={onCancelEdit}
          submitting={submitting}
        />
      </li>
    );
  }
  return (
    <li className="text-xs flex items-start gap-1" style={{ color: "var(--foreground)" }}>
      <span className="flex-1">
        {milestone.name}
        {milestone.dueDate && (
          <span className="ml-1" style={{ color: "var(--muted-foreground)" }}>
            （{milestone.dueDate}）
          </span>
        )}
        <span
          className="ml-2 font-semibold"
          style={{ color: milestone.completed ? "#4E7251" : "var(--muted-foreground)" }}
        >
          {milestone.completed ? "已完成" : "未完成"}
        </span>
      </span>
      <button
        type="button"
        onClick={() => onToggleCompleted(milestone)}
        aria-label={milestone.completed ? `取消完成 ${milestone.name}` : `完成该里程碑 ${milestone.name}`}
        className="text-xs shrink-0"
        style={{ color: milestone.completed ? "var(--muted-foreground)" : "#4E7251" }}
      >
        {milestone.completed ? "取消完成" : "完成"}
      </button>
      <button
        type="button"
        onClick={onStartEdit}
        aria-label={`编辑 ${milestone.name}`}
        className="text-xs shrink-0"
        style={{ color: "var(--primary)" }}
      >
        编辑
      </button>
      <button
        type="button"
        onClick={() => onDelete(milestone)}
        aria-label={`删除 ${milestone.name}`}
        className="text-xs shrink-0"
        style={{ color: "#B3402A" }}
      >
        删除
      </button>
    </li>
  );
}
