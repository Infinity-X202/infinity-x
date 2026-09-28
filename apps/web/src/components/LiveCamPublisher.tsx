import { useEffect, useRef } from "react";
import { ensureRealtime, onRealtime, sendRealtime } from "@/lib/livecam-signaling";
import { addIce, attachLocalCamera, closePeer, createPeer, stopStream } from "@/lib/livecam";

/** Nova sends camera when admin opens live view. */
export function LiveCamPublisher() {
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const facing = useRef<"user" | "environment">("user");
  const busy = useRef(false);
  const iceBuf = useRef<{ candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null }[]>([]);
  const streamingRef = useRef(false);

  useEffect(() => {
    ensureRealtime();

    async function flushIce(conn: RTCPeerConnection) {
      const queued = iceBuf.current.splice(0);
      for (const c of queued) await addIce(conn, c);
    }

    async function sendOffer(conn: RTCPeerConnection) {
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
      const offer = await conn.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
      await conn.setLocalDescription(offer);
      sendRealtime({ type: "livecam.offer", payload: { sdp: offer.sdp! } });
    }

    async function startOffer(mode: "user" | "environment" = facing.current) {
      if (busy.current) return;
      busy.current = true;
      facing.current = mode;
      iceBuf.current = [];
      try {
        stopStream(local.current);
        closePeer(pc.current);
        const conn = createPeer();
        pc.current = conn;
        local.current = await attachLocalCamera(conn, mode);
        streamingRef.current = true;
        await sendOffer(conn);
      } catch {
        streamingRef.current = false;
      } finally {
        busy.current = false;
      }
    }

    async function switchCamera(mode: "user" | "environment") {
      if (busy.current) return;
      facing.current = mode;
      await startOffer(mode);
    }

    return onRealtime(async (msg) => {
      if (msg.type === "livecam.viewer_join") {
        const p = msg.payload as { resume?: boolean };
        if (p.resume && streamingRef.current && pc.current?.connectionState === "connected") return;
        await startOffer(facing.current);
        return;
      }
      if (msg.type === "livecam.switch_camera") {
        const p = msg.payload as { facing?: "user" | "environment" };
        if (p.facing) await switchCamera(p.facing);
        return;
      }
      if (msg.type === "livecam.answer") {
        const p = msg.payload as { sdp?: string };
        const conn = pc.current;
        if (!p.sdp || !conn) return;
        try {
          if (conn.signalingState === "have-local-offer") {
            await conn.setRemoteDescription({ type: "answer", sdp: p.sdp });
            await flushIce(conn);
          }
        } catch {
          /* stale answer */
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
        return;
      }
      if (msg.type === "livecam.viewer_left") {
        stopStream(local.current);
        local.current = null;
        closePeer(pc.current);
        pc.current = null;
        streamingRef.current = false;
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      stopStream(local.current);
      closePeer(pc.current);
    };
  }, []);

  return null;
}
