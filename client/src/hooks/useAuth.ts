"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

export function useAuth() {
  const { user, isLoading, setUser, setTeamId, setLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await api.get<any>("/api/auth/me");
        if (res.data) {
          setUser(res.data);
          const teamRes = await api.get<any>("/api/team");
          if (teamRes.data) setTeamId(teamRes.data.id);
        }
      } catch {
        setUser(null);
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    }
    if (!user && isLoading) {
      loadUser();
    }
  }, [user, isLoading, setUser, setTeamId, setLoading, router]);

  return { user, isLoading };
}
