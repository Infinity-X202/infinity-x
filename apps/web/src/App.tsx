import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { APP_NAME } from "@ixm/shared";
import { api } from "./lib/api";
import { Landing } from "./pages/Landing";
import { Login, Register, ForgotPassword, ResetPassword, VerifyEmail } from "./pages/Login";
import { AppShell } from "./pages/AppShell";
import { AdminPage } from "./pages/AdminPage";
import { ThemeProvider } from "./lib/theme";

export type Me = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
  emailVerifiedAt: string | null;
  canViewLive?: boolean;
  isStreamer?: boolean;
  canManage?: boolean;
};

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/app/*" element={<RequireAuth mode="chat" />} />
        <Route path="/desk" element={<RequireAuth mode="desk" />} />
      </Routes>
    </ThemeProvider>
  );
}

function RequireAuth({ mode }: { mode: "chat" | "desk" }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    let stop = false;
    (async () => {
      for (let i = 0; i < 6; i++) {
        try {
          const r = await api<{ user: Me }>("/api/v1/auth/me");
          if (!stop) setMe(r.user);
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 350 * (i + 1)));
        }
      }
      if (!stop) setMe(null);
    })();
    return () => {
      stop = true;
    };
  }, []);
  if (me === undefined) {
    return (
      <div className="relative grid min-h-screen place-items-center">
        <div className="infinity-bg pointer-events-none absolute inset-0" />
        <div className="relative text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 text-3xl font-bold text-white shadow-[0_0_40px_rgba(56,189,248,0.45)]">
            ∞
          </div>
          <p className="font-serif text-2xl text-sky-100">{APP_NAME}</p>
          <p className="mt-2 text-xs tracking-[0.3em] text-sky-400/70">LOADING</p>
        </div>
      </div>
    );
  }
  if (!me) return <Navigate to="/login" replace />;
  if (mode === "desk") {
    if (!me.canViewLive && !me.canManage) return <Navigate to="/app" replace />;
    return (
      <div className="h-screen overflow-hidden bg-background">
        <AdminPage me={me} />
      </div>
    );
  }
  return <AppShell me={me} />;
}
