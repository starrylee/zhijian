import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewProjectForm from "../NewProjectForm";

/**
 * FT-02-US-01 新建项目表单组件测试。
 *
 * 覆盖 AC：AC-1 成功创建、AC-3 必填项校验、AC-4 里程碑名称必填。
 */
describe("NewProjectForm", () => {
  const fetchMock = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    onSuccess.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** AC-1 示例 1：名称"祖母的生日披肩"、日期 2026-10-31、无里程碑 → 提交成功回调。 */
  it("AC-1 提交名称与预计完成日期后调用创建 API 并回调成功", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1, name: "祖母的生日披肩", dueDate: "2026-10-31", status: "todo", milestones: [] }), { status: 201 })
    );

    render(<NewProjectForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/项目名称/), "祖母的生日披肩");
    await userEvent.type(screen.getByLabelText(/预计完成日期/), "2026-10-31");
    await userEvent.click(screen.getByRole("button", { name: "创建项目" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({
      name: "祖母的生日披肩",
      dueDate: "2026-10-31",
      milestones: [],
    });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ name: "祖母的生日披肩", status: "todo" })
    );
  });

  /** AC-2 示例 1："圣诞袜" + 里程碑"织袜筒"（2026-12-01）与"收口"（不填日期），按顺序提交。 */
  it("AC-2 携带里程碑提交，按填写顺序排列且无日期字段省略", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 2, name: "圣诞袜", dueDate: "2026-12-24", status: "todo", milestones: [] }), { status: 201 })
    );

    render(<NewProjectForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/项目名称/), "圣诞袜");
    await userEvent.type(screen.getByLabelText(/预计完成日期/), "2026-12-24");
    await userEvent.click(screen.getByRole("button", { name: "+ 添加里程碑" }));
    await userEvent.type(screen.getByLabelText("里程碑名称"), "织袜筒");
    await userEvent.type(screen.getByLabelText("里程碑预计日期（可选）"), "2026-12-01");
    await userEvent.click(screen.getByRole("button", { name: "+ 添加里程碑" }));
    // 第二条里程碑：仅填名称
    const nameInputs = screen.queryAllByLabelText("里程碑名称");
    await userEvent.type(nameInputs[1], "收口");
    await userEvent.click(screen.getByRole("button", { name: "创建项目" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({
      name: "圣诞袜",
      dueDate: "2026-12-24",
      milestones: [
        { name: "织袜筒", dueDate: "2026-12-01" },
        { name: "收口" },
      ],
    });
  });

  /** AC-3 示例 1：名称留空（日期已选）→ 提示"请填写项目名称"，不发请求。 */
  it("AC-3 名称留空提示必填且不调用 API", async () => {
    render(<NewProjectForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/预计完成日期/), "2026-11-15");
    await userEvent.click(screen.getByRole("button", { name: "创建项目" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("请填写项目名称");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  /** AC-3 示例 2（反例）：日期未选（名称已填"围巾"）→ 提示"请选择预计完成日期"，不发请求。 */
  it("AC-3 日期未选提示必填且不调用 API", async () => {
    render(<NewProjectForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/项目名称/), "围巾");
    await userEvent.click(screen.getByRole("button", { name: "创建项目" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("请选择预计完成日期");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /** AC-4 示例 1：名称/日期已填，里程碑名称留空 → 提示"里程碑名称必填"，不发请求。 */
  it("AC-4 里程碑名称留空提示必填且不调用 API", async () => {
    render(<NewProjectForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/项目名称/), "圣诞袜");
    await userEvent.type(screen.getByLabelText(/预计完成日期/), "2026-12-24");
    await userEvent.click(screen.getByRole("button", { name: "+ 添加里程碑" }));
    await userEvent.click(screen.getByRole("button", { name: "创建项目" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("里程碑名称必填");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
