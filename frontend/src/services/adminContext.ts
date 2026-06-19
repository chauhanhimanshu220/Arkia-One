import { authService } from "./authService";

const EMPTY_ADMIN_CONTEXT = {
  adminId: "00000000-0000-0000-0000-000000000000",
  adminName: "",
};

export const getCurrentAdminContext = () => {
  const session = authService.getStoredSession();
  if (!session) {
    return EMPTY_ADMIN_CONTEXT;
  }

  return {
    adminId: session.user.id,
    adminName: session.user.fullName,
  };
};
