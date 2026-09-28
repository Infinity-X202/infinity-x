import { useEffect, useRef, useState } from "react";
import { Camera, Plus, SwitchCamera, Trash2, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Me } from "@/App";
import { api } from "@/lib/api";
import { ensureRealtime, onRealtime, onWsOpen, sendRealtime } from "@/lib/livecam-signaling";
import { addIce, captureVideoFrame, closePeer, createPeer } from "@/lib/livecam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Identity = {
  username: string;
  displayName: string;
  code: string;
  canViewLive: boolean;
  isStreamer: boolean;
  locked: boolean;
};

export function AdminPage({ me }: { me: Me }) {
  const [tab, setTab] = useState<"people" | "live">("people");
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-black/40">
      <div className="flex gap-2 border-b border-sky-500/20 p-3">
        <Button size="sm" variant={tab === "people" ? "default" : "secondary"} className="rounded-full" onClick={() => setTab("people")}>
          People & codes
        </Button>
        <Button size="sm" variant={tab === "live" ? "default" : "secondary"} className="rounded-full" onClick={() => setTab("live")}>
          Live camera
        </Button>
      </div>
      {tab === "people" ? <PeoplePanel canManage={Boolean(me.canManage)} /> : <LivePanel />}
    </div>
  );
}

function PeoplePanel({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-identities"],
    queryFn: () => api<{ identities: Identity[] }>("/api/v1/admin/identities"),
  });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [live, setLive] = useState(false);
  const [cam, setCam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, { displayName: string; code: string }>>({});

  const list = q.data?.identities ?? [];

  async function addPerson() {
    if (!name.trim() || !code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    setBusy(true);
    try {
      await api("/api/v1/admin/identities", {
        method: "POST",
        body: JSON.stringify({ displayName: name.trim(), code: code.trim(), canViewLive: live, isStreamer: cam }),
      });
      setName("");
      setCode("");
      setLive(false);
      setCam(false);
      toast.success("Person added");
      qc.invalidateQueries({ queryKey: ["admin-identities"] });
      qc.invalidateQueries({ queryKey: ["directory"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add");
    } finally {
      setBusy(false);
    }
  }

  async function save(username: string, ident: Identity) {
    const e = edits[username] ?? { displayName: ident.displayName, code: ident.code };
    try {
      await api(`/api/v1/admin/identities/${encodeURIComponent(username)}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName: e.displayName, code: e.code }),
      });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-identities"] });
      qc.invalidateQueries({ queryKey: ["directory"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not saved");
    }
  }

  async function toggle(username: string, patch: Partial<Identity>) {
    try {
      await api(`/api/v1/admin/identities/${encodeURIComponent(username)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      qc.invalidateQueries({ queryKey: ["admin-identities"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not updated");
    }
  }

  async function remove(username: string) {
    if (!confirm(`Delete ${username}? They will not be able to sign in.`)) return;
    try {
      await api(`/api/v1/admin/identities/${encodeURIComponent(username)}`, { method: "DELETE" });
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin-identities"] });
      qc.invalidateQueries({ queryKey: ["directory"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Not deleted");
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <h1 className="font-serif text-2xl text-sky-100">People & secret codes</h1>
      <p className="mt-1 text-xs text-sky-300/80">Change names, add or remove codes. Sign-in uses the code you set here.</p>
      {canManage && (
        <div className="mt-4 space-y-3 rounded-2xl border border-sky-500/25 bg-black/40 p-4">
          <p className="text-sm font-medium text-sky-100">Add person</p>
          <Input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Secret code" value={code} onChange={(e) => setCode(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-sky-200">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Can open admin live view
          </label>
          <label className="flex items-center gap-2 text-sm text-sky-200">
            <input type="checkbox" checked={cam} onChange={(e) => setCam(e.target.checked)} />
            Sends camera (streamer)
          </label>
          <Button className="rounded-full" disabled={busy} onClick={() => void addPerson()}>
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {list.map((ident) => {
          const e = edits[ident.username] ?? { displayName: ident.displayName, code: ident.code };
          return (
            <div key={ident.username} className="rounded-2xl border border-sky-500/20 bg-black/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-cyan-400/70">{ident.username}</span>
                {ident.locked && <span className="text-[10px] text-sky-400/60">locked</span>}
                {ident.isStreamer && <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-200">camera</span>}
                {ident.canViewLive && <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-200">live view</span>}
              </div>
              <Input
                className="mt-2"
                disabled={!canManage}
                value={e.displayName}
                onChange={(ev) => setEdits((s) => ({ ...s, [ident.username]: { ...e, displayName: ev.target.value } }))}
              />
              <Input
                className="mt-2"
                disabled={!canManage}
                value={e.code}
                onChange={(ev) => setEdits((s) => ({ ...s, [ident.username]: { ...e, code: ev.target.value } }))}
              />
              {canManage && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" className="rounded-full" onClick={() => void save(ident.username, ident)}>
                    Save
                  </Button>
                  <Button size="sm" variant="secondary" className="rounded-full" onClick={() => void toggle(ident.username, { canViewLive: !ident.canViewLive })}>
                    {ident.canViewLive ? "Disable live" : "Enable live"}
                  </Button>
                  <Button size="sm" variant="secondary" className="rounded-full" onClick={() => void toggle(ident.username, { isStreamer: !ident.isStreamer })}>
                    {ident.isStreamer ? "Stop camera" : "Set camera"}
                  </Button>
                  {!ident.locked && (
                    <Button size="sm" variant="ghost" className="ml-auto text-rose-300" onClick={() => void remove(ident.username)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LivePanel() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const liveRef = useRef(false);
  const iceBuf = useRef<{ candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null }[]>([]);
  const handling = useRef(false);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState("Waiting for stream…");
  const [facing, setFacing] = useState<"user" | "environment">("user");

  function switchCam(mode: "user" | "environment") {
    setFacing(mode);
    sendRealtime({ type: "livecam.switch", payload: { facing: mode } });
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !liveRef.current) {
      toast.error("Wait for live video first");
      return;
    }
    if (captureVideoFrame(video)) toast.success("Photo saved to your device");
    else toast.error("Could not capture photo");
  }

  useEffect(() => {
    ensureRealtime();

    function requestWatch() {
      sendRealtime({ type: "livecam.watch" });
      if (!liveRef.current) setStatus("Waiting for stream…");
    }

    requestWatch();
    const offOpen = onWsOpen(requestWatch);
    const retry = window.setInterval(() => {
      if (!liveRef.current) requestWatch();
    }, 6000);

    async function flushIce(conn: RTCPeerConnection) {
      const queued = iceBuf.current.splice(0);
      for (const c of queued) await addIce(conn, c);
    }

    function wireConn(conn: RTCPeerConnection) {
      conn.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream(ev.track ? [ev.track] : []);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        setLive(true);
        liveRef.current = true;
        setStatus("Live");
      };
      conn.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        sendRealtime({
          type: "livecam.ice",
          payload: {
            candidate: ev.candidate.candidate,
            sdpMid: ev.candidate.sdpMid,
            sdpMLineIndex: ev.candidate.sdpMLineIndex,
          },
        });
      };
      conn.onconnectionstatechange = () => {
        if (conn.connectionState === "failed" || conn.connectionState === "disconnected") {
          setLive(false);
          liveRef.current = false;
          setStatus("Connection lost — reconnecting…");
          sendRealtime({ type: "livecam.watch" });
        }
      };
    }

    const offMsg = onRealtime(async (msg) => {
      if (msg.type === "livecam.offer") {
        const p = msg.payload as { sdp?: string };
        if (!p.sdp || handling.current) return;
        handling.current = true;
        iceBuf.current = [];
        try {
          closePeer(pc.current);
          const conn = createPeer();
          pc.current = conn;
          wireConn(conn);
          await conn.setRemoteDescription({ type: "offer", sdp: p.sdp });
          await flushIce(conn);
          const answer = await conn.createAnswer();
          await conn.setLocalDescription(answer);
          sendRealtime({ type: "livecam.answer", payload: { sdp: answer.sdp! } });
        } catch {
          setLive(false);
          liveRef.current = false;
          setStatus("Reconnecting…");
          sendRealtime({ type: "livecam.watch" });
        } finally {
          handling.current = false;
        }
        return;
      }
      if (msg.type === "livecam.ice") {
        const p = msg.payload as { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
        if (!p.candidate) return;
        const conn = pc.current;
        if (!conn || !conn.remoteDescription) {
          iceBuf.current.push(p as { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null });
          return;
        }
        await addIce(conn, p);
      }
    });

    return () => {
      offOpen();
      offMsg();
      window.clearInterval(retry);
      sendRealtime({ type: "livecam.unwatch" });
      closePeer(pc.current);
      pc.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-black/40 p-4 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Video className="h-5 w-5 text-cyan-400" />
        <div>
          <h1 className="font-serif text-2xl text-sky-100">Admin panel</h1>
          <p className="text-xs text-sky-300/80">Live camera · front / back</p>
        </div>
        <span
          className={`ml-auto flex items-center gap-2 rounded-full px-3 py-1 text-xs ${live ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-sky-300/70"}`}
        >
          <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-zinc-500"}`} />
          {status}
        </span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-sky-500/30 bg-zinc-950 shadow-[0_0_60px_rgba(56,189,248,0.15)]">
        <video ref={videoRef} autoPlay playsInline muted={false} className="h-full w-full object-cover" />
        {!live && (
          <div className="absolute inset-0 grid place-items-center bg-black/70">
            <div className="max-w-xs px-6 text-center">
              <VideoOff className="mx-auto h-12 w-12 text-cyan-400/50" />
              <p className="mt-3 text-sm text-sky-200/80">{status}</p>
              <p className="mt-3 text-xs leading-relaxed text-cyan-400/70">
                1. On another phone sign in with Nova code: IX-NOVA-7X
                <br />
                2. Stay on this page with xadmin or lund
                <br />
                3. Nova allows the camera, then use Front / Back
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={cn("rounded-full", facing === "user" && "ring-2 ring-cyan-400")}
          onClick={() => switchCam("user")}
        >
          <SwitchCamera className="mr-1.5 h-4 w-4" />
          Front
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={cn("rounded-full", facing === "environment" && "ring-2 ring-cyan-400")}
          onClick={() => switchCam("environment")}
        >
          <SwitchCamera className="mr-1.5 h-4 w-4 rotate-180" />
          Back
        </Button>
        <Button type="button" size="sm" className="ml-auto rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600" onClick={takePhoto}>
          <Camera className="mr-1.5 h-4 w-4" />
          Save photo
        </Button>
      </div>
    </div>
  );
}
