import type { MyAccountProfile, UpdateMyAccountProfilePayload } from "../types/account";
import { ApiError, apiRequest } from "./http";

const getApiErrorMessage = (error: unknown, fallbackMessage: string) => {
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

export const accountService = {
  async getMyProfile() {
    try {
      return await apiRequest<MyAccountProfile>("/Account/me");
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to load your account profile."));
    }
  },

  async updateMyProfile(payload: UpdateMyAccountProfilePayload) {
    try {
      return await apiRequest<MyAccountProfile>("/Account/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to update your profile."));
    }
  },

  async uploadMyProfilePhoto(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      return await apiRequest<MyAccountProfile>("/Account/me/photo", {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to upload your profile photo."));
    }
  },

  async removeMyProfilePhoto() {
    try {
      return await apiRequest<MyAccountProfile>("/Account/me/photo", {
        method: "DELETE",
      });
    } catch (error) {
      throw new Error(getApiErrorMessage(error, "Unable to remove your profile photo."));
    }
  },
};
