import { useCallback, useEffect, useRef, useState } from "react";
import { accountService } from "../services/accountService";
import type { MyAccountProfile } from "../types/account";
import type { AuthUser } from "../types/auth";
import { toAuthUserUpdate } from "../utils/accountProfile";

export const useMyAccountProfile = (userId: string, onUserUpdate: (updates: Partial<AuthUser>) => void) => {
  const [profile, setProfileState] = useState<MyAccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onUserUpdateRef = useRef(onUserUpdate);

  useEffect(() => {
    onUserUpdateRef.current = onUserUpdate;
  }, [onUserUpdate]);

  const setProfile = useCallback(
    (nextProfile: MyAccountProfile) => {
      setProfileState(nextProfile);
      onUserUpdateRef.current(toAuthUserUpdate(nextProfile));
    },
    [],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const nextProfile = await accountService.getMyProfile();
      setProfile(nextProfile);
      return nextProfile;
    } catch (error) {
      setProfileState(null);
      setLoadError(error instanceof Error ? error.message : "Unable to load account details.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [setProfile]);

  useEffect(() => {
    void reload();
  }, [reload, userId]);

  return {
    profile,
    loading,
    loadError,
    reload,
    setProfile,
  };
};
