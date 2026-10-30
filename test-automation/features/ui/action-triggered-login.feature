# 本 .feature 文件实现 FT-01-US-05（操作触发登录）
# 源码依据: web-ui/src/components/Navbar.tsx（navLinks authRequired、
#   handleProjectsClick 未登录 preventDefault + 弹登录弹窗、pendingAction 续接机制）、
#   web-ui/src/components/LoginModal.tsx（onSuccess 回调：操作触发登录成功后续接原操作）
# 种子数据依据: server/data/users.json（woolenwhimsy / knit123，displayName "Sarah Chen"）
# 页面集合依据: US 卡片 AskMe 决策点 4 口径（首页/广场(社区)/图案库/关于）
# 注: AC-2 的注册路径暂不在实例化范围——LoginModal 注册功能未交付
#   （"注册功能即将上线"，FT-01-US-01 TODO），本层覆盖登录续接路径

@FT-01-US-05
@layer:e2e
Feature: 操作触发登录

  作为一个未登录的访客，
  我在做需要登录的操作时想要被引导到登录弹窗、并在登录后继续刚才想做的事，
  以便顺畅完成操作而不被一堵"请先登录"的墙挡住。

  Background:
    Given 系统中存在如下注册用户：
      | username     | password | displayName |
      | woolenwhimsy | knit123  | Sarah Chen  |
    And 用户处于未登录状态，正在浏览首页 "/"

  # source: web-ui/src/components/Navbar.tsx（handleProjectsClick：未登录 preventDefault + setShowLogin(true)，不发生路由跳转）
  @AC-1
  Scenario: AC-1 个人数据入口未登录点击弹出登录弹窗且不发生页面跳转
    When 用户点击导航栏的"我的项目"链接
    Then 弹出标题为"欢迎回来"的登录弹窗
    And 页面停留在首页 "/"
    And 导航栏仍显示"登录 / 注册"按钮

  # source: web-ui/src/components/Navbar.tsx（openLoginForAction 记录待续接操作）+
  #   LoginModal.tsx（登录成功 onClose 后调用 onSuccess(user) 续接原操作）
  @AC-2
  Scenario: AC-2 弹窗内登录成功后自动续接进入"我的项目"
    When 用户点击导航栏的"我的项目"链接
    And 在"用户名"输入框输入 "woolenwhimsy"
    And 在"密码"输入框输入 "knit123"
    And 点击"登 录"按钮
    Then 登录弹窗关闭，标题"欢迎回来"不再显示
    And 导航栏不再显示"登录 / 注册"按钮，改为显示用户名"Sarah Chen"与"退出"按钮
    And 页面导航至个人页 "/users/woolenwhimsy"，头部展示如下信息：
      | 字段     | 值            |
      | 显示名称 | Sarah Chen    |
      | 用户名   | @woolenwhimsy |

  # source: App.tsx 路由（/、/community、/patterns、/about 均为公开页面，无鉴权守卫）
  @AC-3
  Scenario: AC-3 未登录访客连续浏览公开页面全程无登录拦截
    When 未登录访客依次浏览如下公开页面：
      | 页面   | 路径        |
      | 首页   | /           |
      | 广场   | /community  |
      | 图案库 | /patterns   |
      | 关于   | /about      |
    Then 全程无登录弹窗出现
    And 每个页面均正常浏览且未发生登录页跳转
