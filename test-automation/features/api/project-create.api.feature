@FT-02-US-01
@layer:api
Feature: 创建编织项目 - API 层

  作为一个已登录的织友用户，
  我想要创建一个新的编织项目（填写名称与预计完成日期，可选填里程碑），
  以便为每段编织旅程建立档案，后续在看板上追踪它的状态。

  # 依赖后端源码:
  #   - server/src/main/java/com/knithub/server/project/ProjectController.java（POST/GET /api/v1/projects、401 未登录、400 校验）
  #   - server/src/main/java/com/knithub/server/project/ProjectService.java（初始状态 todo、里程碑顺序内嵌、last_active_at=created_at）
  #   - server/src/main/java/com/knithub/server/project/dto/CreateProjectRequest.java（name/dueDate @NotBlank、milestones 可选）
  # 注: AC-5 的"跳转登录页"属 UI 端到端层职责；API 层实例化为未登录调用返回 401
  # 注: 实例化数据（项目名/日期）为 AI 草拟，待与 PO 核实

  Background:
    Given 请求基础地址为 "http://localhost:8080"

  # ========== AC-1: 成功创建项目 ==========

  @api:contract
  @AC-1
  Scenario: AC-1 接口契约 - 登录用户创建项目成功初始状态为待开始并出现在本人列表
    Given 用户 "woolenwhimsy" 使用密码 "knit123" 已登录
    When 发送 POST 请求 "/api/v1/projects"，请求体如下
    """
    {
      "name": "祖母的生日披肩",
      "dueDate": "2026-10-31"
    }
    """
    Then 响应状态码为 201
    And 响应中项目名称为 "祖母的生日披肩"
    And 响应中项目状态为 "todo"
    And 响应中里程碑列表为空
    When 发送 GET 请求 "/api/v1/projects"
    Then 响应状态码为 200
    And 本人项目列表包含名称为 "祖母的生日披肩" 且状态为 "todo" 的项目

  # ========== AC-2: 创建时可选携带里程碑 ==========

  @api:contract
  @AC-2
  Scenario: AC-2 接口契约 - 携带里程碑创建成功按顺序排列且均未完成
    Given 用户 "woolenwhimsy" 使用密码 "knit123" 已登录
    When 发送 POST 请求 "/api/v1/projects"，请求体如下
    """
    {
      "name": "圣诞袜",
      "dueDate": "2026-12-24",
      "milestones": [
        {"name": "织袜筒", "dueDate": "2026-12-01"},
        {"name": "收口"}
      ]
    }
    """
    Then 响应状态码为 201
    And 响应中项目名称为 "圣诞袜"
    And 响应中里程碑列表为
      | name   | dueDate    | completed |
      | 织袜筒 | 2026-12-01 | false     |
      | 收口   |            | false     |

  # ========== AC-3: 必填项校验 ==========

  @api:error
  @AC-3
  Scenario: AC-3 错误码 - 项目名称为空返回 400 提示必填
    Given 用户 "woolenwhimsy" 使用密码 "knit123" 已登录
    When 发送 POST 请求 "/api/v1/projects"，请求体如下
    """
    {
      "name": "",
      "dueDate": "2026-11-15"
    }
    """
    Then 响应状态码为 400
    And 返回如下错误信息
    """
    {
      "message": "请填写项目名称"
    }
    """
    When 发送 GET 请求 "/api/v1/projects"
    Then 本人项目列表不包含名称为 "祖母的生日披肩" 的项目

  @api:error
  @AC-3
  Scenario: AC-3 错误码 - 未选择预计完成日期返回 400 提示必填
    Given 用户 "woolenwhimsy" 使用密码 "knit123" 已登录
    When 发送 POST 请求 "/api/v1/projects"，请求体如下
    """
    {
      "name": "围巾"
    }
    """
    Then 响应状态码为 400
    And 返回如下错误信息
    """
    {
      "message": "请选择预计完成日期"
    }
    """

  # ========== AC-4: 表单内里程碑名称必填 ==========

  @api:error
  @AC-4
  Scenario: AC-4 错误码 - 里程碑名称为空返回 400 提示必填
    Given 用户 "woolenwhimsy" 使用密码 "knit123" 已登录
    When 发送 POST 请求 "/api/v1/projects"，请求体如下
    """
    {
      "name": "圣诞袜",
      "dueDate": "2026-12-24",
      "milestones": [
        {"name": ""}
      ]
    }
    """
    Then 响应状态码为 400
    And 返回如下错误信息
    """
    {
      "message": "里程碑名称必填"
    }
    """

  # ========== AC-5: 未登录不可创建 ==========

  @api:error
  @AC-5
  Scenario: AC-5 错误码 - 未登录创建项目返回 401
    Given 请求认证状态为 "未登录"
    When 发送 POST 请求 "/api/v1/projects"，请求体如下
    """
    {
      "name": "祖母的生日披肩",
      "dueDate": "2026-10-31"
    }
    """
    Then 响应状态码为 401
