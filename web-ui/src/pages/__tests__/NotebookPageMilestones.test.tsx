import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotebookPage from "../NotebookPage";
import { AuthContext } from "../../context/AuthContext";

/**
 * FT-02-US-04 里程碑管理（前端 UI）。
 *
 * 场景数据为 AI 草拟（待与 PO 核实）：Iris / 项目"毛衣" / 里程碑"织前片"等。
 * 走后端真实项目路径（FT-02-US-03 起 backendProjects 为本人项目数据源）。
 */

const mocks = vi.hoisted(() => ({
  users: [] as Record<string, unknown>[],
  projects: [] as Record<string, unknown>[],
}));

vi.mock("../../data/user-list.json", () => ({ default: mocks.users }));
vi.mock("../../data/project-list.json", () => ({ default: mocks.projects }));

function makeUser(id: string, username: string, displayName: string) {
  return {
    id,
    username,
    password: "x",
    displayName,
    avatar: "",
    location: "",
    bio: "",
    joinedDate: "2026-01-01",
    following: [],
    followers: [],
    projectCount: 0,
    queueCount: 0,
    stashCount: 0,
  };
}

interface BackendMilestone {
  id: number;
  name: string;
  dueDate?: string;
  completed: boolean;
}

function makeBackendProject(
  id: number,
  name: string,
  milestones: BackendMilestone[],
  status = "in-progress"
) {
  return {
    id,
    name,
    dueDate: "2026-12-24",
    status,
    isPublic: false,
    milestones,
    createdAt: "2026-10-01T00:00:00Z",
    lastActiveAt: "2026-10-01T00:00:00Z",
  };
}

/** 会话内存存储：模拟后端项目（含里程碑）的读写。 */
const backendStore = vi.hoisted(() => ({ projects: [] as Record<string, unknown>[] }));

function installFetchMock() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url === "/api/v1/projects" && method === "GET") {
        return { ok: true, status: 200, json: async () => backendStore.projects } as Response;
      }
      if (url === "/api/v1/projects" && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const project = makeBackendProject(
          (backendStore.projects.at(-1) as { id: number } | undefined)?.id !== undefined
            ? (backendStore.projects.at(-1) as { id: number }).id + 1
            : 1,
          body.name,
          (body.milestones ?? []).map((m: { name: string; dueDate?: string }, i: number) => ({
            id: i + 1,
            name: m.name,
            dueDate: m.dueDate,
            completed: false,
          }))
        );
        backendStore.projects.push(project);
        return { ok: true, status: 201, json: async () => project } as Response;
      }
      const addMatch = url.match(/^\/api\/v1\/projects\/(\d+)\/milestones$/);
      if (addMatch && method === "POST") {
        const body = JSON.parse(String(init?.body));
        const project = backendStore.projects.find(
          (p) => (p as { id: number }).id === Number(addMatch[1])
        ) as unknown as {
          id: number;
          milestones: BackendMilestone[];
        };
        const milestone: BackendMilestone = {
          id: project.milestones.length + 1,
          name: body.name,
          completed: false,
        };
        if (body.dueDate) milestone.dueDate = body.dueDate;
        project.milestones.push(milestone);
        return { ok: true, status: 201, json: async () => project } as unknown as Response;
      }
      const editMatch = url.match(/^\/api\/v1\/projects\/(\d+)\/milestones\/(\d+)$/);
      if (editMatch && method === "PATCH") {
        const body = JSON.parse(String(init?.body));
        const project = backendStore.projects.find(
          (p) => (p as { id: number }).id === Number(editMatch[1])
        ) as unknown as { id: number; milestones: BackendMilestone[] };
        const milestone = project.milestones.find((m) => m.id === Number(editMatch[2]))!;
        milestone.name = body.name;
        milestone.dueDate = body.dueDate;
        return { ok: true, status: 200, json: async () => project } as unknown as Response;
      }
      const completeMatch = url.match(/^\/api\/v1\/projects\/(\d+)\/milestones\/(\d+)\/completed$/);
      if (completeMatch && method === "PATCH") {
        const body = JSON.parse(String(init?.body));
        const project = backendStore.projects.find(
          (p) => (p as { id: number }).id === Number(completeMatch[1])
        ) as unknown as { id: number; milestones: BackendMilestone[] };
        const milestone = project.milestones.find((m) => m.id === Number(completeMatch[2]))!;
        milestone.completed = body.completed;
        return { ok: true, status: 200, json: async () => project } as unknown as Response;
      }
      const deleteMatch = url.match(/^\/api\/v1\/projects\/(\d+)\/milestones\/(\d+)$/);
      if (deleteMatch && method === "DELETE") {
        const project = backendStore.projects.find(
          (p) => (p as { id: number }).id === Number(deleteMatch[1])
        ) as unknown as { id: number; milestones: BackendMilestone[] };
        project.milestones = project.milestones.filter((m) => m.id !== Number(deleteMatch[2]));
        return { ok: true, status: 200, json: async () => project } as unknown as Response;
      }
      throw new Error(`fetch mock 未实现: ${method} ${url}`);
    })
  );
}

function renderNotebookPage(username: string) {
  return render(
    <AuthContext.Provider
      value={{
        currentUser: { id: 10, username, displayName: username, avatar: "" },
        initialized: true,
        login: async () => null,
      register: async () => ({ error: "未实现" }),
        logout: async () => {},
      }}
    >
      <MemoryRouter initialEntries={[`/users/${username}?tab=projects`]}>
        <Routes>
          <Route path="/users/:username" element={<NotebookPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  mocks.users.length = 0;
  mocks.projects.length = 0;
  backendStore.projects.length = 0;
  mocks.users.push(makeUser("u10", "iris", "Iris"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FT-02-US-04 里程碑管理（前端）", () => {
  /** AC-1 示例 1：Iris 的项目"毛衣"（无里程碑）→ 添加"织前片"（预计日期 2026-10-15）→ 出现且未完成。 */
  it("AC-1 添加里程碑（名称+预计日期）追加显示为未完成", async () => {
    backendStore.projects.push(makeBackendProject(1, "毛衣", []));
    installFetchMock();
    renderNotebookPage("iris");

    await userEvent.click(await screen.findByRole("button", { name: "看板" }));
    const column = await screen.findByText("毛衣", { selector: "h3" })
      .then((el) => el.closest('[data-testid="board-column"]') as HTMLElement);

    // 添加里程碑：名称"织前片"、预计日期 2026-10-15
    await userEvent.click(within(column).getByRole("button", { name: "添加里程碑" }));
    await userEvent.type(within(column).getByLabelText("里程碑名称"), "织前片");
    await userEvent.type(within(column).getByLabelText("预计日期"), "2026-10-15");
    await userEvent.click(within(column).getByRole("button", { name: "保存" }));

    // 出现"织前片"，显示为未完成
    const milestoneItem = await within(column).findByText("织前片");
    expect(milestoneItem).toBeInTheDocument();
    expect(within(milestoneItem.closest("li") as HTMLElement).getByText("未完成")).toBeInTheDocument();
    // 日期一并展示（格式：名称（日期）——对齐 AC-2 示例的"织两只袖子（2026-11-01）"展示口径）
    expect(within(milestoneItem.closest("li") as HTMLElement).getByText("（2026-10-15）")).toBeInTheDocument();

    // 请求契约：POST /api/v1/projects/1/milestones {name, dueDate}
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/v1/projects/1/milestones",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "织前片", dueDate: "2026-10-15" }),
        })
      );
    });
  });

  /** AC-1 示例 2：已有"织前片"→ 再添加"织袖子"（不填日期）→ 按创建顺序显示两条。 */
  it("AC-1 再添加（不填日期）按创建顺序追加", async () => {
    backendStore.projects.push(
      makeBackendProject(1, "毛衣", [{ id: 1, name: "织前片", dueDate: "2026-10-15", completed: false }])
    );
    installFetchMock();
    renderNotebookPage("iris");

    await userEvent.click(await screen.findByRole("button", { name: "看板" }));
    const column = await screen.findByText("毛衣", { selector: "h3" })
      .then((el) => el.closest('[data-testid="board-column"]') as HTMLElement);

    await userEvent.click(within(column).getByRole("button", { name: "添加里程碑" }));
    await userEvent.type(within(column).getByLabelText("里程碑名称"), "织袖子");
    await userEvent.click(within(column).getByRole("button", { name: "保存" }));

    // 按创建顺序显示"织前片"、"织袖子"（li 顺序即创建顺序）
    const items = await within(column).findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("织前片");
    expect(items[1]).toHaveTextContent("织袖子");

    // 请求契约：不填日期 → body 仅 name
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/v1/projects/1/milestones",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "织袖子" }),
        })
      );
    });
  });

  /** AC-2 示例 1："织袖子"（无日期）→ 改名"织两只袖子"+ 补日期 2026-11-01 → 顺序不变。 */
  it("AC-2 编辑名称与日期后顺序保持不变", async () => {
    backendStore.projects.push(
      makeBackendProject(1, "毛衣", [
        { id: 1, name: "织前片", dueDate: "2026-10-15", completed: false },
        { id: 2, name: "织袖子", completed: false },
      ])
    );
    installFetchMock();
    renderNotebookPage("iris");

    await userEvent.click(await screen.findByRole("button", { name: "看板" }));
    const column = await screen.findByText("毛衣", { selector: "h3" })
      .then((el) => el.closest('[data-testid="board-column"]') as HTMLElement);

    // 进入"织袖子"编辑态
    await userEvent.click(within(column).getByRole("button", { name: "编辑 织袖子" }));
    await userEvent.clear(within(column).getByLabelText("里程碑名称"));
    await userEvent.type(within(column).getByLabelText("里程碑名称"), "织两只袖子");
    await userEvent.type(within(column).getByLabelText("预计日期"), "2026-11-01");
    await userEvent.click(within(column).getByRole("button", { name: "保存" }));

    // 显示"织两只袖子（2026-11-01）"，仍排"织前片"之后
    const items = await within(column).findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("织前片");
    expect(items[1]).toHaveTextContent("织两只袖子");
    expect(items[1]).toHaveTextContent("（2026-11-01）");

    // 请求契约：PATCH .../milestones/2 {name, dueDate}
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/v1/projects/1/milestones/2",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "织两只袖子", dueDate: "2026-11-01" }),
        })
      );
    });
  });

  /** AC-3 示例 1：“织前片”未完成 → 点击“完成该里程碑” → 显示已完成标识。 */
  it("AC-3 点击完成该里程碑后显示已完成", async () => {
    backendStore.projects.push(
      makeBackendProject(1, "毛衣", [{ id: 1, name: "织前片", dueDate: "2026-10-15", completed: false }])
    );
    installFetchMock();
    renderNotebookPage("iris");

    await userEvent.click(await screen.findByRole("button", { name: "看板" }));
    const column = await screen.findByText("毛衣", { selector: "h3" })
      .then((el) => el.closest('[data-testid="board-column"]') as HTMLElement);

    expect(within(column).getByText("未完成")).toBeInTheDocument();
    await userEvent.click(within(column).getByRole("button", { name: "完成该里程碑 织前片" }));

    // 变为已完成（显示完成标识）
    const item = await within(column).findByText("织前片").then((el) => el.closest("li") as HTMLElement);
    await waitFor(() => {
      expect(within(item).getByText("已完成")).toBeInTheDocument();
      expect(within(item).queryByText("未完成")).not.toBeInTheDocument();
    });

    // 请求契约：PATCH .../milestones/1/completed {completed:true}
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/v1/projects/1/milestones/1/completed",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ completed: true }),
        })
      );
    });
  });

  /** AC-4 示例 1：删除中间的“织袖子” → 剩余“织前片”、“缝合”，仍按原顺序。 */
  it("AC-4 删除中间里程碑后剩余保持原顺序", async () => {
    backendStore.projects.push(
      makeBackendProject(1, "毛衣", [
        { id: 1, name: "织前片", completed: false },
        { id: 2, name: "织袖子", completed: false },
        { id: 3, name: "缝合", completed: false },
      ])
    );
    installFetchMock();
    renderNotebookPage("iris");

    await userEvent.click(await screen.findByRole("button", { name: "看板" }));
    const column = await screen.findByText("毛衣", { selector: "h3" })
      .then((el) => el.closest('[data-testid="board-column"]') as HTMLElement);

    await userEvent.click(within(column).getByRole("button", { name: "删除 织袖子" }));

    const items = await waitFor(() => {
      const list = within(column).getAllByRole("listitem");
      expect(list).toHaveLength(2);
      return list;
    });
    expect(items[0]).toHaveTextContent("织前片");
    expect(items[1]).toHaveTextContent("缝合");
    expect(within(column).queryByText("织袖子")).not.toBeInTheDocument();

    // 请求契约：DELETE .../milestones/2
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/v1/projects/1/milestones/2",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  /** AC-5 示例 1：名称留空、日期 2026-12-20 → 提示“里程碑名称必填”，未添加（不发请求）。 */
  it("AC-5 名称留空保存提示必填且未添加", async () => {
    backendStore.projects.push(makeBackendProject(1, "毛衣", []));
    installFetchMock();
    renderNotebookPage("iris");

    await userEvent.click(await screen.findByRole("button", { name: "看板" }));
    const column = await screen.findByText("毛衣", { selector: "h3" })
      .then((el) => el.closest('[data-testid="board-column"]') as HTMLElement);

    await userEvent.click(within(column).getByRole("button", { name: "添加里程碑" }));
    await userEvent.type(within(column).getByLabelText("预计日期"), "2026-12-20");
    await userEvent.click(within(column).getByRole("button", { name: "保存" }));

    // 提示“里程碑名称必填”
    expect(await within(column).findByText("里程碑名称必填")).toBeInTheDocument();
    // 里程碑未添加（无列表项）
    expect(within(column).queryAllByRole("listitem")).toHaveLength(0);
    // 防护性反例：未发出任何 POST 请求
    expect(
      vi.mocked(fetch).mock.calls.filter(([url, init]) =>
        String(url).endsWith("/milestones") && init?.method === "POST"
      )
    ).toHaveLength(0);
  });

  /** AC-6 示例 1：“织前片”误点为已完成 → 点击取消完成 → 恢复未完成。 */
  it("AC-6 取消完成恢复未完成状态", async () => {
    backendStore.projects.push(
      makeBackendProject(1, "毛衣", [{ id: 1, name: "织前片", completed: true }])
    );
    installFetchMock();
    renderNotebookPage("iris");

    await userEvent.click(await screen.findByRole("button", { name: "看板" }));
    const column = await screen.findByText("毛衣", { selector: "h3" })
      .then((el) => el.closest('[data-testid="board-column"]') as HTMLElement);

    expect(within(column).getByText("已完成")).toBeInTheDocument();
    await userEvent.click(within(column).getByRole("button", { name: "取消完成 织前片" }));

    const item = await within(column).findByText("织前片").then((el) => el.closest("li") as HTMLElement);
    await waitFor(() => {
      expect(within(item).getByText("未完成")).toBeInTheDocument();
      expect(within(item).queryByText("已完成")).not.toBeInTheDocument();
    });

    // 请求契约：PATCH .../milestones/1/completed {completed:false}
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/v1/projects/1/milestones/1/completed",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ completed: false }),
        })
      );
    });
  });
});
