import { useEffect, useState } from "react";
import { chatApi } from "../services/chatApi";
import type { ChatContactDirectory } from "../types/chat.types";

const emptyDirectory: ChatContactDirectory = {
  projectMembers: [],
  teamMembers: [],
  hierarchyMembers: [],
  supportMembers: [],
  directoryMembers: [],
};

export const useChatContacts = () => {
  const [contacts, setContacts] = useState<ChatContactDirectory>(emptyDirectory);
  const [loading, setLoading] = useState(true);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await chatApi.getContacts();
      setContacts(data);
    } catch {
      setContacts(emptyDirectory);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContacts();
  }, []);

  return {
    contacts,
    loading,
    reloadContacts: loadContacts,
  };
};
