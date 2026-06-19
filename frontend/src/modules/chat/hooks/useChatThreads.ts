import { useEffect, useState } from "react";
import { chatApi } from "../services/chatApi";
import type { ChatThread } from "../types/chat.types";

const THREAD_POLL_INTERVAL_MS = 15_000;

export const useChatThreads = () => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadThreads = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const data = await chatApi.getThreads();
      setThreads(data);
    } catch {
      if (showLoading) {
        setThreads([]);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) {
        return;
      }
      await loadThreads();
    };

    void load();
    const timer = window.setInterval(() => {
      void loadThreads(false);
    }, THREAD_POLL_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return {
    threads,
    loading,
    reloadThreads: loadThreads,
    setThreads,
  };
};
