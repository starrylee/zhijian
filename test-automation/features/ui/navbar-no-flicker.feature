# 恢复期 Navbar 防闪烁（FT-01-US-03-M02）UI 层验收测试
# 拆自 FT-01-US-03 登录态保持与当前用户上下文；实例化数据与 Story 卡片一致
#（woolenwhimsy / knit123 / displayName "Sarah Chen"）
# 依赖：M01 会话恢复（页面加载 → GET /api/v1/auth/me → 恢复 currentUser）
# 实现：以 add_init_script 包装 window.fetch 挂起 /me 请求（window.__releaseMe
#   置位前不发出），使「恢复查询尚未返回」的恢复期窗口可确定性地观察——
#   断言该窗口内 Navbar 首帧渲染结果（M02 AC-1/AC-2 的核心断言点）

@FT-01-US-03-M02
@layer:e2e
Feature: 恢复期 Navbar 防闪烁

  作为一个已登录的织友，
  我想要页面刷新恢复登录态期间，导航栏不闪现"登录 / 注册"按钮，
  以便确认系统记住了我的登录状态，不产生"需要重新登录"的错觉。

  Background:
    Given 系统中存在如下注册用户：
      | username     | password | displayName |
      | woolenwhimsy | knit123  | Sarah Chen  |
    And 用户处于未登录状态，正在浏览首页 "/"

  # source: M02 AC-1——会话恢复查询尚未返回时 Navbar 渲染，
  #   恢复完成前不渲染"登录 / 注册"按钮（亦不渲染用户态）；
  #   恢复查询返回后一次性呈现正确登录态（"Sarah Chen"），全程零闪现
  @AC-1
  Scenario: AC-1 恢复完成前 Navbar 不渲染"登录 / 注册"按钮
    When 用户点击导航栏的"登录 / 注册"按钮，打开标题为"欢迎回来"的登录弹窗
    And 在"用户名"输入框输入 "woolenwhimsy"
    And 在"密码"输入框输入 "knit123"
    And 点击"登 录"按钮
    Then 登录弹窗关闭，标题"欢迎回来"不再显示
    When 会话恢复查询被挂起（模拟恢复期间）
    And 用户刷新页面
    Then 恢复完成前导航栏既不渲染"登录 / 注册"按钮，也不渲染用户态
    When 恢复查询返回
    Then 导航栏显示用户名"Sarah Chen"，全程"登录 / 注册"按钮零闪现

  # source: M02 AC-2（反例）——未登录用户（恢复查询将返回 401），
  #   游客态仅推迟至查询完成呈现，不永久空白
  @AC-2
  Scenario: AC-2 游客态在恢复查询完成后正常显示"登录 / 注册"按钮
    When 会话恢复查询被挂起（模拟恢复期间）
    And 用户刷新页面
    Then 恢复完成前导航栏既不渲染"登录 / 注册"按钮，也不渲染用户态
    When 恢复查询返回（未登录，/me 返回 401）
    Then 导航栏正常显示"登录 / 注册"按钮（游客态不永久空白）
