import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotebookPage from "../NotebookPage";
import { AuthContext } from "../../context/AuthContext";

/**
 * FT-02-US-03 项目状态四栏切换（前端拖拽）。
 *
 * 场景数据为 AI 草拟（待与 PO 核实）；
 * 持久化载体 = 后端 GET/POST/PATCH /api/v1/projects（本人后端项目）。
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

function makeBackendProject(id: number, name: string, status: string) {
  return {
    id,
    name,
    dueDate: "2026-12-24",
    status,
    isPublic: false,
    milestones: [],
    createdAt: "2026-10-01T00:00:00Z",
    lastActiveAt: "2026-10-01T00:00:00Z",
  };
}

function renderNotebookPage(
  username: string,
  currentUser: { id: number; username: string; displayName: string; avatar: string }
) {
  return render(
    <AuthContext.Provider
      value={{
        currentUser,
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

function boardColumnElement(title: string) {
  return screen.getByText(title, { selector: "h3" }).closest(
    '[data-testid="board-column"]'
  ) as HTMLElement;
}

function boardColumnOf(title: string) {
  return within(boardColumnElement(title));
}

/** 模拟 HTML5 拖拽：卡片 dragStart → 目标栏 drop。 */
function dragCardToColumn(cardTitle: string, columnTitle: string) {
  const card = screen.getByText(cardTitle).closest('[draggable="true"]') as HTMLElement;
  fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn() } });
  const column = boardColumnElement(columnTitle);
  fireEvent.dragOver(column, { dataTransfer: {} });
  fireEvent.drop(column, { dataTransfer: {} });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  mocks.users.length = 0;
  mocks.projects.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FT-02-US-03 看板拖拽切换状态", () => {
  /** AC-1 示例 1：看板"祖母的生日披肩"待开始 → 拖到"进行中" → 落入新栏 + PATCH 提交。 */
  it("拖动待开始卡片到进行中栏，状态切换并提交", async () => {
    mocks.users.push(makeUser("u10", "iris", "Iris"));
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/v1/projects" && (!init || init.method === undefined || init.method === "GET")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [makeBackendProject(101, "祖母的生日披肩", "todo")],
        } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
    });

    renderNotebookPage("iris", { id: 10, username: "iris", displayName: "Iris", avatar: "" });

    await userEvent.click(await screen.findByRole("button", { name: "看板" }));

    // Given：卡片位于"待开始"栏
    expect(boardColumnOf("待开始").getByText("祖母的生日披肩")).toBeInTheDocument();

    // When：拖动到"进行中"栏
    dragCardToColumn("祖母的生日披肩", "进行中");

    // Then：PATCH 提交目标状态，卡片落入"进行中"栏
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/projects/101/status",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "in-progress" }),
        })
      );
    });
    await waitFor(() => {
      expect(boardColumnOf("进行中").getByText("祖母的生日披肩")).toBeInTheDocument();
    });
    expect(boardColumnOf("待开始").queryByText("祖母的生日披肩")).not.toBeInTheDocument();
  });

  /** AC-2 示例 1（前端防护面）："圣诞袜"已完成 → 拖回待开始，无弹窗阻断，PATCH 直接提交。 */
  it("已完成卡片拖回待开始，重开无确认弹窗阻断", async () => {
    mocks.users.push(makeUser("u10", "iris", "Iris"));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/v1/projects" && (!init || init.method === undefined || init.method === "GET")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [makeBackendProject(102, "圣诞袜", "completed")],
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => makeBackendProject(102, "圣诞袜", "todo"),
      } as Response);
    });

    renderNotebookPage("iris", { id: 10, username: "iris", displayName: "Iris", avatar: "" });
    await userEvent.click(await screen.findByRole("button", { name: "看板" }));

    dragCardToColumn("圣诞袜", "待开始");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/projects/102/status",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "todo" }),
        })
      );
    });
    // 无 confirm 弹窗阻断
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  /** AC-3 示例 1（前端面，越权反例）：PATCH 403 → 提示无权，卡片留在"进行中"栏。 */
  it("越权切换被拒绝：提示无权限，卡片状态不变", async () => {
    mocks.users.push(makeUser("u10", "iris", "Iris"));
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/v1/projects" && (!init || init.method === undefined || init.method === "GET")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [makeBackendProject(103, "贝雷帽", "in-progress")],
        } as Response);
      }
      // 服务端越权拒绝：403 + 无权提示
      return Promise.resolve({
        ok: false,
        status: 403,
        json: async () => ({ message: "无权操作该项目" }),
      } as Response);
    });

    renderNotebookPage("iris", { id: 10, username: "iris", displayName: "Iris", avatar: "" });
    await userEvent.click(await screen.findByRole("button", { name: "看板" }));

    dragCardToColumn("贝雷帽", "已完成");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("无权操作该项目");
    });
    // "贝雷帽"仍留在"进行中"栏（本地状态未被越权结果改变）
    expect(boardColumnOf("进行中").getByText("贝雷帽")).toBeInTheDocument();
    expect(boardColumnOf("已完成").queryByText("贝雷帽")).not.toBeInTheDocument();
  });
});
