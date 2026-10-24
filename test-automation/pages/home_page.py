"""首页（含全局导航栏 Navbar）页面对象。

选择器全部溯源自被测前端源码：
- web-ui/src/components/Navbar.tsx（Navbar 为全局布局组件，挂载于
  App.tsx 的所有路由页面；首页浏览、登录弹窗入口与导航栏登录态断言同屏完成）
"""

from __future__ import annotations

from assertpy import assert_that

from pages.base_page import BasePage


class HomePage(BasePage):
    """首页 POM：登录弹窗入口操作、导航栏登录态与首页停留断言。"""

    # 未登录态"登录 / 注册"入口按钮（onClick 打开登录弹窗）
    # 来源: web-ui/src/components/Navbar.tsx L110-116
    LOGIN_ENTRY_BUTTON = 'header button:has-text("登录 / 注册")'

    # 登录态 displayName 文本（class="text-sm font-medium hidden sm:block"，
    # sm 断点以下隐藏——测试视口 1920x1080 下可见；header 内唯一该组合的 span，
    # 桌面/移动导航链接均为 <a> 元素不构成干扰）
    # 来源: web-ui/src/components/Navbar.tsx L95-97
    USER_DISPLAY_NAME = "header span.text-sm.font-medium"

    # 登录态"退出"按钮（onClick=logout）
    # 来源: web-ui/src/components/Navbar.tsx L99-107
    LOGOUT_BUTTON = 'header button:has-text("退出")'

    # 登录态头像图（currentUser.avatar 出口；header 内唯一圆角头像 img）
    # 来源: web-ui/src/components/Navbar.tsx L89-94
    USER_AVATAR = "header img.rounded-full"

    # 登录态用户入口链接（href=/users/{currentUser.username}——username 出口）
    # 来源: web-ui/src/components/Navbar.tsx L85-98
    USER_PROFILE_LINK = 'header a[href*="/users/"]'

    @property
    def url_path(self) -> str:
        """首页 URL 路径。"""
        return "/"

    # ------------------------------------------------------------------
    # Action（When 步骤）
    # ------------------------------------------------------------------
    def open_login_modal(self) -> "HomePage":
        """点击导航栏"登录 / 注册"按钮，打开登录弹窗。"""
        self.click(self.LOGIN_ENTRY_BUTTON)
        return self

    # ------------------------------------------------------------------
    # 断言（Then 步骤）
    # ------------------------------------------------------------------
    def assert_login_entry_visible(self) -> "HomePage":
        """断言导航栏可见"登录 / 注册"按钮（未登录态）。"""
        return self.assert_element_visible(self.LOGIN_ENTRY_BUTTON)

    def assert_login_entry_not_visible(self) -> "HomePage":
        """断言导航栏不再显示"登录 / 注册"按钮（登录成功后卸载）。"""
        self.wait_for_hidden(self.LOGIN_ENTRY_BUTTON)
        return self.assert_element_not_visible(self.LOGIN_ENTRY_BUTTON)

    def assert_logged_in_as(self, display_name: str) -> "HomePage":
        """断言导航栏登录态：displayName 文本正确且"退出"按钮可见。"""
        self.assert_element_visible(self.USER_DISPLAY_NAME)
        self.assert_element_text(self.USER_DISPLAY_NAME, display_name)
        return self.assert_element_visible(self.LOGOUT_BUTTON)

    def assert_user_profile_link(self, username: str) -> "HomePage":
        """断言导航栏用户入口链接指向个人页 /users/{username}（AuthContext username 出口）。"""
        href = self.get_attribute(self.USER_PROFILE_LINK, "href")
        assert_that(href).described_as(
            f"用户入口链接应指向个人页 /users/{username}，实际：{href}"
        ).contains(f"/users/{username}")
        return self

    def assert_user_avatar(self, avatar_url_fragment: str) -> "HomePage":
        """断言导航栏头像图 src 含 avatar URL 片段（AuthContext avatar 出口）。

        以 URL 关键片段断言（种子头像为 unsplash 链接，query 参数允许变化）。
        """
        src = self.get_attribute(self.USER_AVATAR, "src")
        assert_that(src).described_as(
            f"头像图 src 应含 {avatar_url_fragment}，实际：{src}"
        ).contains(avatar_url_fragment)
        return self

    def assert_url_is(self, path: str) -> "HomePage":
        """断言当前 URL 等于 base_url + path（页面停留/导航目标断言）。"""
        expected = f"{self.config.base_url}/{path.lstrip('/')}"
        assert_that(self.page.url).described_as(
            f"页面 URL 断言失败（期望 {expected}，实际 {self.page.url}）"
        ).is_equal_to(expected)
        return self
