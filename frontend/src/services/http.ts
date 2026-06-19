import { AUTH_STORAGE_KEY } from "../config/auth";

const DEFAULT_API_BASE_URL = "/api";
const SWAGGER_PATH = "/swagger/v1/swagger.json";

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || DEFAULT_API_BASE_URL;

type SwaggerDocument = {
  paths?: Record<string, unknown>;
};

type StoredSession = {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    roles?: string[];
  };
};

const SWAGGER_CACHE_TTL_MS = 15_000;

let swaggerPathsPromise: Promise<Set<string> | null> | null = null;
let swaggerCacheTimestamp = 0;

export class ApiError extends Error {
  constructor(message: string, public status?: number, public path?: string) {
    super(message);
  }
}

const getApiOrigin = () => {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return window.location.origin;
  }
};

export const isGuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

export const apiSupportsPath = async (path: string) => {
  const now = Date.now();
  if (!swaggerPathsPromise || now - swaggerCacheTimestamp > SWAGGER_CACHE_TTL_MS) {
    swaggerCacheTimestamp = now;
    swaggerPathsPromise = (async () => {
      try {
        const response = await fetch(`${getApiOrigin()}${SWAGGER_PATH}`);
        if (!response.ok) {
          return null;
        }

        const swagger = (await response.json()) as SwaggerDocument;
        return new Set(Object.keys(swagger.paths ?? {}).map((item) => item.toLowerCase()));
      } catch {
        return null;
      }
    })();
  }

  const paths = await swaggerPathsPromise;
  if (!paths) {
    return true;
  }

  return paths.has(path.toLowerCase());
};

export const resetApiSupportCache = () => {
  swaggerPathsPromise = null;
  swaggerCacheTimestamp = 0;
};

export const getStoredSession = (): StoredSession | null => {
  const rawSession = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredSession;
  } catch {
    return null;
  }
};

export const getAuthHeaders = () => {
  const session = getStoredSession();
  if (!session) {
    return {} as Record<string, string>;
  }

  return {
    Authorization: `Bearer ${session.token}`,
    "X-User-Id": session.user.id,
    "X-User-Email": session.user.email,
    "X-User-Role": session.user.role,
    "X-User-Roles": JSON.stringify([session.user.role]),
  } satisfies Record<string, string>;
};

const isAnonymousAuthPath = (path: string): boolean => {
  const normalizedPath = path.trim().toLowerCase();
  return normalizedPath === "/auth/login"
    || normalizedPath === "/auth/forgot-password"
    || normalizedPath === "/auth/forgot-password/verify-otp"
    || normalizedPath === "/auth/forgot-password/reset";
};

export const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const isFormDataRequest =
    typeof FormData !== "undefined" &&
    init?.body instanceof FormData;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      ...(isAnonymousAuthPath(path) ? {} : getAuthHeaders()),
      ...(isFormDataRequest ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Automatic logout on unauthorized response
      window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
      window.localStorage.removeItem(AUTH_STORAGE_KEY);

      if (!isAnonymousAuthPath(path) && !window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    let message = `Request failed with status ${response.status}`;

    try {
      if (contentType.includes("application/json")) {
        const json = await response.json();
        if (json && typeof json === "object" && "message" in json && typeof (json as any).message === "string") {
          message = (json as any).message;
        } else {
          message = JSON.stringify(json);
        }
      } else {
        message = await response.text();
      }
    } catch {
      // ignore parse failures and keep the default message
    }

    throw new ApiError(message || `Request failed with status ${response.status}`, response.status, path);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};
