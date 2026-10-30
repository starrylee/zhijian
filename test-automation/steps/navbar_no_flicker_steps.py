"""恢复期 Navbar 防闪烁（FT-01-US-03-M02）UI 层的 Step Definitions。

覆盖 features/ui/navbar-no-flicker.feature：恢复完成前不渲染未登录按钮
（AC-1）、游客态呈现不受损（AC-2 反例）。

实现说明：
- 「恢复期间」的确定性实例化：add_init_script 包装 window.fetch，
  /api/v1/auth/me 请求在 window.__releaseMe 置位前挂起（页面 JS 线程内
  轮询等待，不阻塞 Playwright 同步 API 的分发线程）；
- 首帧断言：页面 header 渲染后立即检查 Navbar 登录区——既无
  "登录 / 注册"按钮（未闪现游客态）、亦无 displayName/退出按钮（未提前
  渲染用户态），即 M02 的第三态（恢复中）；
- 释放后断言：登录态一次性呈现正确 displayName；游客态正常显示
  "登录 / 注册"（仅推迟呈现，不永久空白）。
"""

from __future__ import annotations

from assertpy import assert_that
from behave import then, when

from pages.home_page import HomePage

# 页面内注入脚本：包装 window.fetch，挂起 /api/v1/auth/me 直到
# window.__releaseMe 被置位（恢复期窗口的确定性开关）
_ME_SUSPEND_INIT_SCRIPT = """
(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const url = String(args[0]);
    if (url.includes("/api/v1/auth/me")) {
      while (!window.__releaseMe) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    return originalFetch(...args);
  };
})();
"""


# ======================================================================
# When：用户操作
# ======================================================================
@when("会话恢复查询被挂起（模拟恢复期间）")
def step_suspend_me_query(context):
    """挂起会话恢复查询：注入 fetch 包装，使后续导航的 /me 请求等待释放。"""
    context.page.add_init_script(_ME_SUSPEND_INIT_SCRIPT)
    context.me_suspended = True
    context.login_button_flicker_seen = False


@when("用户刷新页面")
def step_reload_page_once(context):
    """刷新页面并等待 Navbar 渲染（恢复查询仍处于挂起状态）。"""
    home_page = HomePage(context.page)
    home_page.reload()
    # 等 Navbar 渲染完成（header 出现），恢复查询仍挂起 → 处于恢复期窗口
    home_page.page.wait_for_selector("header", state="visible")
    context.restore_pending_snapshot = {
        "login_entry_count": home_page.count(HomePage.LOGIN_ENTRY_BUTTON),
        "display_name_count": home_page.count(HomePage.USER_DISPLAY_NAME),
        "logout_count": home_page.count(HomePage.LOGOUT_BUTTON),
    }


@when("恢复查询返回")
def step_release_me_query(context):
    """释放被挂起的会话恢复查询（/me 实际发出并返回 200）。"""
    assert_that(getattr(context, "me_suspended", False)).described_as(
        "恢复查询未处于挂起状态：前置 When「会话恢复查询被挂起」步骤未执行"
    ).is_true()
    context.page.evaluate("window.__releaseMe = true")


@when("恢复查询返回（未登录，/me 返回 401）")
def step_release_me_query_as_guest(context):
    """释放被挂起的会话恢复查询（未登录游客，/me 实际返回 401）。"""
    step_release_me_query(context)


# ======================================================================
# Then：断言 / 验证
# ======================================================================
@then("恢复完成前导航栏既不渲染\"登录 / 注册\"按钮，也不渲染用户态")
def step_assert_nothing_rendered_during_restore(context):
    """断言恢复期窗口内 Navbar 登录区为第三态：无游客按钮、无用户态。

    防护性反例断言：既验证「没有渲染登录 / 注册按钮」（零闪现），
    也验证「没有提前渲染用户态」（displayName / 退出按钮均未出现）。
    """
    snapshot = getattr(context, "restore_pending_snapshot", None)
    assert_that(snapshot).described_as(
        "恢复期快照未初始化：前置 When「用户刷新页面」步骤未执行"
    ).is_not_none()
    assert_that(snapshot["login_entry_count"]).described_as(
        "恢复完成前 Navbar 渲染了「登录 / 注册」按钮（游客态闪现，M02 AC-1 违例）"
    ).is_equal_to(0)
    assert_that(snapshot["display_name_count"]).described_as(
        "恢复完成前 Navbar 提前渲染了用户态 displayName"
    ).is_equal_to(0)
    assert_that(snapshot["logout_count"]).described_as(
        "恢复完成前 Navbar 提前渲染了「退出」按钮"
    ).is_equal_to(0)


@then('导航栏显示用户名"{display_name}"，全程"登录 / 注册"按钮零闪现')
def step_assert_logged_in_after_restore(context, display_name):
    """断言恢复查询返回后一次性呈现正确登录态。"""
    home_page = HomePage(context.page)
    home_page.assert_logged_in_as(display_name)


@then('导航栏正常显示"登录 / 注册"按钮（游客态不永久空白）')
def step_assert_guest_after_restore(context):
    """断言游客态仅推迟至查询完成呈现（反例：不永久空白）。"""
    home_page = HomePage(context.page)
    home_page.assert_login_entry_visible()
