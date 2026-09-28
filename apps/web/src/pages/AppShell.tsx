import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { ADMIN_USERNAME } from "@ixm/shared";
import { LogOut, MessageCircle, Settings, Shield, User } from "lucide-react";
import type { Me } from "@/App";
import { api } from "@/lib/api";
import { ensureDeviceKeys } from "@/lib/e2ee";
import { Button } from "@/components/ui/button";
import { ChatHome } from "./ChatHome";
import { ProfilePage } from "./ProfilePage";
import { SettingsPages } from "./SettingsPages";
import { AdminPage } from "./AdminPage";
import { LiveCamPublisher } from "@/components/LiveCamPublisher";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/brand";

export function AppShell({ me }: { me: Me }) {
  const nav = useNavigate();
  const loc = useLocation();
  const isAdmin = me.canManage || me.username === ADMIN_USERNAME;
  const canLive = me.canViewLive || isAdmin;
  const inThread =
    /^\/app\/[^/]+$/.test(loc.pathname) &&
    !["/app/profile", "/app/settings", "/app/security", "/app/devices", "/app/privacy", "/app/blocked", "/app/admin"].includes(loc.pathname);

  useEffect(() => {
    document.title = SITE_NAME;
    (async () => {
      const keys = await ensureDeviceKeys();
      const existing = await api<{ devices: { id: string; publicKey: string }[] }>("/api/v1/devices");
      const match = existing.devices.find((d) => d.publicKey === keys.publicKeySpki);
      if (match) {
        localStorage.setItem("ixm-device-id", match.id);
        return;
      }
      const created = await api<{ device: { id: string } }>("/api/v1/devices", {
        method: "POST",
        body: JSON.stringify({ deviceName: navigator.userAgent.slice(0, 60), publicKey: keys.publicKeySpki }),
      });
      localStorage.setItem("ixm-device-id", created.device.id);
    })().catch(() => undefined);
  }, []);

  async function logout() {
    await api("/api/v1/auth/logout", { method: "POST" });
    nav("/login");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {me.isStreamer && <LiveCamPublisher />}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-16 flex-col items-center border-r border-sky-500/20 bg-black/30 py-4 backdrop-blur md:flex">
          <span className="mb-6 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-600 text-sm font-bold text-white shadow-[0_0_16px_rgba(56,189,248,0.4)]">
            ∞
          </span>
          <Nav to="/app" icon={<MessageCircle className="h-5 w-5" />} />
          <Nav to="/app/profile" icon={<User className="h-5 w-5" />} />
          {isAdmin && <Nav to="/app/settings" icon={<Settings className="h-5 w-5" />} />}
          {canLive && <Nav to="/app/admin" icon={<Shield className="h-5 w-5" />} />}
          <div className="mt-auto flex flex-col gap-2">
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Routes>
            <Route path="admin" element={canLive ? <AdminPage me={me} /> : <Navigate to="/app" replace />} />
            <Route path="profile" element={<ProfilePage me={me} />} />
            <Route path="settings" element={isAdmin ? <SettingsPages me={me} tab="settings" /> : <Navigate to="/app" replace />} />
            <Route path="security" element={isAdmin ? <SettingsPages me={me} tab="security" /> : <Navigate to="/app" replace />} />
            <Route path="devices" element={isAdmin ? <SettingsPages me={me} tab="devices" /> : <Navigate to="/app" replace />} />
            <Route path="privacy" element={isAdmin ? <SettingsPages me={me} tab="privacy" /> : <Navigate to="/app" replace />} />
            <Route path="blocked" element={isAdmin ? <SettingsPages me={me} tab="blocked" /> : <Navigate to="/app" replace />} />
            <Route path=":conversationId" element={<ChatHome me={me} />} />
            <Route path="" element={<ChatHome me={me} />} />
          </Routes>
        </div>
      </div>
      <nav className={cn("flex items-center justify-around border-t border-sky-500/20 bg-black/40 py-2 md:hidden", inThread && !canLive && "hidden")}>
        <Nav to="/app" icon={<MessageCircle className="h-5 w-5" />} />
        <Nav to="/app/profile" icon={<User className="h-5 w-5" />} />
        {isAdmin && <Nav to="/app/settings" icon={<Settings className="h-5 w-5" />} />}
        {canLive && <Nav to="/app/admin" icon={<Shield className="h-5 w-5" />} />}
      </nav>
    </div>
  );
}

function Nav({ to, icon }: { to: string; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/app"}
      className={({ isActive }) =>
        `mb-1 grid h-10 w-10 place-items-center rounded-full ${isActive ? "bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg" : "text-sky-300/70 hover:bg-sky-500/15"}`
      }
    >
      {icon}
    </NavLink>
  );
}
