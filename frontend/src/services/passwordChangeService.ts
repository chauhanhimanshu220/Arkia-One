import { ApiError, apiRequest } from "./http";
import type {
  PasswordChangeOtpChallenge,
  PasswordChangeRequestRecord,
  RequestPasswordChangePayload,
  VerifyPasswordChangeOtpPayload,
} from "../types/passwordChange";

const getPasswordChangeErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof ApiError) {
    return error.message || fallbackMessage;
  }

  if (error instanceof TypeError) {
    return "Unable to reach the backend API. Make sure the ASP.NET server is running.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
};

export const passwordChangeService = {
  async requestPasswordChange(payload: RequestPasswordChangePayload) {
    try {
      return await apiRequest<PasswordChangeOtpChallenge>("/Account/change-password", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new Error(getPasswordChangeErrorMessage(error, "Unable to start the password change request."));
    }
  },

  async verifyOtp(payload: VerifyPasswordChangeOtpPayload) {
    try {
      return await apiRequest<PasswordChangeRequestRecord>("/Account/change-password/verify-otp", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new Error(getPasswordChangeErrorMessage(error, "Unable to verify the OTP."));
    }
  },

  async listMyRequests() {
    try {
      return await apiRequest<PasswordChangeRequestRecord[]>("/Account/change-password/requests");
    } catch (error) {
      throw new Error(getPasswordChangeErrorMessage(error, "Unable to load your password change requests."));
    }
  },
};
