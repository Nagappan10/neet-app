import { create } from "zustand";

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
}

interface AuthState {
  /** Access token lives in memory only — never localStorage. */
  accessToken: string | null;
  user: SessionUser | null;
  /** True once the initial silent-refresh attempt has settled. */
  bootstrapped: boolean;
  setSession: (token: string, user: SessionUser) => void;
  clearSession: () => void;
  setBootstrapped: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  bootstrapped: false,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
  setBootstrapped: () => set({ bootstrapped: true }),
}));
