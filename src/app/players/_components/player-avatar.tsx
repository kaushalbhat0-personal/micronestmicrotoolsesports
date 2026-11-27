import Image from "next/image";

interface PlayerAvatarProps {
  src: string | null;
  name: string;
  size?: number | undefined;
}

// Public avatar with a safe text fallback. `src` is the validated DirectoryReader
// URL (NULL stays NULL); no other avatar source is accepted here. Sharp
// geometry matches the Competitive Arena system.
export function PlayerAvatar({ src, name, size = 64 }: PlayerAvatarProps) {
  const dimension = size;
  if (src === null) {
    const initials = name.trim().slice(0, 2).toUpperCase();
    return (
      <div
        role="img"
        aria-label={`Avatar placeholder for ${name}`}
        style={{ width: dimension, height: dimension }}
        className="flex shrink-0 items-center justify-center bg-arena-950 text-lg font-bold text-white"
      >
        <span aria-hidden="true">{initials === "" ? "?" : initials}</span>
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={`Avatar of ${name}`}
      width={dimension}
      height={dimension}
      unoptimized
      className="shrink-0 border border-slate-deep/20 object-cover"
    />
  );
}
