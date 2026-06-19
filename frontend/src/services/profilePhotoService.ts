const PROFILE_PHOTO_PREFIX = "profile-photo:";

export const profilePhotoChangedEvent = "profile-photo-changed";

export type ProfilePhotoChangedDetail = {
  userId: string;
  photoDataUrl: string | null;
};

const storageKeyForUser = (userId: string) => `${PROFILE_PHOTO_PREFIX}${userId}`;

const notifyProfilePhotoChanged = (detail: ProfilePhotoChangedDetail) => {
  window.dispatchEvent(new CustomEvent(profilePhotoChangedEvent, { detail }));
};

export const profilePhotoService = {
  getPhoto(userId: string) {
    return window.localStorage.getItem(storageKeyForUser(userId));
  },

  setPhoto(userId: string, photoDataUrl: string) {
    window.localStorage.setItem(storageKeyForUser(userId), photoDataUrl);
    notifyProfilePhotoChanged({ userId, photoDataUrl });
  },

  removePhoto(userId: string) {
    window.localStorage.removeItem(storageKeyForUser(userId));
    notifyProfilePhotoChanged({ userId, photoDataUrl: null });
  },

  storageKeyForUser,
};
