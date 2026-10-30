import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginModal from "../LoginModal";
import { AuthProvider } from "../../context/AuthContext";

/**
 * FT-01-US-01 新用户注册（LoginModal 注册 tab 接通后端）。
 *
 * 覆盖 AC：AC-1 注册成功即时登录态（onSuccess 续接）、AC-2 重复用户名 409、
 * AC-3 密码 <6 位前端拦截。场景数据为 AI 草拟（待与 PO 核实）。
 */
describe("LoginModal 注册", () => {
  const fetchMock = vi.fn();
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  /** 注册请求的预设响应（按到达顺序消费；GET /auth/me 恒 401 游客态）。 */
  let queue: Response[] = [];

  beforeEach(() => {
    queue = [];
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = typeof input === "string" ? input : String(input);
      if (url.includes("/auth/me")) {
        return new Response(null, { status: 401 });
      }
      return queue.shift() ?? new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    onClose.mockReset();
    onSuccess.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function fillAndSubmitRegister(username: string, password: string) {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginModal onClose={onClose} onSuccess={onSuccess} />
        </AuthProvider>
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole("button", { name: "还没有账号？免费注册" }));
    await userEvent.type(screen.getByLabelText("用户名"), username);
    await userEvent.type(screen.getByLabelText("密码"), password);
    await userEvent.click(screen.getByRole("button", { name: "注 册" }));
  }

  /** AC-1 示例 1：snowflake/mittens2026 → 201 + 用户 → 弹窗关闭并续接登录态。 */
  it("AC-1 注册成功后关闭弹窗并回调 onSuccess", async () => {
    queue.push(
      new Response(
        JSON.stringify({ id: 4, username: "snowflake", displayName: "snowflake", avatar: "a.png" }),
        { status: 201 }
      )
    );

    await fillAndSubmitRegister("snowflake", "mittens2026");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ username: "snowflake" }))
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ username: "snowflake", password: "mittens2026" }),
      })
    );
  });

  /** AC-1 示例 2（边界下限）：密码恰好 6 位 → 请求发出（不被前端拦截）。 */
  it("AC-1 密码 6 位为允许下限，正常发起注册请求", async () => {
    queue.push(
      new Response(
        JSON.stringify({ id: 5, username: "newweaver", displayName: "newweaver", avatar: "a.png" }),
        { status: 201 }
      )
    );

    await fillAndSubmitRegister("newweaver", "knit12");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/v1/auth/register");
    expect(call).toBeDefined();
    expect(JSON.parse(call![1]!.body as string)).toEqual({
      username: "newweaver",
      password: "knit12",
    });
  });

  /** AC-2 示例 1：woolenwhimsy 已存在 → 409「用户名已被占用」，表单保留已填内容。 */
  it("AC-2 重复用户名提示占用且表单保留输入", async () => {
    queue.push(
      new Response(JSON.stringify({ message: "用户名已被占用" }), { status: 409 })
    );

    await fillAndSubmitRegister("woolenwhimsy", "mittens2026");

    expect(await screen.findByText("用户名已被占用")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    // 表单保留已填内容（AC-2：停留在注册表单）
    expect((screen.getByLabelText("用户名") as HTMLInputElement).value).toBe("woolenwhimsy");
    expect((screen.getByLabelText("密码") as HTMLInputElement).value).toBe("mittens2026");
  });

  /** AC-3 示例 1（边界反例）：密码 5 位 → 前端提示且不发请求。 */
  it("AC-3 密码不足 6 位提示长度要求且不调用 API", async () => {
    await fillAndSubmitRegister("newweaver", "knit1");

    expect(await screen.findByText("密码至少需要 6 位")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/v1/auth/register")
    ).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  /** 空输入必填校验（与登录同口径）：用户名留空 → 提示且不发请求。 */
  it("空用户名提示必填且不调用 API", async () => {
    await fillAndSubmitRegister(" ", "mittens2026");

    expect(await screen.findByText("请输入用户名")).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/v1/auth/register")
    ).toHaveLength(0);
  });
});
