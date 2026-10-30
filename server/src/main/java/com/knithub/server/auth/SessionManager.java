package com.knithub.server.auth;

import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 内存会话管理器（技术方案 3.5，会话不落盘）。
 *
 * <p>存储：{@code ConcurrentHashMap<sid, userId>}。会话有效期口径已裁定
 * （FT-01 决策 2，2026-09-07）：无显式过期——服务不重启则一直有效，登出即
 * 失效，故无过期清理逻辑；服务重启全部失效（已确认可接受的 MVP 取舍）。
 *
 * <p>Cookie {@code sid} 属性由 Controller 层统一设置：HttpOnly + SameSite=Lax
 * + Max-Age 7 天（必须设 Max-Age，否则默认会话 Cookie 关浏览器即失效，
 * 违反「重开浏览器不掉登录态」验收口径）。
 *
 * <p>实现于 FT-01-US-02（创建/查询；销毁随 US-04 登出接入）。
 */
@Component
public class SessionManager {

    private final ConcurrentHashMap<String, Long> sessions = new ConcurrentHashMap<>();

    /**
     * 建立会话，返回新分配的 sid。
     */
    public String createSession(Long userId) {
        String sid = UUID.randomUUID().toString();
        sessions.put(sid, userId);
        return sid;
    }

    /**
     * 按 sid 查登录用户 id。
     *
     * @return 有效会话的用户 id；sid 为空或不存在时为 empty
     */
    public Optional<Long> getUserId(String sid) {
        if (sid == null || sid.isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(sessions.get(sid));
    }

    /**
     * 销毁会话（FT-01-US-04 登出）：sid 从存储中移除，此后 getUserId 一律
     * 返回 empty——登出即失效，旧会话不可复用（AC-2）。
     */
    public void invalidate(String sid) {
        if (sid != null) {
            sessions.remove(sid);
        }
    }
}
