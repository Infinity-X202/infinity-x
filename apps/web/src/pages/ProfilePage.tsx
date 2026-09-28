import { FormEvent } from "react";
import { toast } from "sonner";
import type { Me } from "@/App";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { SITE_NAME } from "@/lib/brand";

export function ProfilePage({ me }: { me: Me }) {
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/v1/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: String(fd.get("displayName")),
        bio: String(fd.get("bio")),
      }),
    });
    toast.success("Profilo aggiornato");
  }
  return (
    <div className="relative mx-auto w-full max-w-xl p-6">
      <div className="infinity-bg pointer-events-none absolute inset-0 opacity-50" />
      <Card className="glass-panel relative">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3">
            <UserAvatar name={me.displayName} src={me.avatarUrl} className="h-20 w-20 text-lg ring-2 ring-cyan-400/40" />
          </div>
          <CardTitle className="font-serif text-2xl text-sky-100">{me.displayName}</CardTitle>
          <p className="text-xs text-sky-300/70">@{me.username} · {SITE_NAME}</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label className="text-sky-200">Username</Label>
              <Input value={me.username} disabled className="rounded-full border-sky-500/30 bg-black/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sky-200">Nome visibile</Label>
              <Input id="displayName" name="displayName" defaultValue={me.displayName} className="rounded-full border-sky-500/30 bg-black/40" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio" className="text-sky-200">Bio</Label>
              <Textarea id="bio" name="bio" defaultValue={me.bio ?? ""} className="border-sky-500/30 bg-black/40" />
            </div>
            <Button className="btn-infinity w-full">Salva profilo</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
