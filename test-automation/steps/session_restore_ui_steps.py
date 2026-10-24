"""会话恢复骨架（FT-01-US-03-M01）UI 层的 Step Definitions。

覆盖 features/ui/session-restore.feature：刷新页面保持登录（AC-1）、
重开浏览器保持登录（AC-2）、未登录游客态 401 静默（AC-3 反例）。

实现说明：
- 「页面加载完成」的判据是 AuthContext 会话恢复完成后的稳定态——
  等待 Navbar displayName 可见（前端启动时调 GET /api/v1/auth/me 恢复），
  恢复前的"登录 / 注册"闪现属 M02 范围，不在本层断言；
- 刷新快照策略：When 步骤逐次记录 Navbar 状态，Then 步骤对每份快照断言，
  使「每次页面加载完成后均显示」的断言语义逐次落实。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from assertpy import assert_that
from behave import then, when

from pages.home_page import HomePage
from pages.login_modal import LoginModalPage


# ======================================================================
# When：用户操作
# ======================================================================
@when("用户连续刷新页面 {count:d} 次")
def step_reload_page_n_times(context, count):
    """连续刷新页面 count 次，每次加载完成后快照 Navbar 登录态。

    快照记录（等待恢复稳定态后取值）：
    - display_name：Navbar displayName 文本（恢复失败保持 None）；
    - login_entry_visible："登录 / 注册"入口是否可见；
    - login_modal_visible：登录弹窗是否自动弹出（应始终为 False）。
    """
    home_page = HomePage(context.page)
    snapshots: List[Dict[str, Any]] = []
    for index in range(1, count + 1):
        home_page.reload()
        snapshot: Dict[str, Any] = {
            "index": index,
            "display_name": None,
            "login_entry_visible": False,
            "login_modal_visible": False,
        }
        # 等待页面加载完成：会话恢复成功后 displayName 可见（超时未恢复保持 None）
        if home_page.is_visible(HomePage.USER_DISPLAY_NAME, timeout=5000):
            snapshot["display_name"] = home_page.get_text(HomePage.USER_DISPLAY_NAME)
        snapshot["login_entry_visible"] = home_page.is_visible(HomePage.LOGIN_ENTRY_BUTTON)
        snapshot["login_modal_visible"] = home_page.is_visible(LoginModalPage.MODAL_OVERLAY)
        snapshots.append(snapshot)
    context.restore_snapshots = snapshots


@when("用户关闭浏览器")
def step_close_browser(context):
    """关闭当前页面（模拟关闭浏览器）。

    Playwright 语义：page.close() 仅关闭页面，Cookie 留存于 browser
    context——等价于真实浏览器关闭后持久 Cookie（Max-Age 7 天）仍存于
    磁盘；服务端内存会话不重启不失效（FT-01 决策 2）。
    """
    context.page.close()
    context.page = None


@when("重新打开浏览器访问首页")
def step_reopen_browser(context):
    """重开浏览器访问首页（模拟周六 09:00 重新打开浏览器）。

    同 context 开新页面 = 重开浏览器后持久 Cookie 仍在、页面全新加载
    触发 AuthContext 启动会话恢复。
    """
    page = context.browser_factory.new_page()
    context.page = page
    context.home_page = HomePage(page)
    context.home_page.navigate()


# ======================================================================
# Then：断言 / 验证
# ======================================================================
@then('直接处于登录态，导航栏显示用户名"{display_name}"，无需重新输入用户名密码')
def step_assert_reopened_browser_logged_in(context, display_name):
    """断言重开浏览器后直接处于登录态（无登录入口、无登录弹窗、displayName 正确）。"""
    context.home_page.assert_login_entry_not_visible()
    context.home_page.assert_logged_in_as(display_name)
    LoginModalPage(context.page).assert_closed()


@then('每次页面加载完成后导航栏均显示用户名"{display_name}"，全程未出现登录弹窗')
def step_assert_every_reload_keeps_logged_in(context, display_name):
    """断言每次刷新后 Navbar 均恢复登录态（displayName 正确、无登录入口、无弹窗）。"""
    snapshots: Optional[List[Dict[str, Any]]] = getattr(context, "restore_snapshots", None)
    assert_that(snapshots).described_as(
        "刷新快照未初始化：前置 When「连续刷新页面」步骤未执行"
    ).is_not_none()

    for snapshot in snapshots:
        assert_that(snapshot["display_name"]).described_as(
            f"第 {snapshot['index']} 次刷新后 Navbar 未恢复登录态"
            "（displayName 不可见，会话恢复未生效）"
        ).is_equal_to(display_name)
        assert_that(snapshot["login_entry_visible"]).described_as(
            f"第 {snapshot['index']} 次刷新后 Navbar 仍显示「登录 / 注册」入口"
        ).is_false()
        assert_that(snapshot["login_modal_visible"]).described_as(
            f"第 {snapshot['index']} 次刷新后出现了登录弹窗"
        ).is_false()


@when("页面重新加载（未登录，/me 返回 401）")
def step_reload_as_guest(context):
    """以未登录状态重新加载页面，并注册原生 dialog 监听。

    Background 已导航过首页（监听未覆盖首次加载），此处带监听重载，
    捕获 401 处理期间可能出现的任何原生弹窗（alert/confirm/prompt）。
    """
    context.dialog_count = 0

    def _on_dialog(dialog):
        context.dialog_count += 1
        dialog.dismiss()

    context.page.on("dialog", _on_dialog)
    HomePage(context.page).reload()


@then('导航栏显示"登录 / 注册"按钮（游客态，currentUser 为 null）')
def step_assert_guest_state(context):
    """断言 Navbar 为游客态（AuthContext currentUser 为 null 的可观测出口）。"""
    HomePage(context.page).assert_login_entry_visible()


@then("页面无任何错误提示（401 静默处理，未向用户报错）")
def step_assert_no_error_feedback(context):
    """断言 401 被静默处理（防护性反例：验证"未做的事"）。

    三重断言：无原生 dialog 弹出、页面无错误文案、登录弹窗未自动弹出
    ——未登录是正常态（游客态）而非错误，不得向用户报错。
    """
    page = context.page
    assert_that(getattr(context, "dialog_count", 0)).described_as(
        "401 应静默处理，不应弹出任何原生对话框（alert/confirm/prompt）"
    ).is_equal_to(0)
    body_text = page.locator("body").inner_text()
    assert_that(body_text).described_as(
        "页面不应向用户显示登录错误提示"
    ).does_not_contain("用户名或密码错误")
    assert_that(LoginModalPage(page).is_visible(LoginModalPage.MODAL_OVERLAY)).described_as(
        "401 不应触发登录弹窗自动弹出"
    ).is_false()


@then("刷新恢复后导航栏展示当前用户上下文：")
def step_assert_navbar_user_context(context):
    """断言刷新恢复后 Navbar 展示 AuthContext currentUser 三要素。

    表格按「字段 / 值」两列组织：
    - 显示名称 → Navbar displayName 文本完全相等；
    - 用户名 → 用户入口链接 href 含 /users/{username}；
    - 头像 → 头像图 src 含 avatar URL 关键片段。
    """
    home_page = HomePage(context.page)
    expected = {row["字段"]: row["值"] for row in context.table}
    home_page.assert_logged_in_as(expected["显示名称"])
    if "用户名" in expected:
        home_page.assert_user_profile_link(expected["用户名"])
    if "头像" in expected:
        home_page.assert_user_avatar(expected["头像"])
