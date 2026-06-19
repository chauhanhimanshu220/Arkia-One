interface ChatAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeClassMap = {
  sm: "h-10 w-10 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-14 w-14 text-base",
} satisfies Record<NonNullable<ChatAvatarProps["size"]>, string>;

const initialsFromName = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const ChatAvatar = ({ name, photoUrl, size = "md" }: ChatAvatarProps) => {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${sizeClassMap[size]} rounded-2xl object-cover`} />;
  }

  return (
    <div
      className={`${sizeClassMap[size]} flex items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-100 font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100`}
      aria-hidden="true"
    >
      {initialsFromName(name)}
    </div>
  );
};
