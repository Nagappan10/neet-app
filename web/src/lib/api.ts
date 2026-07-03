import { useAuthStore, type SessionUser } from "./authStore";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface AuthResponse {
  accessToken: string;
  user: SessionUser;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = res.statusText;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, message);
}

/** Calls the refresh endpoint; updates the store on success. */
export async function tryRefresh(): Promise<boolean> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return false;
  const data = (await res.json()) as AuthResponse;
  useAuthStore.getState().setSession(data.accessToken, data.user);
  return true;
}

/**
 * Authenticated fetch wrapper: attaches the in-memory access token and,
 * on a 401, silently refreshes once and retries before giving up.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const doFetch = () => {
    const token = useAuthStore.getState().accessToken;
    return fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  };

  let res = await doFetch();
  if (res.status === 401 && (await tryRefresh())) {
    res = await doFetch();
  }
  if (res.status === 401) {
    useAuthStore.getState().clearSession();
  }
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as AuthResponse;
  useAuthStore.getState().setSession(data.accessToken, data.user);
}

export async function register(
  username: string,
  password: string,
  displayName: string,
): Promise<void> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, displayName }),
  });
  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as AuthResponse;
  useAuthStore.getState().setSession(data.accessToken, data.user);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  useAuthStore.getState().clearSession();
}
