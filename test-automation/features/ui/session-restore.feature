# 会话恢复骨架（FT-01-US-03-M01）UI 层验收测试
# 拆自 FT-01-US-03 登录态保持与当前用户上下文；实例化数据与 Story 卡片一致
# （woolenwhimsy / knit123 / displayName "Sarah Chen"）
# 实现依赖：后端 GET /api/v1/auth/me（AC-4，契约由 MeIntegrationTest 锁定）
# + 前端 AuthContext 启动恢复（页面加载 → 携 Cookie 查 /me → 恢复 currentUser）
# 注: 恢复完成前 Navbar 短暂闪现"登录 / 注册"属 M02 范围（PO 决策），
#   本层断言的是恢复完成后的稳定态（displayName 可见后再快照）
# 注: AC-2"重开浏览器"以 Playwright「关闭页面后同 context 重开新页面」实例化
#   ——Cookie 存于 context（模拟浏览器磁盘 cookie 存储，Max-Age 7 天持久 Cookie），
#   关页面再开新页面 = 重开浏览器后持久 Cookie 仍在、页面全新加载触发恢复

@FT-01-US-03-M01
@layer:e2e
Feature: 会话恢复骨架

  作为一个已登录的织友，
  我想要刷新页面或重开浏览器后，页面加载时自动恢复我的登录态，
  以便不被打断地持续使用 KnitHub，无需重新输入用户名密码。

  Background:
    Given 系统中存在如下注册用户：
      | username     | password | displayName |
      | woolenwhimsy | knit123  | Sarah Chen  |
    And 用户处于未登录状态，正在浏览首页 "/"

  # source: web-ui/src/context/AuthContext.tsx（启动恢复：页面加载 → GET /api/v1/auth/me → 恢复 currentUser）
  #         + web-ui/src/components/Navbar.tsx（登录态 displayName 出口）；AC-1 实例化：09:30 连续刷新 3 次
  @AC-1
  Scenario: AC-1 登录后连续刷新页面 3 次均保持登录态
    When 用户点击导航栏的"登录 / 注册"按钮，打开标题为"欢迎回来"的登录弹窗
    And 在"用户名"输入框输入 "woolenwhimsy"
    And 在"密码"输入框输入 "knit123"
    And 点击"登 录"按钮
    Then 登录弹窗关闭，标题"欢迎回来"不再显示
    When 用户连续刷新页面 3 次
    Then 每次页面加载完成后导航栏均显示用户名"Sarah Chen"，全程未出现登录弹窗

  # source: AC-2 实例化——周五 21:00 登录后关闭浏览器（服务未重启，内存会话仍在；Cookie Max-Age 7 天
  #         已由 US-02 落定），周六 09:00 重新打开浏览器访问 KnitHub，直接处于登录态；
  #         Playwright 以「关页面 + 同 context 重开新页面」实例化（Cookie 存于 context =
  #         真实浏览器的持久 Cookie 磁盘存储，重开浏览器后仍在、页面全新加载触发恢复）
  @AC-2
  Scenario: AC-2 重开浏览器后保持登录态
    When 用户点击导航栏的"登录 / 注册"按钮，打开标题为"欢迎回来"的登录弹窗
    And 在"用户名"输入框输入 "woolenwhimsy"
    And 在"密码"输入框输入 "knit123"
    And 点击"登 录"按钮
    Then 登录弹窗关闭，标题"欢迎回来"不再显示
    When 用户关闭浏览器
    And 重新打开浏览器访问首页
    Then 直接处于登录态，导航栏显示用户名"Sarah Chen"，无需重新输入用户名密码

  # source: AC-3 正例——登录态下前端任意功能模块（含 FT-02/03/04）经 AuthContext 读取当前用户；
  #         Navbar 为 AuthContext 值的可观测出口（displayName 文本 / 头像 img src=avatar /
  #         用户入口链接 href=/users/{username}）；头像数据源自种子 server/data/users.json
  @AC-3
  Scenario: AC-3 登录态下 AuthContext 恢复当前用户上下文（username/displayName/avatar）
    When 用户点击导航栏的"登录 / 注册"按钮，打开标题为"欢迎回来"的登录弹窗
    And 在"用户名"输入框输入 "woolenwhimsy"
    And 在"密码"输入框输入 "knit123"
    And 点击"登 录"按钮
    Then 登录弹窗关闭，标题"欢迎回来"不再显示
    When 用户连续刷新页面 1 次
    Then 每次页面加载完成后导航栏均显示用户名"Sarah Chen"，全程未出现登录弹窗
    And 刷新恢复后导航栏展示当前用户上下文：
      | 字段     | 值                                  |
      | 显示名称 | Sarah Chen                          |
      | 用户名   | woolenwhimsy                        |
      | 头像     | photo-1438761681033-6461ffad8d80    |

  # source: AC-3 反例 + AC-4 UI 部分——未登录是正常态（游客态）而非错误，
  #         GET /api/v1/auth/me 返回 401 时前端静默处理：无弹窗、无错误文案、
  #         Navbar 显示"登录 / 注册"（AuthContext currentUser 读取结果为 null）
  @AC-3
  Scenario: AC-3 未登录访问首页为游客态且无任何错误提示
    When 页面重新加载（未登录，/me 返回 401）
    Then 导航栏显示"登录 / 注册"按钮（游客态，currentUser 为 null）
    And 页面无任何错误提示（401 静默处理，未向用户报错）
