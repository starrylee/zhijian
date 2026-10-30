import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginModal from "./LoginModal";

const navLinks = [
  { label: "首页", href: "/" },
  { label: "图案库", href: "/patterns" },
  { label: "我的项目", href: null, authRequired: true },
  { label: "社区", href: "/community" },
  { label: "关于", href: "/about" },
];

export default function Navbar() {
  const { currentUser, initialized, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleProjectsClick(e: React.MouseEvent) {
    if (!currentUser) {
      e.preventDefault();
      setShowLogin(true);
    } else {
      navigate(`/users/${currentUser.username}`);
    }
  }

  function getHref(link: typeof navLinks[number]) {
    if (link.label === "我的项目") return currentUser ? `/users/${currentUser.username}` : "#";
    return link.href || "#";
  }

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full"
        style={{ background: "var(--card)", borderBottom: "1.5px solid var(--border)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">🧶</span>
            <span
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "Lora, serif", color: "var(--primary)" }}
            >
              KnitHub
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = link.href && location.pathname === link.href;
              const href = getHref(link);
              return (
                <Link
                  key={link.label}
                  to={href}
                  onClick={link.label === "我的项目" ? handleProjectsClick : undefined}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={{
                    color: isActive ? "var(--primary)" : "var(--foreground)",
                    background: isActive ? "var(--muted)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--muted)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Auth area */}
          <div className="flex items-center gap-3">
            {/* 恢复期第三态（FT-01-US-03-M02）：会话恢复查询未返回前
                既不渲染"登录 / 注册"也不渲染用户态，消除游客按钮闪现 */}
            {initialized && currentUser ? (
              <div className="flex items-center gap-2">
                <Link
                  to={`/users/${currentUser.username}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    className="w-8 h-8 rounded-full object-cover"
                    style={{ border: "2px solid var(--border)" }}
                  />
                  <span className="text-sm font-medium hidden sm:block" style={{ color: "var(--foreground)" }}>
                    {currentUser.displayName}
                  </span>
                </Link>
                <button
                  onClick={logout}
                  className="text-sm px-3 py-1.5 rounded-md font-medium transition-colors"
                  style={{ color: "var(--muted-foreground)", background: "var(--muted)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--border)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--muted)")}
                >
                  退出
                </button>
              </div>
            ) : initialized ? (
              <button
                onClick={() => setShowLogin(true)}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                登录 / 注册
              </button>
            ) : null}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-1.5 rounded-md"
              style={{ background: "var(--muted)" }}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                {menuOpen
                  ? <path fillRule="evenodd" clipRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                  : <path fillRule="evenodd" clipRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden px-4 pb-4 space-y-1" style={{ background: "var(--card)", borderTop: "1px solid var(--border)" }}>
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={getHref(link)}
                onClick={(e) => {
                  setMenuOpen(false);
                  if (link.label === "我的项目") handleProjectsClick(e);
                }}
                className="block px-3 py-2 rounded-md text-sm font-medium"
                style={{ color: "var(--foreground)" }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
