"""操作触发登录 UI 层（FT-01-US-05）的 Step Definitions。

覆盖 features/ui/action-triggered-login.feature：
- @AC-1 个人数据入口（Navbar"我的项目"）未登录点击弹登录弹窗、不发生页面跳转；
- @AC-2 弹窗内登录成功后自动续接原操作（进入"我的项目"）；
- @AC-3 未登录访客连续浏览公开页面（首页/广场/图案库/关于）全程无登录拦截。

实现说明：
- 弹窗打开/关闭、凭据填写、登录态断言等通用步骤复用
  user_login_ui_steps.py 的既有定义，本文件仅新增 US-05 特有步骤；
- AC-1「不发生页面拦截跳转」：handleProjectsClick 中 e.preventDefault()
  阻断 <a> 的默认导航，断言点击后 URL 仍为当前页面且弹窗可见；
- AC-3「无登录拦截」逐页断言：登录弹窗遮罩不出现 + URL 等于目标路径
  （未被重定向到任何登录页），并以导航栏仍显示"登录 / 注册"佐证未触发
  任何登录引导。
"""

from __future__ import annotations

from assertpy import assert_that
from behave import then, when

from core.logger import get_logger
from pages.home_page import HomePage
from pages.login_modal import LoginModalPage

logger = get_logger(__name__)


# ======================================================================
# When：用户操作
# ======================================================================
@when('用户点击导航栏的"我的项目"链接')
def step_click_my_projects_link(context):
    """未登录态点击导航栏"我的项目"（authRequired 入口）。

    前端 handleProjectsClick 会 preventDefault 并打开登录弹窗，
    不发生路由跳转（FT-01-US-05 AC-1）。
    """
    context.home_page = HomePage(context.page)
    context.login_modal = LoginModalPage(context.page)

    context.home_page.click_my_projects_link()
    logger.info("已点击导航栏「我的项目」链接（未登录态）")


@when('未登录访客依次浏览如下公开页面：')
def step_browse_public_pages_as_guest(context):
    """以未登录态依次访问表格声明的公开页面（页面名/路径两列）。

    逐页记录（页面名 → URL/弹窗可见性）供 Then 步骤断言。
    """
    context.public_pages_visited = []
    home_page = HomePage(context.page)

    for row in context.table:
        name, path = row["页面"], row["路径"]
        full_url = f"{home_page.config.base_url}/{path.lstrip('/')}"
        context.page.goto(full_url, wait_until="domcontentloaded")
        # 等待前端挂载完成（Navbar 渲染）再观测弹窗状态
        home_page.wait_for_visible(home_page.LOGIN_ENTRY_BUTTON)
        modal_visible = LoginModalPage(context.page).is_visible(
            LoginModalPage.MODAL_OVERLAY, timeout=1000
        )
        context.public_pages_visited.append(
            {"页面": name, "路径": path, "当前URL": context.page.url, "弹窗可见": modal_visible}
        )
        logger.info("已浏览公开页面「%s」：%s", name, context.page.url)


# ======================================================================
# Then：断言 / 验证
# ======================================================================
@then('弹出标题为"欢迎回来"的登录弹窗')
def step_assert_login_modal_opened(context):
    """断言登录弹窗已弹出且标题为"欢迎回来"（复用 Navbar authRequired 交互）。"""
    context.login_modal.assert_open_with_title("欢迎回来")
    logger.info("登录弹窗弹出断言通过（标题：欢迎回来）")


@then('页面停留在首页 "{path}"')
def step_assert_still_on_current_page(context, path):
    """断言点击受限操作后页面未发生跳转（preventDefault 生效）。"""
    context.home_page.assert_url_is(path)
    logger.info("页面停留断言通过：%s", path)


@then('导航栏仍显示"登录 / 注册"按钮')
def step_assert_login_entry_still_visible(context):
    """断言弹窗弹出期间导航栏仍为未登录态（"登录 / 注册"按钮可见）。"""
    context.home_page.assert_login_entry_visible()
    logger.info("导航栏未登录态断言通过")


@then('全程无登录弹窗出现')
def step_assert_no_login_modal_on_public_pages(context):
    """断言公开页面浏览全程未出现登录弹窗遮罩。"""
    visited = getattr(context, "public_pages_visited", None)
    assert_that(visited).described_as(
        "公开页面浏览记录未初始化：When「依次浏览如下公开页面」步骤未执行"
    ).is_not_none()

    for record in visited:
        assert_that(record["弹窗可见"]).described_as(
            f"公开页面「{record['页面']}」（{record['路径']}）不应弹出登录弹窗"
        ).is_false()
    logger.info("公开页面全程无登录弹窗断言通过（共 %d 页）", len(visited))


@then('每个页面均正常浏览且未发生登录页跳转')
def step_assert_public_pages_no_redirect(context):
    """断言每个公开页面 URL 等于目标路径（未被拦截重定向），且未触发登录引导。"""
    visited = getattr(context, "public_pages_visited", None)
    assert_that(visited).described_as(
        "公开页面浏览记录未初始化：When「依次浏览如下公开页面」步骤未执行"
    ).is_not_none()

    home_page = HomePage(context.page)
    for record in visited:
        expected = f"{home_page.config.base_url}/{record['路径'].lstrip('/')}"
        assert_that(record["当前URL"]).described_as(
            f"公开页面「{record['页面']}」应停留在 {record['路径']}，"
            f"实际被跳转到 {record['当前URL']}"
        ).is_equal_to(expected)
    # 收尾再证一次当前导航栏仍为未登录态（无任何登录引导副作用）
    home_page.assert_login_entry_visible()
    logger.info("公开页面无登录跳转断言通过（共 %d 页）", len(visited))
