import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import NotebookPage from "../NotebookPage";
import { AuthContext } from "../../context/AuthContext";

/**
 * FT-02-US-01 AC-5：未登录点击"新建项目"入口 → 引导登录，不出现创建表单。
 * AC-1（前端接线）：已登录点击入口 → 出现新建项目表单。
 */
function renderNotebookPage(currentUser: { id: number; username: string; displayName: string; avatar: string } | null) {
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
      <MemoryRouter initialEntries={["/users/woolenwhimsy?tab=projects"]}>
        <Routes>
          <Route path="/users/:username" element={<NotebookPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("NotebookPage 新建项目入口", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    // FT-02-US-03 起，已登录本人页面挂载时拉取后端项目（默认空列表）
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** AC-5 示例 1：游客未登录点击"新建项目" → 弹出登录弹窗，无创建表单。 */
  it("AC-5 未登录点击新建项目引导登录且不出现表单", async () => {
    renderNotebookPage(null);

    await userEvent.click(screen.getByRole("button", { name: "新建项目" }));

    expect(await screen.findByText("欢迎回来")).toBeInTheDocument();
    expect(screen.queryByLabelText(/项目名称/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /** AC-1 前端接线：已登录点击"新建项目" → 出现创建表单。 */
  it("AC-1 已登录点击新建项目出现创建表单", async () => {
    renderNotebookPage({ id: 2, username: "woolenwhimsy", displayName: "Sarah Chen", avatar: "" });

    await userEvent.click(screen.getByRole("button", { name: "新建项目" }));

    expect(await screen.findByLabelText(/项目名称/)).toBeInTheDocument();
  });
});
