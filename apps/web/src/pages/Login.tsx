import { FormEvent, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { SITE_NAME } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Login() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    setLoading(true);
    try {
      const deviceName = navigator.userAgent.slice(0, 80);
      const r = await api<{ user: { canViewLive?: boolean; canManage?: boolean } }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ code: value, deviceName }) });
      await new Promise((r) => setTimeout(r, 150));
      nav(r.user?.canManage || r.user?.canViewLive ? "/desk" : "/app", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title={SITE_NAME}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="code" className="text-sky-200">Access code</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-cyan-400/70" />
            <Input
              id="code"
              name="code"
              required
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="enter your secret code"
              className="rounded-full border-sky-500/30 bg-black/40 pl-10 focus-visible:ring-cyan-500"
            />
          </div>
        </div>
        <Button className="btn-infinity w-full" disabled={loading}>
          {loading ? "Signing in…" : "Enter Infinity X"}
        </Button>
        <p className="text-center text-xs text-sky-300/70">Code only. No names, no email.</p>
      </form>
    </AuthFrame>
  );
}

export function Register() {
  return <Navigate to="/login" replace />;
}

export function ForgotPassword() {
  return <Navigate to="/login" replace />;
}

export function ResetPassword() {
  return <Navigate to="/login" replace />;
}

export function VerifyEmail() {
  return <Navigate to="/login" replace />;
}

function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center p-4">
      <div className="infinity-bg star-field pointer-events-none absolute inset-0">
        <span className="infinity-orb" />
        <span className="infinity-orb" />
      </div>
      <Card className="glass-panel relative w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 text-2xl font-bold text-white shadow-[0_0_30px_rgba(56,189,248,0.45)]">
            ∞
          </div>
          <CardTitle className="font-serif text-3xl leading-tight text-sky-100">{title}</CardTitle>
          <p className="text-sm text-sky-300/80">Private chat on Infinity X</p>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
