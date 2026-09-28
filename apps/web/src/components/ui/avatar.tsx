import * as Avatar from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

const PALETTES = [
  "from-cyan-400 to-indigo-600",
  "from-sky-400 to-violet-600",
  "from-indigo-400 to-cyan-500",
  "from-teal-400 to-blue-600",
  "from-blue-400 to-fuchsia-500",
];

function paletteFor(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return PALETTES[n % PALETTES.length];
}

export function UserAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <Avatar.Root className={cn("inline-flex h-10 w-10 overflow-hidden rounded-full", className)}>
      {src ? <Avatar.Image src={src} alt="" className="h-full w-full object-cover" /> : null}
      <Avatar.Fallback
        className={cn(
          "flex h-full w-full items-center justify-center bg-gradient-to-br text-xs font-semibold text-white",
          paletteFor(name),
        )}
      >
        {initials}
      </Avatar.Fallback>
    </Avatar.Root>
  );
}
