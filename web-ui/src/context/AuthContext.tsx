import { createContext, useContext, useEffect, useState, ReactNode } from "react";

/**
 * 当前登录用户（POST /api/v1/auth/login 成功响应，camelCase 报文）。
 */
export interface User {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
}

interface AuthContextType {
  currentUser: User | null;
  /**
   * 会话恢复是否完成（FT-01-US-03-M02）：恢复查询返回即 true
   * （无论 200 还是 401）。false 期间为第三态——既不是游客也不是
   * 已登录，Navbar 据此推迟登录区渲染、消除"登录 / 注册"闪现。
   */
  initialized: boolean;
  login: (username: string, password: string) => Promise<User | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  initialized: false,
  login: async () => null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initialized, setInitialized] = useState(false);

  /**
   * 启动会话恢复（FT-01-US-03-M01）：应用加载时凭 Cookie sid 调
   * GET /api/v1/auth/me 恢复登录态，刷新/重开浏览器不掉线。
   * 401 是正常态（未登录游客），静默按 null 处理、不向用户报错；
   * 查询返回即置 initialized（M02：Navbar 恢复期不闪现"登录 / 注册"）。
   */
  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((user: User | null) => setCurrentUser(user))
      .catch(() => setCurrentUser(null))
      .finally(() => setInitialized(true));
  }, []);

  /**
   * 登录（FT-01-US-02）：调后端 /api/v1/auth/login，成功时服务端建立内存会话，
   * 浏览器收到 HttpOnly Cookie sid（同源经 Vite proxy，无需显式携带凭据）。
   * 失败（凭据错误/网络异常）返回 null，由调用方统一提示。
   */
  async function login(username: string, password: string): Promise<User | null> {
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        return null;
      }
      const user: User = await res.json();
      setCurrentUser(user);
      return user;
    } catch {
      return null;
    }
  }

  // TODO FT-01-US-04: 登出调后端销毁会话；当前仅清前端态
  function logout() {
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider value={{ currentUser, initialized, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
