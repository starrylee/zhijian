import { useState, useEffect } from "react";
import { useParams, Navigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginModal from "../components/LoginModal";
import NewProjectForm, { CreatedProject } from "../components/NewProjectForm";
import ProjectMilestones, { MilestoneItem } from "../components/ProjectMilestones";
import users from "../data/user-list.json";
import projectsData from "../data/project-list.json";
import yarnData from "../data/yarn-stash-list.json";
import patterns from "../data/pattern-list.json";
import forumPosts from "../data/forum-post-list.json";

type Tab = "projects" | "queue" | "stash" | "following";

// FT-02-US-02：视图切换（默认列表，不记忆上次选择——AskMe 决策 1 衍生小项）
type ViewMode = "list" | "board";

// FT-02-US-02 四栏看板状态口径（四栏名称为 AskMe 已确认决策；
// "搁置中"的 status 值草拟为 "on-hold"，TODO: AI 草拟，待与 PO 核实）
const statusLabels: Record<string, string> = {
  "in-progress": "进行中",
  completed: "已完成",
  queued: "队列中",
  todo: "待开始",
  "on-hold": "搁置中",
};
const statusColors: Record<string, string> = {
  "in-progress": "#C9973A",
  completed: "#4E7251",
  queued: "#7A6655",
  todo: "#8B7355",
  "on-hold": "#6B5B7A",
};

export default function NotebookPage() {
  const { username } = useParams<{ username: string }>();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) || "projects");
  const [newProjectPatternId, setNewProjectPatternId] = useState<string | null>(
    searchParams.get("new")
  );
  // FT-02-US-01：新建项目入口（已登录开表单，未登录引导登录后续接）
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showLoginForCreate, setShowLoginForCreate] = useState(false);
  const [createdProjects, setCreatedProjects] = useState<CreatedProject[]>([]);
  // FT-02-US-02：项目 Tab 视图切换（默认列表视图）
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // FT-02-US-03：本人后端项目（状态切换的持久化载体，看板拖拽数据源）
  interface BackendProject {
    id: number;
    name: string;
    dueDate: string;
    status: string;
    isPublic: boolean;
    milestones: MilestoneItem[];
    createdAt: string;
    lastActiveAt: string;
  }
  const [backendProjects, setBackendProjects] = useState<BackendProject[]>([]);
  const [draggingProjectId, setDraggingProjectId] = useState<number | null>(null);
  const [statusSwitchError, setStatusSwitchError] = useState<string | null>(null);

  // FT-01 兜底（PO 裁定 2026-09-07）：后端真实账号（种子 zhinv / 新注册用户）不在 mock
  // user-list.json 中，个人页以当前登录用户的身份兜底渲染，项目/库存等列表自然为空，
  // 展示空状态即可（匹配大小写不敏感，对齐 FT-01 决策 1/4 口径）。
  // FT-02 阶段 8 数据源切换（import json → fetch）后本兜底退役。
  const fallbackUser: (typeof users)[number] | null =
    currentUser && username && currentUser.username.toLowerCase() === username.toLowerCase()
      ? {
          id: String(currentUser.id), // mock 项目按 "u1" 格式 userId 过滤，数字 id 字符串不会误匹配
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatar: currentUser.avatar,
          password: "", // mock 类型兼容占位，不参与渲染
          location: "",
          bio: "",
          joinedDate: "",
          following: [],
          followers: [],
          projectCount: 0,
          queueCount: 0,
          stashCount: 0,
        }
      : null;

  const pageUser = users.find((u) => u.username === username) ?? fallbackUser;
  if (!pageUser) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: "Lora, serif" }}>找不到该用户</h2>
        <Link to="/" style={{ color: "var(--primary)" }}>← 返回首页</Link>
      </div>
    );
  }

  // FT-01-US-02: 登录态改由后端会话供给（id 为 number 自增），mock 数据仍为字符串 id
  // 体系——owner 判定用 username（两个世界一致的主键）保持行为不变
  const isOwner = currentUser?.username === pageUser.username;

  // FT-02-US-03：本人后端项目（状态切换的持久化载体，看板拖拽数据源）
  useEffect(() => {
    if (!isOwner) {
      return;
    }
    let cancelled = false;
    fetch("/api/v1/projects")
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json();
        if (!cancelled) setBackendProjects(Array.isArray(body) ? body : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  // FT-02-US-03 AC-1/AC-2：拖拽落栏 → PATCH 状态（4×4 自由互切）
  function handleDropOnColumn(status: string) {
    const projectId = draggingProjectId;
    setDraggingProjectId(null);
    if (projectId == null) return;
    fetch(`/api/v1/projects/${projectId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setStatusSwitchError(body?.message ?? "状态切换失败，请稍后重试");
          return;
        }
        setStatusSwitchError(null);
        setBackendProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, status } : p))
        );
      })
      .catch(() => setStatusSwitchError("网络异常，请稍后重试"));
  }

  // FT-02-US-01 AC-5：未登录点击入口 → 登录弹窗（成功后续接打开表单）
  function handleCreateEntryClick() {
    if (currentUser) {
      setShowCreateForm(true);
    } else {
      setShowLoginForCreate(true);
    }
  }
  const userProjects = projectsData.filter((p) => p.userId === pageUser.id);
  const todo = userProjects.filter((p) => p.status === "todo");
  const inProgress = userProjects.filter((p) => p.status === "in-progress");
  const onHold = userProjects.filter((p) => p.status === "on-hold");
  const completed = userProjects.filter((p) => p.status === "completed");
  const userStash = yarnData.filter((y) => y.userId === pageUser.id);
  const followingUsers = users.filter((u) => pageUser.following.includes(u.id));

  // 队列 mock 数据按用户过滤（featuredInQueue 字段），与项目/库存口径一致；
  // 后端新注册用户（数字 id）不在 mock 数据中，队列自然为空（对齐 FT-01 兜底口径）
  const queuePatterns = patterns.filter((p) =>
    (p as { featuredInQueue?: string[] }).featuredInQueue?.includes(pageUser.id)
  );

  // FT-02-US-02：四栏看板分栏口径（顺序 = 待开始 → 进行中 → 搁置中 → 已完成）
  const boardColumns: [string, string, typeof userProjects][] = [
    ["todo", "待开始", todo],
    ["in-progress", "进行中", inProgress],
    ["on-hold", "搁置中", onHold],
    ["completed", "已完成", completed],
  ];
  const followingActivity = forumPosts
    .filter((post) => followingUsers.some((u) => u.id === post.authorId))
    .slice(0, 5);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "projects", label: "项目", count: userProjects.length },
    { id: "queue", label: "队列", count: queuePatterns.length },
    { id: "stash", label: "纱线库存", count: userStash.length },
    { id: "following", label: "关注动态", count: followingUsers.length },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Profile Header */}
      <div
        className="py-10 relative overflow-hidden"
        style={{ background: "var(--foreground)" }}
      >
        <div
          className="absolute inset-0 opacity-10 bg-center bg-cover"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=1200&h=400&fit=crop&auto=format')" }}
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-start gap-5">
            <img
              src={pageUser.avatar}
              alt={pageUser.displayName}
              className="w-20 h-20 rounded-full object-cover shrink-0"
              style={{ border: "3px solid rgba(247,241,232,0.3)" }}
            />
            <div className="flex-1 min-w-0">
              <h1
                className="text-2xl sm:text-3xl font-bold mb-0.5"
                style={{ fontFamily: "Lora, serif", color: "#F7F1E8" }}
              >
                {pageUser.displayName}
              </h1>
              <p className="text-sm mb-2" style={{ color: "#9E8878" }}>
                @{pageUser.username}
                {pageUser.location && <> · 📍 {pageUser.location}</>}
              </p>
              {pageUser.bio && (
                <p className="text-sm max-w-xl leading-relaxed" style={{ color: "#C8B99E" }}>
                  {pageUser.bio}
                </p>
              )}
              <div className="flex gap-5 mt-4 text-sm">
                {[
                  ["项目", pageUser.projectCount],
                  ["收藏", pageUser.queueCount],
                  ["库存纱线", pageUser.stashCount],
                  ["关注者", pageUser.followers.length],
                ].map(([label, count]) => (
                  <div key={label as string}>
                    <span className="font-bold" style={{ color: "#F7F1E8" }}>{count}</span>
                    <span className="ml-1" style={{ color: "#9E8878" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {pageUser.joinedDate && (
            <p className="mt-3 text-xs" style={{ color: "#6B5040" }}>
              加入时间：{new Date(pageUser.joinedDate).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="sticky top-16 z-30"
        style={{ background: "var(--card)", borderBottom: "1.5px solid var(--border)" }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
                style={{
                  borderColor: tab === t.id ? "var(--primary)" : "transparent",
                  color: tab === t.id ? "var(--primary)" : "var(--muted-foreground)",
                }}
              >
                {t.label}
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: tab === t.id ? "var(--primary)" : "var(--muted)",
                    color: tab === t.id ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {tab === "projects" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              {/* FT-02-US-02：列表 / 看板视图切换器（默认列表，不记忆上次选择） */}
              <div
                className="flex rounded-lg p-1"
                role="group"
                aria-label="视图切换"
                style={{ background: "var(--muted)" }}
              >
                {([
                  ["list", "列表"],
                  ["board", "看板"],
                ] as [ViewMode, string][]).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                    className="px-3 py-1.5 text-sm font-medium rounded-md"
                    style={{
                      background: viewMode === mode ? "var(--card)" : "transparent",
                      color: viewMode === mode ? "var(--primary)" : "var(--muted-foreground)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCreateEntryClick}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                新建项目
              </button>
            </div>
            {showCreateForm && (
              <div
                className="rounded-xl p-6 mb-6"
                style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}
              >
                <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
                  新建项目
                </h2>
                <NewProjectForm
                  onSuccess={(project) => {
                    setCreatedProjects((prev) => [project, ...prev]);
                    setShowCreateForm(false);
                  }}
                />
              </div>
            )}
            {viewMode === "board" ? (
              /* FT-02-US-02 AC-2：四栏看板，每个项目卡片落入其状态对应的栏 */
              <div>
              {statusSwitchError && (
                <p role="alert" className="text-sm mb-4" style={{ color: "#B3402A" }}>
                  {statusSwitchError}
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
                {boardColumns.map(([status, label, columnProjects]) => (
                  <div
                    key={status}
                    data-testid="board-column"
                    className="rounded-xl p-3"
                    style={{ background: "var(--muted)" }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOnColumn(status)}
                  >
                    <h3
                      className="text-sm font-bold mb-3"
                      style={{ color: "var(--foreground)" }}
                    >
                      {label}
                    </h3>
                    <div className="space-y-3">
                      {columnProjects.map((proj) => (
                        <ProjectCard key={proj.id} project={proj} isOwner={isOwner} />
                      ))}
                      {/* FT-02-US-03：本人后端项目卡片（可拖拽切换状态） */}
                      {backendProjects
                        .filter((p) => p.status === status)
                        .map((p) => (
                          <div
                            key={p.id}
                            draggable
                            onDragStart={() => setDraggingProjectId(p.id)}
                            onDragEnd={() => setDraggingProjectId(null)}
                            className="rounded-xl p-4 cursor-grab"
                            style={{
                              background: "var(--card)",
                              border: "1.5px solid var(--border)",
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h3
                                className="font-bold text-base"
                                style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}
                              >
                                {p.name}
                              </h3>
                              <StatusPill status={p.status} />
                            </div>
                            {/* FT-02-US-04：里程碑管理（本人项目专属） */}
                            {isOwner && (
                              <ProjectMilestones
                                project={p}
                                onProjectUpdated={(updated) =>
                                  setBackendProjects((prev) =>
                                    prev.map((item) =>
                                      item.id === updated.id ? { ...item, ...updated } : item
                                    )
                                  )
                                }
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            ) : (
              <>
            {(createdProjects.length > 0 || todo.length > 0) && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
                  待开始
                </h2>
                <div className="space-y-4">
                  {todo.map((proj) => <ProjectCard key={proj.id} project={proj} isOwner={isOwner} />)}
                  {createdProjects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-xl p-4 flex items-center justify-between"
                      style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}
                    >
                      <h3 className="font-bold text-base" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
                        {project.name}
                      </h3>
                      <StatusPill status="todo" />
                    </div>
                  ))}
                </div>
              </section>
            )}
            {newProjectPatternId && (
              <NewProjectBanner
                patternId={newProjectPatternId}
                onDismiss={() => setNewProjectPatternId(null)}
              />
            )}
            {inProgress.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
                  进行中的项目
                </h2>
                <div className="space-y-4">
                  {inProgress.map((proj) => <ProjectCard key={proj.id} project={proj} isOwner={isOwner} />)}
                </div>
              </section>
            )}
            {onHold.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
                  搁置中
                </h2>
                <div className="space-y-4">
                  {onHold.map((proj) => <ProjectCard key={proj.id} project={proj} isOwner={isOwner} />)}
                </div>
              </section>
            )}
            {completed.length > 0 && (
              <section>
                <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
                  已完成
                </h2>
                <div className="space-y-4">
                  {completed.map((proj) => <ProjectCard key={proj.id} project={proj} isOwner={isOwner} />)}
                </div>
              </section>
            )}
            {createdProjects.length === 0 && userProjects.length === 0 && (
              /* FT-02-US-02 AC-4：空状态引导（非空白页），创建入口见上方"新建项目"按钮 */
              <div
                className="rounded-xl p-8 text-center"
                style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}
              >
                <p className="text-base font-bold mb-1" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
                  还没有编织项目
                </p>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  点击右上角"新建项目"，开始你的第一件作品吧。
                </p>
              </div>
            )}
              </>
            )}
          </div>
        )}

        {tab === "queue" && (
          <div>
            <h2 className="text-xl font-bold mb-6" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
              项目队列 — 想做但尚未开始
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {queuePatterns.map((pattern) => (
                <Link
                  key={pattern.id}
                  to={`/patterns/${pattern.id}`}
                  className="group block rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                  style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}
                >
                  <img
                    src={pattern.image}
                    alt={pattern.name}
                    className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="p-3">
                    <h3 className="font-bold text-sm mb-0.5" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
                      {pattern.name}
                    </h3>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>by {pattern.designer}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {tab === "stash" && (
          <div>
            <h2 className="text-xl font-bold mb-6" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
              纱线库存
            </h2>
            <div className="grid gap-3">
              {userStash.map((yarn) => (
                <div
                  key={yarn.id}
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}
                >
                  <div
                    className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-xl"
                    style={{ background: yarn.colorway + "33", border: `3px solid ${yarn.colorway}` }}
                  >
                    🧶
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                          {yarn.brand} · {yarn.line}
                        </h3>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {yarn.colorName} · {yarn.weight} · {yarn.fiber}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                          {yarn.gramsRemaining}g 剩余
                        </p>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {yarn.skeinsOwned} 绞共购
                        </p>
                      </div>
                    </div>
                    {yarn.notes && (
                      <p className="text-xs mt-1.5 line-clamp-1" style={{ color: "var(--muted-foreground)" }}>
                        {yarn.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "following" && (
          <div>
            <div className="flex gap-6 mb-8">
              {followingUsers.map((u) => (
                <Link
                  key={u.id}
                  to={`/users/${u.username}`}
                  className="flex flex-col items-center gap-2 group"
                >
                  <img
                    src={u.avatar}
                    alt={u.displayName}
                    className="w-14 h-14 rounded-full object-cover"
                    style={{ border: "2.5px solid var(--border)" }}
                  />
                  <span className="text-xs font-medium text-center" style={{ color: "var(--foreground)" }}>
                    {u.displayName}
                  </span>
                </Link>
              ))}
            </div>

            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
              关注的动态
            </h2>
            {followingActivity.length > 0 ? (
              <div className="space-y-4">
                {followingActivity.map((post) => {
                  const author = users.find((u) => u.id === post.authorId);
                  return (
                    <div
                      key={post.id}
                      className="p-4 rounded-xl"
                      style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <img
                          src={author?.avatar}
                          alt={author?.displayName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                            {author?.displayName}
                          </p>
                          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>{post.title}</p>
                      <p className="text-xs line-clamp-2" style={{ color: "var(--muted-foreground)" }}>{post.content}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>暂无动态</p>
            )}
          </div>
        )}
      </div>

      {showLoginForCreate && (
        <LoginModal
          onClose={() => setShowLoginForCreate(false)}
          onSuccess={() => setShowCreateForm(true)}
        />
      )}
    </div>
  );
}

/** FT-02-US-03 重构提取：状态 pill（文案 + 三段式配色），三处卡片共用。 */
function StatusPill({ status }: { status: string }) {
  const color = statusColors[status];
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {statusLabels[status]}
    </span>
  );
}

function ProjectCard({ project, isOwner }: { project: (typeof projectsData)[number]; isOwner: boolean }) {
  const pattern = patterns.find((p) => p.id === project.patternId);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}
    >
      <div className="flex gap-0">
        {project.photos[0] && (
          <div className="w-28 sm:w-36 shrink-0">
            <img
              src={project.photos[0]}
              alt={project.patternName}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3
              className="font-bold text-base"
              style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}
            >
              {project.patternName}
            </h3>
            <StatusPill status={project.status} />
          </div>
          <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
            尺码: {project.size} · 针号: {project.needleSize}
          </p>

          {project.status === "in-progress" && (
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                <span>进度</span>
                <span>{project.progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
          )}

          {project.notes && (
            <p className="text-xs line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
              {project.notes}
            </p>
          )}

          <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
            最近更新: {new Date(project.lastUpdated).toLocaleDateString("zh-CN")}
            {project.isPublished && (
              <span className="ml-2" style={{ color: "var(--secondary)" }}>✓ 已发布到画廊</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function NewProjectBanner({ patternId, onDismiss }: { patternId: string; onDismiss: () => void }) {
  const pattern = patterns.find((p) => p.id === patternId);
  if (!pattern) return null;

  return (
    <div
      className="rounded-xl p-5 mb-6 relative"
      style={{ background: "#FDE8D8", border: "1.5px solid #F4C9B8" }}
    >
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-xl leading-none opacity-50 hover:opacity-100"
      >
        ×
      </button>
      <h3 className="font-bold mb-1" style={{ fontFamily: "Lora, serif", color: "var(--primary)" }}>
        ✨ 开始新项目：{pattern.name}
      </h3>
      <p className="text-sm" style={{ color: "#8B3A2A" }}>
        请前往图案详情页或在下方记录你的项目信息。当前演示版本以本地数据模拟项目创建。
      </p>
    </div>
  );
}
