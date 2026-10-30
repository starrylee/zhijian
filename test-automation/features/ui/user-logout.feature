# FT-01-US-04 用户登出 - UI 层
# 源码涉及: web-ui/src/components/Navbar.tsx（"退出"按钮 onClick=logout）、
#   web-ui/src/context/AuthContext.tsx（logout 调后端 POST /api/v1/auth/logout
#   销毁会话并清前端态）、server AuthController#logout
# 种子数据依据: server/data/users.json（woolenwhimsy / knit123，displayName "Sarah Chen"）
# 注: AC-2「旧 Cookie 不可复用」的服务端断言由后端集成测试
#   LogoutIntegrationTest.meWithOldCookieAfterLogoutReturns401 覆盖；
#   本层以页面可观测行为（Navbar 恢复游客态）+ 登出请求确实发往后端断言
# 注: 实例化示例的 Given（woolenwhimsy 处于登录态）经 UI 登录流程建立；
#   curl/开发者工具验证场景为 AI 草拟（story 已标注待与 PO 核实），
#   本层以「登出请求已发往后端」等价实例化「会话在服务端销毁」的可观测性

@FT-01-US-04
@layer:e2e
Feature: 用户登出

  作为一个已登录的织友，
  我想要主动退出登录，
  以便在共用设备上使用后保护我的账号安全。

  Background:
    Given 系统中存在如下注册用户：
      | username     | password | displayName |
      | woolenwhimsy | knit123  | Sarah Chen  |

  # source: web-ui/src/components/Navbar.tsx（登录态"退出"按钮）、
  #         web-ui/src/context/AuthContext.tsx（logout：调后端销毁会话 + 清 currentUser → Navbar 回退游客态"登录 / 注册"按钮）
  @AC-1
  Scenario: AC-1 点击"退出"后界面恢复未登录态
    Given 用户已通过 UI 登录为 "woolenwhimsy"，导航栏显示用户名"Sarah Chen"与"退出"按钮
    When 用户点击导航栏的"退出"按钮
    Then 导航栏不再显示"Sarah Chen"与"退出"按钮，恢复显示"登录 / 注册"按钮
    And 前端已向后端发出登出请求 "/api/v1/auth/logout"

  # source: web-ui/src/context/AuthContext.tsx（logout 必须调后端销毁会话，非仅清前端态——
  #         现有 mock 缺陷形态「登出仅清前端状态、服务端会话仍存活」，备注 AC-2）
  @AC-2
  Scenario: AC-2 登出为真实销毁会话而非仅清前端态
    Given 用户已通过 UI 登录为 "woolenwhimsy"，导航栏显示用户名"Sarah Chen"与"退出"按钮
    When 用户点击导航栏的"退出"按钮
    And 用户刷新页面
    Then 导航栏恢复显示"登录 / 注册"按钮（旧会话已失效，刷新不再恢复登录态）
