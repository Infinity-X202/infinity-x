import { Link } from "react-router-dom";
import { Lock, MessageCircle, Shield, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/brand";

const features = [
  { icon: Lock, title: "Secret code", desc: "Access with a code only. No email, no sign-up." },
  { icon: MessageCircle, title: "Instant chat", desc: "Messages, photos, videos and voice notes in real time." },
  { icon: Shield, title: "Private", desc: "A reserved space on Infinity X for people who have a code." },
  { icon: Zap, title: "Fast", desc: "Light, responsive, ready when you are." },
];

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="infinity-bg star-field pointer-events-none absolute inset-0">
        <span className="infinity-orb" />
        <span className="infinity-orb" />
        <span className="infinity-orb" />
      </div>
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-600 text-lg font-bold text-white shadow-[0_0_24px_rgba(56,189,248,0.5)]">
            ∞
          </span>
          <div className="font-serif text-xl text-sky-100">{SITE_NAME}</div>
        </div>
        <Button asChild className="btn-infinity">
          <Link to="/login">Enter</Link>
        </Button>
      </header>
      <main className="relative mx-auto max-w-5xl px-6 pb-24 pt-16 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs tracking-[0.25em] text-sky-300">
          <Sparkles className="h-3.5 w-3.5" />
          PRIVATE · SECURE · INFINITY X
        </p>
        <h1 className="mt-8 font-serif text-5xl leading-tight text-sky-50 md:text-7xl">
          <span className="shimmer-text">{SITE_NAME}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-sky-200/80">
          Your private space to chat. Messages, media and voice notes — all on Infinity X, only with your secret code.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" asChild className="btn-infinity px-10 text-base">
            <Link to="/login">Open chat</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild className="rounded-full border border-sky-500/30 bg-black/30 px-8 text-sky-100 hover:bg-sky-500/10">
            <Link to="/login">I have a code</Link>
          </Button>
        </div>
        <div className="mx-auto mt-20 grid max-w-4xl gap-4 text-left sm:grid-cols-2">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-panel rounded-2xl p-5 transition hover:border-sky-400/40">
              <div className="mb-3 inline-flex rounded-xl bg-sky-500/15 p-2.5 text-cyan-400">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-medium text-sky-50">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-sky-300/70">{desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-16 text-xs tracking-widest text-sky-400/50">∞ INFINITY X · MESSAGING</p>
      </main>
    </div>
  );
}
