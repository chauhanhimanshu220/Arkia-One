import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { useChat } from "../context/ChatContext";

export const ChatTopbarButton = () => {
  const navigate = useNavigate();
  const { unreadCount } = useChat();

  return (
    <button
      type="button"
      onClick={() => navigate("/admin/chat")}
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white/65 backdrop-blur transition-colors hover:bg-white/85 dark:border-white/10 dark:bg-black/45 dark:hover:bg-white/10"
      aria-label="Open chat"
    >
      <Icon name="message-circle" className="h-5 w-5" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-lg">
          {unreadCount > 12 ? "12+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
};
