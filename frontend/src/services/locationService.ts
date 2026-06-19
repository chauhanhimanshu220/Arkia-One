export interface LoginLocationPayload {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

const LOCATION_REQUIRED_MESSAGE = "Location access is required to login";
const LOCATION_UNSUPPORTED_MESSAGE = "This browser does not support location access. Location access is required to login.";
const LOCATION_TIMEOUT_MESSAGE = "Location request timed out. Please allow location access and try again.";
const LOCATION_UNAVAILABLE_MESSAGE = "Unable to capture your location. Please ensure location services are enabled and try again.";
const FAST_LOCATION_TIMEOUT_MS = 2_500;
const FALLBACK_LOCATION_TIMEOUT_MS = 8_000;
const CACHED_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;

const GEOLOCATION_PERMISSION_NAME = "geolocation" as PermissionName;

const isGeolocationSupported = () =>
  typeof window !== "undefined" && typeof navigator !== "undefined" && "geolocation" in navigator;

const supportsPermissionsApi = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  "permissions" in navigator &&
  typeof navigator.permissions?.query === "function";

const mapGeolocationError = (error: GeolocationPositionError | { code?: number }) => {
  switch (error.code) {
    case 1:
      return new Error(LOCATION_REQUIRED_MESSAGE);
    case 3:
      return new Error(LOCATION_TIMEOUT_MESSAGE);
    default:
      return new Error(LOCATION_UNAVAILABLE_MESSAGE);
  }
};

const getCurrentPosition = (options?: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: FALLBACK_LOCATION_TIMEOUT_MS,
      maximumAge: CACHED_LOCATION_MAX_AGE_MS,
      ...options,
    });
  });

const getPermissionState = async (): Promise<PermissionState | "unsupported"> => {
  if (!supportsPermissionsApi()) {
    return "unsupported";
  }

  try {
    const permissionStatus = await navigator.permissions.query({ name: GEOLOCATION_PERMISSION_NAME });
    return permissionStatus.state;
  } catch {
    return "unsupported";
  }
};

export const locationService = {
  async captureRequiredLoginLocation(): Promise<LoginLocationPayload> {
    if (!isGeolocationSupported()) {
      throw new Error(LOCATION_UNSUPPORTED_MESSAGE);
    }

    const permissionState = await getPermissionState();
    if (permissionState === "denied") {
      throw new Error(LOCATION_REQUIRED_MESSAGE);
    }

    const mapPositionToPayload = (position: GeolocationPosition): LoginLocationPayload => ({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    });

    try {
      // Use a shorter timeout for the initial fast attempt
      const position = await getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 10000, // 10 seconds max
        maximumAge: CACHED_LOCATION_MAX_AGE_MS,
      });
      return mapPositionToPayload(position);
    } catch (error) {
      const geolocationError = error as GeolocationPositionError;
      if (geolocationError.code === 1) {
        throw mapGeolocationError(geolocationError);
      }

      // Final fallback attempt with no high accuracy
      try {
        const fallbackPosition = await getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 15000, // 15 seconds max
          maximumAge: 0,
        });
        return mapPositionToPayload(fallbackPosition);
      } catch (fallbackError) {
        throw mapGeolocationError(fallbackError as GeolocationPositionError);
      }
    }
  },
};
