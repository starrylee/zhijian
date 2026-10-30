import { useState } from "react";

export interface MilestoneDraft {
  name: string;
  dueDate: string;
}

export interface CreatedProject {
  id: number;
  name: string;
  dueDate: string;
  status: string;
  milestones: unknown[];
}

interface NewProjectFormProps {
  onSuccess: (project: CreatedProject) => void;
}

/**
 * 新建项目表单（FT-02-US-01）：名称与预计完成日期必填，里程碑可选。
 * 提交 POST /api/v1/projects（同源 Cookie 会话）。
 */
export default function NewProjectForm({ onSuccess }: NewProjectFormProps) {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("请填写项目名称");
      return;
    }
    if (!dueDate) {
      setError("请选择预计完成日期");
      return;
    }
    if (milestones.some((m) => !m.name.trim())) {
      setError("里程碑名称必填");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          dueDate,
          milestones: milestones.map((m) => ({
            name: m.name.trim(),
            ...(m.dueDate ? { dueDate: m.dueDate } : {}),
          })),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.message ?? "创建失败，请稍后重试");
        return;
      }
      onSuccess(body as CreatedProject);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="新建项目表单">
      <div className="mb-4">
        <label htmlFor="project-name" className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
          项目名称
        </label>
        <input
          id="project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg px-3 py-2"
          style={{ border: "1.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        />
      </div>
      <div className="mb-4">
        <label htmlFor="project-due-date" className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
          预计完成日期
        </label>
        <input
          id="project-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-lg px-3 py-2"
          style={{ border: "1.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        />
      </div>

      {milestones.map((milestone, index) => (
        <div key={index} className="mb-4">
          <label
            htmlFor={`milestone-name-${index}`}
            className="block text-sm font-medium mb-1"
            style={{ color: "var(--foreground)" }}
          >
            里程碑名称
          </label>
          <input
            id={`milestone-name-${index}`}
            type="text"
            value={milestone.name}
            onChange={(e) =>
              setMilestones(milestones.map((m, i) => (i === index ? { ...m, name: e.target.value } : m)))
            }
            className="w-full rounded-lg px-3 py-2"
            style={{ border: "1.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          />
          <label
            htmlFor={`milestone-due-date-${index}`}
            className="block text-sm font-medium mb-1 mt-2"
            style={{ color: "var(--foreground)" }}
          >
            里程碑预计日期（可选）
          </label>
          <input
            id={`milestone-due-date-${index}`}
            type="date"
            value={milestone.dueDate}
            onChange={(e) =>
              setMilestones(milestones.map((m, i) => (i === index ? { ...m, dueDate: e.target.value } : m)))
            }
            className="w-full rounded-lg px-3 py-2"
            style={{ border: "1.5px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => setMilestones([...milestones, { name: "", dueDate: "" }])}
        className="text-sm mb-4"
        style={{ color: "var(--primary)" }}
      >
        + 添加里程碑
      </button>

      {error && (
        <p role="alert" className="text-sm mb-4" style={{ color: "#B3402A" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg px-4 py-2 font-semibold"
        style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        创建项目
      </button>
    </form>
  );
}
