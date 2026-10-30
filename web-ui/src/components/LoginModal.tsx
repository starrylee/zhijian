import { useState } from "react";
import { useAuth, User } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface LoginModalProps {
  onClose: () => void;
  /**
   * FT-01-US-05 操作触发登录：登录成功后的续接回调。
   * - 传入时（操作触发场景）：弹窗关闭后由回调执行原操作（FT-02/03/04 各自的
   *   需登录操作按此口径接入，AC-2 登录续接）；
   * - 不传时（主动登录场景）：保持决策 6 默认行为——跳转个人页。
   */
  onSuccess?: (user: User) => void;
}

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 空输入前端必填校验（登录 FT-01-US-02 AC-3 决策 7 / 注册同口径），不向后端发请求
    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }
    if (isRegister) {
      // FT-01-US-01 AC-3：密码 <6 位前端拦截（与后端 400 校验双保险）
      if (password.length < 6) {
        setError("密码至少需要 6 位");
        return;
      }
      const result = await register(username.trim(), password);
      if (result.user) {
        // AC-1：注册成功即时进入登录态，续接口径与登录一致
        onClose();
        if (onSuccess) {
          onSuccess(result.user);
        } else {
          navigate(`/users/${result.user.username}`);
        }
      } else {
        // AC-2：409「用户名已被占用」等后端提示透出，表单保留已填内容
        setError(result.error);
      }
      return;
    }
    const user: User | null = await login(username, password);
    if (user) {
      onClose();
      if (onSuccess) {
        // FT-01-US-05 AC-2：操作触发登录成功，续接原操作
        onSuccess(user);
      } else {
        // 决策 6：主动登录成功跳转个人页
        navigate(`/users/${user.username}`);
      }
    } else {
      // AC-2：统一提示，不区分用户名或密码错误（防用户名枚举）
      setError("用户名或密码错误");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(44, 26, 14, 0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl shadow-2xl p-8 relative"
        style={{ background: "var(--card)", border: "1.5px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-2xl leading-none"
          style={{ color: "var(--muted-foreground)" }}
        >
          ×
        </button>

        <div className="mb-6 text-center">
          <span className="text-3xl">🧶</span>
          <h2 className="text-2xl font-bold mt-2" style={{ fontFamily: "Lora, serif", color: "var(--foreground)" }}>
            {isRegister ? "加入 KnitHub" : "欢迎回来"}
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
            {isRegister ? "开启你的编织之旅" : "登录你的编织笔记本"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-username" className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
              用户名
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="如 woolenwhimsy"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
              style={{
                background: "var(--muted)",
                border: "1.5px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
              密码
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2"
              style={{
                background: "var(--muted)",
                border: "1.5px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "#FDE8E0", color: "#B54B22", border: "1px solid #F4C9B8" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {isRegister ? "注 册" : "登 录"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            className="text-sm underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            {isRegister ? "已有账号？去登录" : "还没有账号？免费注册"}
          </button>
        </div>

        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
            演示账号：<strong>woolenwhimsy</strong> / knit123 · <strong>threadcountess</strong> / fiber456
          </p>
        </div>
      </div>
    </div>
  );
}
