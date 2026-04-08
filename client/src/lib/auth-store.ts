import { create } from "zustand";

export interface AuthUser {
  id: string;
  numericId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  email: string | null;
  phone: string | null;
  language: string | null;
}

interface AuthState {
  user: AuthUser | null;
  teamId: string | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setTeamId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  teamId: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setTeamId: (teamId) => set({ teamId }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, teamId: null }),
}));
