import { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Me } from "@/App";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Tab = "settings" | "security" | "devices" | "privacy" | "blocked";

export function SettingsPages({ me, tab }: { me: Me; tab: Tab }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <nav className="flex flex-wrap gap-2 text-sm text-sky-200">
        <Link className="rounded-full border border-sky-500/25 bg-black/30 px-3 py-1 hover:bg-sky-500/15" to="/app/settings">
          Settings
        </Link>
        <Link className="rounded-full border border-sky-500/25 bg-black/30 px-3 py-1 hover:bg-sky-500/15" to="/app/security">
          Security
        </Link>
        <Link className="rounded-full border border-sky-500/25 bg-black/30 px-3 py-1 hover:bg-sky-500/15" to="/app/devices">
          Devices
        </Link>
        <Link className="rounded-full border border-sky-500/25 bg-black/30 px-3 py-1 hover:bg-sky-500/15" to="/app/privacy">
          Privacy
        </Link>
        <Link className="rounded-full border border-sky-500/25 bg-black/30 px-3 py-1 hover:bg-sky-500/15" to="/app/blocked">
          Blocked
        </Link>
      </nav>
      {tab === "settings" && <General me={me} />}
      {tab === "security" && <Security />}
      {tab === "devices" && <Devices />}
      {tab === "privacy" && <Privacy />}
      {tab === "blocked" && <Blocked />}
    </div>
  );
}

function General({ me }: { me: Me }) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="font-serif text-sky-100">Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-sky-200/80">
        <p>Code-only access on Infinity X.</p>
        <p>Pannello riservato ad Orbit (admin).</p>
        <p className="text-xs text-sky-400/70">Sei {me.displayName} · @{me.username}</p>
      </CardContent>
    </Card>
  );
}

function Security() {
  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: String(fd.get("currentPassword")),
        newPassword: String(fd.get("newPassword")),
      }),
    });
    toast.success("Password updated. Other sessions were revoked.");
  }
  async function logoutAll() {
    await api("/api/v1/auth/logout-all", { method: "POST" });
    location.href = "/login";
  }
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api<{ sessions: { id: string; deviceName: string | null; createdAt: string }[]; currentId: string }>("/api/v1/sessions"),
  });
  return (
    <div className="space-y-4">
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="font-serif text-sky-100">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={changePassword}>
            <div className="space-y-2">
              <Label>Current</Label>
              <Input name="currentPassword" type="password" required />
            </div>
            <div className="space-y-2">
              <Label>New</Label>
              <Input name="newPassword" type="password" required minLength={12} />
            </div>
            <Button>Update</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="font-serif text-sky-100">Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(sessions.data?.sessions ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span>
                {s.deviceName ?? "Session"} {s.id === sessions.data?.currentId ? "(this device)" : ""}
              </span>
              {s.id !== sessions.data?.currentId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => api(`/api/v1/sessions/${s.id}`, { method: "DELETE" }).then(() => sessions.refetch())}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
          <Button variant="destructive" onClick={logoutAll}>
            Log out all devices
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Devices() {
  const q = useQuery({
    queryKey: ["my-devices"],
    queryFn: () => api<{ devices: { id: string; deviceName: string; createdAt: string }[] }>("/api/v1/devices"),
  });
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="font-serif text-sky-100">E2EE devices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          Private keys never leave this browser. Revoking a device prevents it from unwrapping new messages.
        </p>
        {(q.data?.devices ?? []).map((d) => (
          <div key={d.id} className="flex items-center justify-between">
            <span>{d.deviceName}</span>
            <Button size="sm" variant="outline" onClick={() => api(`/api/v1/devices/${d.id}`, { method: "DELETE" }).then(() => q.refetch())}>
              Revoke
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Privacy() {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="font-serif text-sky-100">Privacy</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <p>HTTPS/TLS protects transport. It is not end-to-end encryption.</p>
        <p>Message bodies are stored as ciphertext. With E2EE envelopes, the server cannot read plaintext.</p>
        <p>Search of message bodies only matches ciphertext metadata you stored — not server-side plaintext.</p>
      </CardContent>
    </Card>
  );
}

function Blocked() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["blocked"],
    queryFn: () => api<{ blocked: { id: string; username: string; displayName: string }[] }>("/api/v1/blocks"),
  });
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="font-serif text-sky-100">Blocked users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(q.data?.blocked ?? []).length === 0 && <p className="text-sm text-muted-foreground">No blocked users.</p>}
        {(q.data?.blocked ?? []).map((u) => (
          <div key={u.id} className="flex items-center justify-between text-sm">
            <span>
              {u.displayName} @{u.username}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => api(`/api/v1/blocks/${u.id}`, { method: "DELETE" }).then(() => qc.invalidateQueries({ queryKey: ["blocked"] }))}
            >
              Unblock
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
