"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

interface AppData {
  id: string;
  filename: string;
  url: string;
  created_at: string;
  is_active: boolean;
}

interface UserData {
  id: number;
  username: string;
  email?: string;
  created_at: string;
  is_admin: boolean;
  is_active: boolean;
}

interface ServerStatus {
  hardware: {
    cpu_load_avg: { "1m": number; "5m": number; "15m": number };
    ram_usage_percent: number;
    ram_available_mb: number;
    disk_usage_percent: number;
    disk_free_gb: number;
  };
  php_fpm: {
    active_workers: number;
    params: {
      memory_limit: string;
      upload_max_filesize: string;
      max_execution_time: string;
    };
  };
}

interface DashboardContextProps {
  user: UserData | null;
  apps: AppData[];
  serverStatus: ServerStatus | null;
  loading: boolean;
  token: string;
  refreshApps: () => Promise<void>;
  refreshServerStatus: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const DashboardContext = createContext<DashboardContextProps | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string>("");
  const [user, setUser] = useState<UserData | null>(null);
  const [apps, setApps] = useState<AppData[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setToken("");
    setUser(null);
    setApps([]);
    setServerStatus(null);
    router.push("/login");
  }, [router]);

  const refreshUser = useCallback(async (authToken?: string) => {
    const currentToken = authToken || token || localStorage.getItem("access_token");
    if (!currentToken) return;

    try {
      const res = await axios.get(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setUser(res.data);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  }, [token, API_URL, logout]);

  const refreshApps = useCallback(async (authToken?: string) => {
    const currentToken = authToken || token || localStorage.getItem("access_token");
    if (!currentToken) return;

    try {
      const res = await axios.get(`${API_URL}/apps`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setApps(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [token, API_URL]);

  const refreshServerStatus = useCallback(async () => {
    const currentToken = token || localStorage.getItem("access_token");
    if (!currentToken) return;

    try {
      const res = await axios.get(`${API_URL}/server-status`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setServerStatus(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [token, API_URL]);

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (!storedToken) {
      router.push("/login");
      setLoading(false);
      return;
    }

    setToken(storedToken);

    const initData = async () => {
      try {
        await Promise.all([
          refreshUser(storedToken),
          refreshApps(storedToken),
          refreshServerStatus(),
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [router]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      refreshServerStatus();
    }, 20000);
    return () => clearInterval(interval);
  }, [token, refreshServerStatus]);

  return (
    <DashboardContext.Provider
      value={{
        user,
        apps,
        serverStatus,
        loading,
        token,
        refreshApps,
        refreshServerStatus,
        refreshUser,
        logout,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
