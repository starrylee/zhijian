import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotebookPage from "../NotebookPage";
import { AuthContext } from "../../context/AuthContext";

/**
 * FT-02-US-02 项目列表与看板视图切换。
 *
 * 场景数据为 AI 草拟（待与 PO 核实）：
 * - 用户 Iris / Luna / 小雪 均为构造的 mock 用户；
 * - "搁置中"对应的 status 值草拟为 "on-hold"（四栏名称本身为 AskMe 已确认决策）。
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

function makeProject(
  id: string,
  userId: string,
  name: string,
  status: string,
  progress = 0
) {
  return {
    id,
    userId,
    patternId: "p1",
    patternName: name,
    status,
    startDate: "2026-01-01",
    yarnUsed: [],
    needleSize: "4mm",
    size: "M",
    progress,
    notes: "",
    photos: [],
    isPublished: false,
    lastUpdated: "2026-10-01",
  };
}

function renderNotebookPage(username: string, currentUser: { id: number; username: string; displayName: string; avatar: string } | null) {
  return render(
    <AuthContext.Provider
      value={{
        currentUser,
        initialized: true,
        login: async () => null,
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

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  // FT-02-US-03 起，本人页面挂载时拉取后端项目（默认空列表，不影响 mock 场景）
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
  mocks.users.length = 0;
  mocks.projects.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FT-02-US-02 项目列表与看板视图切换", () => {
  /** AC-1 示例 1：Iris 名下 3 个项目，页面加载 → 默认列表视图 + "列表 / 看板"切换器 + "列表"选中态。 */
  it("AC-1 默认列表视图与切换入口", async () => {
    mocks.users.push(makeUser("u10", "iris", "Iris"));
    mocks.projects.push(
      makeProject("proj-1", "u10", "披肩", "todo"),
      makeProject("proj-2", "u10", "毛衣", "in-progress", 40),
      makeProject("proj-3", "u10", "围巾", "on-hold")
    );

    renderNotebookPage("iris", { id: 10, username: "iris", displayName: "Iris", avatar: "" });

    // 默认列表视图：3 张项目卡片全部可见（纵向列表）
    expect(await screen.findByText("披肩")).toBeInTheDocument();
    expect(screen.getByText("毛衣")).toBeInTheDocument();
    expect(screen.getByText("围巾")).toBeInTheDocument();

    // "列表 / 看板"切换器存在，"列表"为当前选中态
    const listViewBtn = screen.getByRole("button", { name: "列表" });
    const boardViewBtn = screen.getByRole("button", { name: "看板" });
    expect(listViewBtn).toHaveAttribute("aria-pressed", "true");
    expect(boardViewBtn).toHaveAttribute("aria-pressed", "false");
  });

  /** AC-2 示例 1：Iris 名下 4 个项目覆盖四态，切到"看板" → 四栏并列，卡片落入各自状态栏。 */
  it("AC-2 四栏看板分栏展示", async () => {
    mocks.users.push(makeUser("u10", "iris", "Iris"));
    mocks.projects.push(
      makeProject("proj-1", "u10", "披肩", "todo"),
      makeProject("proj-2", "u10", "毛衣", "in-progress", 40),
      makeProject("proj-3", "u10", "围巾", "on-hold"),
      makeProject("proj-4", "u10", "圣诞袜", "completed", 100)
    );

    renderNotebookPage("iris", { id: 10, username: "iris", displayName: "Iris", avatar: "" });

    await userEvent.click(screen.getByRole("button", { name: "看板" }));

    // 四栏并列展示
    const boardColumns = screen.getAllByTestId("board-column");
    expect(boardColumns).toHaveLength(4);

    // 每个项目卡片落入其状态对应的栏（栏标题为 h3，区别于卡片内状态标签 span）
    function boardColumnOf(title: string) {
      return within(
        screen.getByText(title, { selector: "h3" }).closest('[data-testid="board-column"]') as HTMLElement
      );
    }
    expect(boardColumnOf("待开始").getByText("披肩")).toBeInTheDocument();
    expect(boardColumnOf("进行中").getByText("毛衣")).toBeInTheDocument();
    expect(boardColumnOf("搁置中").getByText("围巾")).toBeInTheDocument();
    expect(boardColumnOf("已完成").getByText("圣诞袜")).toBeInTheDocument();
  });

  /** AC-4 示例 1：新用户小雪名下无项目 → 空态引导提示 + 新建入口，非空白页。 */
  it("AC-4 空状态引导", async () => {
    // 小雪为后端新注册用户，不在 mock user-list 中，走当前登录用户兜底渲染
    renderNotebookPage("xiaoxue", { id: 30, username: "xiaoxue", displayName: "小雪", avatar: "" });

    // 空态提示（非空白页）
    expect(await screen.findByText("还没有编织项目")).toBeInTheDocument();
    // 引导创建入口存在
    expect(screen.getByRole("button", { name: "新建项目" })).toBeInTheDocument();
  });

  /** AC-3 示例 1（防护性）：Iris 与 Luna 各有名下项目，Iris 视图中不出现 Luna 的"贝雷帽"。 */
  it("AC-3 仅展示本人项目（列表与看板均不出现他人项目）", async () => {
    mocks.users.push(
      makeUser("u10", "iris", "Iris"),
      makeUser("u20", "luna", "Luna")
    );
    mocks.projects.push(
      makeProject("proj-1", "u10", "披肩", "todo"),
      makeProject("proj-2", "u10", "毛衣", "in-progress", 40),
      makeProject("proj-3", "u20", "贝雷帽", "completed", 100)
    );

    renderNotebookPage("iris", { id: 10, username: "iris", displayName: "Iris", avatar: "" });

    // 列表视图：仅 Iris 的项目
    expect(await screen.findByText("披肩")).toBeInTheDocument();
    expect(screen.getByText("毛衣")).toBeInTheDocument();
    expect(screen.queryByText("贝雷帽")).not.toBeInTheDocument();

    // 看板视图：仍仅 Iris 的项目
    await userEvent.click(screen.getByRole("button", { name: "看板" }));
    expect(screen.getByText("披肩")).toBeInTheDocument();
    expect(screen.getByText("毛衣")).toBeInTheDocument();
    expect(screen.queryByText("贝雷帽")).not.toBeInTheDocument();
  });
});
