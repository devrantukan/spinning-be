"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === "/admin/login") {
      setLoading(false);
      return;
    }

    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth error:", error);
          router.push("/admin/login");
          setLoading(false);
          return;
        }

        if (!session) {
          router.push("/admin/login");
          setLoading(false);
          return;
        }

        setUser(session.user);

        // Store session for API calls
        localStorage.setItem("supabase_session", JSON.stringify(session));
        localStorage.setItem("admin_auth_token", session.access_token);

        setLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        router.push("/admin/login");
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (pathname === "/admin/login") return;

      if (!session) {
        router.push("/admin/login");
      } else {
        setUser(session.user);
        localStorage.setItem("supabase_session", JSON.stringify(session));
        localStorage.setItem("admin_auth_token", session.access_token);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("supabase_session");
    localStorage.removeItem("admin_auth_token");
    router.push("/admin/login");
  };

  const navItems = [
    { path: "/admin", label: t("admin.dashboard"), icon: "📊" },
    {
      path: "/admin/organizations",
      label: t("admin.organizations"),
      icon: "🏢",
    },
    { path: "/admin/users", label: t("admin.users"), icon: "👥" },
    { path: "/admin/classes", label: t("admin.classes"), icon: "🚴" },
    { path: "/admin/sessions", label: t("admin.sessions"), icon: "📅" },
    { path: "/admin/bookings", label: t("admin.bookings"), icon: "🎫" },
    { path: "/admin/members", label: t("admin.members"), icon: "👤" },
    { path: "/admin/instructors", label: t("admin.instructors"), icon: "🎓" },
  ];

  // Don't show sidebar on login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
          gap: "1rem",
        }}
      >
        <div>{t("common.loading")}</div>
        <div style={{ fontSize: "0.85rem", color: "#666" }}>
          {t("admin.checkingAuth")}
        </div>
        <button
          onClick={() => {
            setLoading(false);
            router.push("/admin/login");
          }}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#1976d2",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          {t("admin.goToLogin")}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui" }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarCollapsed ? "70px" : "250px",
          backgroundColor: theme === "dark" ? "#1e1e1e" : "#1e1e1e",
          color: "white",
          padding: sidebarCollapsed ? "1rem 0.5rem" : "1.5rem",
          position: "fixed",
          height: "100vh",
          overflowY: "auto",
          overflowX: "hidden",
          zIndex: 1000,
          left: 0,
          top: 0,
          transition: "width 0.3s ease, padding 0.3s ease",
          boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          {!sidebarCollapsed && (
            <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: "1.25rem" }}>
              {t("admin.panel")}
            </h2>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              backgroundColor: "transparent",
              border: "1px solid #444",
              color: "white",
              borderRadius: "4px",
              padding: "0.5rem",
              cursor: "pointer",
              fontSize: "1.2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "32px",
              height: "32px",
              marginLeft: sidebarCollapsed ? 0 : "auto",
            }}
            title={
              sidebarCollapsed
                ? t("admin.expandSidebar")
                : t("admin.collapseSidebar")
            }
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>
        <nav>
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  padding: sidebarCollapsed ? "0.75rem" : "0.75rem 1rem",
                  marginBottom: "0.5rem",
                  borderRadius: "6px",
                  textDecoration: "none",
                  color: isActive ? "#1e1e1e" : "white",
                  backgroundColor: isActive ? "#fff" : "transparent",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
                title={sidebarCollapsed ? item.label : ""}
              >
                <span
                  style={{
                    marginRight: sidebarCollapsed ? 0 : "0.5rem",
                    fontSize: "1.2rem",
                    minWidth: "24px",
                    textAlign: "center",
                    display: "inline-block",
                  }}
                >
                  {item.icon}
                </span>
                {!sidebarCollapsed && (
                  <span
                    style={{
                      opacity: sidebarCollapsed ? 0 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div
          style={{
            marginTop: "2rem",
            paddingTop: "2rem",
            borderTop: "1px solid #444",
          }}
        >
          {user && !sidebarCollapsed && (
            <div
              style={{
                padding: "0.75rem 1rem",
                marginBottom: "0.5rem",
                fontSize: "0.85rem",
                color: "#ccc",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <div style={{ marginBottom: "0.25rem" }}>{user.email}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#d32f2f",
              color: "white",
              cursor: "pointer",
              fontSize: "0.9rem",
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
            title={sidebarCollapsed ? t("common.logout") : ""}
          >
            {sidebarCollapsed ? "🚪" : t("common.logout")}
          </button>
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.75rem 1rem",
              borderRadius: "6px",
              textDecoration: "none",
              color: "white",
              backgroundColor: "transparent",
              gap: "0.5rem",
            }}
            title={sidebarCollapsed ? t("common.backToHome") : ""}
          >
            {sidebarCollapsed ? "🏠" : t("common.backToHome")}
          </Link>
          <div
            style={{
              marginTop: "1rem",
              paddingTop: "1rem",
              borderTop: "1px solid #444",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {/* Language Switcher */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
              >
                <button
                  onClick={() => setLanguage("en")}
                  style={{
                    padding: "0.5rem",
                    backgroundColor:
                      language === "en" ? "#1976d2" : "transparent",
                    border: "1px solid #444",
                    color: "white",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    minWidth: sidebarCollapsed ? "32px" : "auto",
                  }}
                  title="English"
                >
                  {sidebarCollapsed ? "🇬🇧" : "EN"}
                </button>
                <button
                  onClick={() => setLanguage("tr")}
                  style={{
                    padding: "0.5rem",
                    backgroundColor:
                      language === "tr" ? "#1976d2" : "transparent",
                    border: "1px solid #444",
                    color: "white",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    minWidth: sidebarCollapsed ? "32px" : "auto",
                  }}
                  title="Türkçe"
                >
                  {sidebarCollapsed ? "🇹🇷" : "TR"}
                </button>
              </div>
              {/* Theme Switcher */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
              >
                <button
                  onClick={() => setTheme("light")}
                  style={{
                    padding: "0.5rem",
                    backgroundColor:
                      theme === "light" ? "#ffa726" : "transparent",
                    border: "1px solid #444",
                    color: "white",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    minWidth: sidebarCollapsed ? "32px" : "auto",
                  }}
                  title={t("admin.lightTheme")}
                >
                  {sidebarCollapsed
                    ? "☀️"
                    : `☀️ ${t("admin.lightTheme").split(" ")[0]}`}
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  style={{
                    padding: "0.5rem",
                    backgroundColor:
                      theme === "dark" ? "#1976d2" : "transparent",
                    border: "1px solid #444",
                    color: "white",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    minWidth: sidebarCollapsed ? "32px" : "auto",
                  }}
                  title={t("admin.darkTheme")}
                >
                  {sidebarCollapsed
                    ? "🌙"
                    : `🌙 ${t("admin.darkTheme").split(" ")[0]}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        style={{
          marginLeft: sidebarCollapsed ? "70px" : "300px",
          flex: 1,
          padding: "2rem",
          backgroundColor: theme === "dark" ? "#1a1a1a" : "#f5f5f5",
          color: theme === "dark" ? "#ffffff" : "#1a1a1a",
          minHeight: "100vh",
          width: sidebarCollapsed
            ? "calc(100vw - 70px)"
            : "calc(100vw - 300px)",
          transition:
            "margin-left 0.3s ease, width 0.3s ease, background-color 0.3s ease, color 0.3s ease",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </main>
    </div>
  );
}
