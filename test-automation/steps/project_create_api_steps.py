"""创建编织项目 API 层（FT-02-US-01）的 Step Definitions。

覆盖 features/api/project-create.api.feature：接口契约（@api:contract）、
错误码（@api:error）。

登录策略：通过种子用户（server/data/users.json）走真实登录端点
POST /api/v1/auth/login 建立会话 Cookie sid，requests.Session 自动携带。

清理说明：创建成功的项目 ID 会追加到 context.projects_to_cleanup；
后端删除端点尚未交付（FT-02-US-03 TODO），environment.py 的清理钩子
当前仅记录跳过警告，不影响场景判定。
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from assertpy import assert_that
from behave import given, then, when

from core.api_client import APIClient
from core.logger import get_logger
from core.response_validator import ResponseValidator

logger = get_logger(__name__)


# ======================================================================
# Given：前置条件与数据准备
# ======================================================================
@given('用户 "{username}" 使用密码 "{password}" 已登录')
def step_user_logged_in(context, username, password):
    """以种子用户走真实登录端点建立会话（Cookie sid 由 Session 持有）。"""
    response = context.api_client.post(
        "/api/v1/auth/login",
        json_body={"username": username, "password": password},
    )
    assert_that(response.status_code).described_as(
        f"种子用户 {username} 登录失败（status={response.status_code}），"
        "请确认后端已启动且 server/data/users.json 种子数据就绪。"
        f"响应：{response.text[:300]}"
    ).is_equal_to(200)
    logger.info("用户 %s 已登录（会话 Cookie 已建立）", username)


# ======================================================================
# When：用户操作 / 触发动作
# ======================================================================
@when('发送 GET 请求 "{path}"')
def step_send_get_request(context, path):
    """发送 GET 请求。"""
    response = context.api_client.get(path)
    context.response = response
    context.validator = ResponseValidator(response)
    logger.info("GET %s → %s", path, response.status_code)


# ======================================================================
# Then：断言 / 验证
# ======================================================================
@then('响应中项目名称为 "{name}"')
def step_assert_project_name(context, name):
    """断言创建响应中的项目名称。"""
    assert_that(context.validator.json["name"]).is_equal_to(name)


@then('响应中项目状态为 "{status}"')
def step_assert_project_status(context, status):
    """断言创建响应中的项目初始状态（AC-1：todo）。"""
    assert_that(context.validator.json["status"]).is_equal_to(status)


@then('响应中里程碑列表为空')
def step_assert_milestones_empty(context):
    """断言创建响应中无里程碑（AC-1 示例 1：不填里程碑）。"""
    assert_that(context.validator.json["milestones"]).is_empty()


@then('响应中里程碑列表为')
def step_assert_milestones_table(context):
    """按表格逐行断言里程碑顺序、日期与完成状态（AC-2）。"""
    actual: List[Dict[str, Any]] = context.validator.json["milestones"]
    assert_that(len(actual)).described_as(
        f"里程碑数量不符，期望 {len(context.table.rows)} 实际 {len(actual)}：{actual}"
    ).is_equal_to(len(context.table.rows))

    for index, row in enumerate(context.table):
        expected_name = row["name"]
        expected_due = row["dueDate"] or None
        expected_completed = row["completed"].lower() == "true"

        assert_that(actual[index]["name"]).described_as(
            f"第 {index + 1} 条里程碑名称不符（顺序应保持填写顺序）"
        ).is_equal_to(expected_name)

        actual_due = actual[index].get("dueDate")
        assert_that(actual_due).described_as(
            f"第 {index + 1} 条里程碑日期不符：期望 {expected_due} 实际 {actual_due}"
        ).is_equal_to(expected_due)

        assert_that(actual[index]["completed"]).described_as(
            f"第 {index + 1} 条里程碑应为未完成"
        ).is_equal_to(expected_completed)

    # 创建成功 → 登记清理列表（删除端点未交付，钩子仅告警跳过）
    project_id = context.validator.json.get("id")
    if project_id is not None:
        context.projects_to_cleanup.append(project_id)


@then('本人项目列表包含名称为 "{name}" 且状态为 "{status}" 的项目')
def step_assert_list_contains(context, name, status):
    """断言 GET /api/v1/projects 本人列表包含指定项目（AC-1 Then）。"""
    projects: List[Dict[str, Any]] = context.validator.json
    matched = [p for p in projects if p.get("name") == name]
    assert_that(matched).described_as(
        f"项目列表未出现 '{name}'。实际列表：{json.dumps(projects, ensure_ascii=False)[:500]}"
    ).is_not_empty()
    assert_that(matched[0]["status"]).is_equal_to(status)


@then('本人项目列表不包含名称为 "{name}" 的项目')
def step_assert_list_not_contains(context, name):
    """断言本人项目列表不含指定项目（校验失败未创建的防护性反例）。"""
    projects: List[Dict[str, Any]] = context.validator.json
    matched = [p for p in projects if p.get("name") == name]
    assert_that(matched).described_as(
        f"项目 '{name}' 不应被创建。实际列表：{json.dumps(projects, ensure_ascii=False)[:500]}"
    ).is_empty()
