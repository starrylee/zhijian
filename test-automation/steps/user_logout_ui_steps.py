"""用户登出 UI 层（FT-01-US-04）的 Step Definitions。

覆盖 features/ui/user-logout.feature：登出恢复未登录态（@AC-1）、
登出为真实销毁会话而非仅清前端态（@AC-2）。

实现说明：
- Given「已通过 UI 登录」复用登录弹窗流程（FT-01-US-02 交付行为）建立
  登录态，并注册登出请求监听（统计 POST /api/v1/auth/logout 次数）——
  供 AC-1「登出请求确实发往后端」断言，防「登出仅清前端态」的假登出
  （story 备注 AC-2 缺陷形态）；
- AC-2 刷新断言依赖后端会话已销毁：若登出只清前端态，刷新后 AuthContext
  会话恢复（/me）仍能凭旧 Cookie 恢复登录态，Navbar 将保持用户态而失败。
"""

from __future__ import annotations

from assertpy import assert_that
from behave import given, then, when

from core.logger import get_logger
from pages.home_page import HomePage
from pages.login_modal import LoginModalPage

logger = get_logger(__name__)

# 登出接口路径片段（前端 fetch 相对路径，经 Vite proxy 透传到后端）
_LOGOUT_API_PATH = "/api/v1/auth/logout"


# ======================================================================
# Given：前置条件与数据准备
# ======================================================================
@given('用户已通过 UI 登录为 "{username}"，导航栏显示用户名"{display_name}"与"退出"按钮')
def step_login_via_ui(context, username, display_name):
    """以声明用户走完整登录弹窗流程建立登录态，并注册登出请求监听。"""
    context.logout_request_count = 0

    def _count_logout_request(request):
        if request.method == "POST" and _LOGOUT_API_PATH in request.url:
            context.logout_request_count += 1

    context.page.on("request", _count_logout_request)

    context.home_page = HomePage(context.page)
    context.login_modal = LoginModalPage(context.page)

    context.home_page.navigate()
    context.home_page.open_login_modal()
    context.login_modal.fill_username(username)
    context.login_modal.fill_password("knit123")
    context.login_modal.click_submit()

    context.login_modal.assert_closed()
    context.home_page.assert_logged_in_as(display_name)
    logger.info("已通过 UI 登录为 %s（displayName：%s）", username, display_name)


# ======================================================================
# When：用户操作
# ======================================================================
@when('用户点击导航栏的"退出"按钮')
def step_click_logout_button(context):
    """点击导航栏登录态的"退出"按钮。"""
    context.home_page = HomePage(context.page)
    context.home_page.click_logout()
    logger.info("已点击「退出」按钮")


# 注：「用户刷新页面」When 步骤复用 navbar_no_flicker_steps.py 中的既有定义。


# ======================================================================
# Then：断言 / 验证
# ======================================================================
@then('导航栏不再显示"{display_name}"与"退出"按钮，恢复显示"登录 / 注册"按钮')
def step_assert_navbar_back_to_guest(context, display_name):
    """断言导航栏恢复未登录态：用户态元素卸载、登录入口回归。"""
    context.home_page.assert_logged_out()
    logger.info("导航栏已恢复未登录态（displayName：%s 已卸载）", display_name)


@then('前端已向后端发出登出请求 "{path}"')
def step_assert_logout_request_sent(context, path):
    """断言登出请求确实发往后端（非仅清前端态的假登出）。"""
    count = getattr(context, "logout_request_count", None)
    assert_that(count).described_as(
        "登出请求监听未初始化：登录前置步骤未注册监听"
    ).is_not_none()
    assert_that(count).described_as(
        f"登出应向后端发出 POST {path}，实际发出 {count} 次"
        "（假登出：仅清前端状态、服务端会话仍存活）"
    ).is_greater_than_or_equal_to(1)
    logger.info("登出请求已发往后端断言通过（请求数：%d）", count)


@then('导航栏恢复显示"登录 / 注册"按钮（旧会话已失效，刷新不再恢复登录态）')
def step_assert_session_invalid_after_reload(context):
    """断言刷新后 Navbar 仍为游客态——登出已销毁服务端会话，/me 恢复失败。"""
    context.home_page = HomePage(context.page)
    context.home_page.assert_login_entry_visible()
    logger.info("刷新后导航栏保持未登录态断言通过（旧会话已失效）")
