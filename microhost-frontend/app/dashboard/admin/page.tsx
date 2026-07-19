"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Users,
  LayoutGrid,
  Cpu,
  ToggleLeft,
  ToggleRight,
  Trash2,
  KeyRound,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
  is_admin: boolean;
  is_active: boolean;
}

interface AdminApp {
  id: string;
  filename: string;
  url: string;
  created_at: string;
  is_active: boolean;
}

interface LiveWorker {
  app_id: string;
  pid: number;
  state: string;
  start_time: string;
  request_uri: string;
  cpu_percent: number;
  memory_kb: number;
  execution_time_seconds: number;
}

interface FpmTelemetry {
  pool_manager: string;
  active_workers_count: number;
  max_active_processes: number;
  live_execution_stats: LiveWorker[];
}

export default function AdminPage() {
  const { user, token } = useDashboard();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"users" | "apps" | "telemetry">(
    "users",
  );

  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [appsList, setAppsList] = useState<AdminApp[]>([]);
  const [telemetry, setTelemetry] = useState<FpmTelemetry | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassId, setChangingPassId] = useState<number | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    if (user && !user.is_admin) {
      toast.error("Access denied: Admin privileges required.");
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsersList(res.data);
    } catch (err) {
      toast.error("Failed to load user directory.");
    } finally {
      setLoading(false);
    }
  };

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/apps`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppsList(res.data);
    } catch (err) {
      toast.error("Failed to load application registry.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTelemetry = async () => {
    setLoadingTelemetry(true);
    try {
      const res = await axios.get(`${API_URL}/admin/php-workers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTelemetry(res.data);
    } catch (err) {
      toast.error("Could not fetch FPM worker telemetry.");
    } finally {
      setLoadingTelemetry(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "apps") {
      fetchApps();
    } else if (activeTab === "telemetry") {
      fetchTelemetry();
    }
  }, [activeTab, token]);

  const handleToggleUserStatus = async (
    userId: number,
    currentStatus: boolean,
  ) => {
    try {
      await axios.patch(
        `${API_URL}/admin/users/${userId}`,
        { is_active: !currentStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success("User account status modified.");
      await fetchUsers();
    } catch (err) {
      toast.error("Failed to toggle user status.");
    }
  };

  const handleToggleUserRole = async (
    userId: number,
    currentAdmin: boolean,
  ) => {
    try {
      await axios.patch(
        `${API_URL}/admin/users/${userId}`,
        { is_admin: !currentAdmin },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success("User role updated successfully.");
      await fetchUsers();
    } catch (err) {
      toast.error("Failed to update user role.");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this user and all associated scripts permanently?",
      )
    )
      return;

    try {
      await axios.delete(`${API_URL}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("User profile and apps purged.");
      await fetchUsers();
    } catch (err) {
      toast.error("Failed to delete user.");
    }
  };

  const handleToggleAppStatus = async (
    appId: string,
    currentStatus: boolean,
  ) => {
    try {
      await axios.patch(
        `${API_URL}/admin/apps/${appId}/status`,
        { is_active: !currentStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success("Script status updated.");
      await fetchApps();
    } catch (err) {
      toast.error("Failed to update script status.");
    }
  };

  const handleDeleteApp = async (appId: string) => {
    if (
      !confirm(
        "Confirm permanent removal of this application file from the host node?",
      )
    )
      return;

    try {
      await axios.delete(`${API_URL}/admin/apps/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Script file purged.");
      await fetchApps();
    } catch (err) {
      toast.error("Failed to purge application script.");
    }
  };

  const handleChangePassword = async (userId: number) => {
    if (!newPassword) {
      toast.error("Enter a valid new password.");
      return;
    }
    setChangingPassId(userId);
    try {
      await axios.patch(
        `${API_URL}/admin/users/${userId}`,
        { password: newPassword },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success("Password changed successfully.");
      setNewPassword("");
      setEditingUserId(null);
    } catch (err) {
      toast.error("Failed to update password.");
    } finally {
      setChangingPassId(null);
    }
  };

  if (!user?.is_admin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading mb-1 uppercase">Admin Console</h1>
        <p className="text-sm text-muted-foreground">
          System administration directory, application control registry, and
          worker pools telemetry.
        </p>
      </div>

      <div className="flex border-4 border-border bg-white shadow-[2px_2px_0px_0px_var(--border)] overflow-x-auto">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 py-3 px-4 text-xs font-bold uppercase flex items-center justify-center gap-2 border-r-4 border-border last:border-r-0 transition-all ${
            activeTab === "users"
              ? "bg-main text-main-foreground"
              : "hover:bg-neutral-50 text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Users Directory
        </button>
        <button
          onClick={() => setActiveTab("apps")}
          className={`flex-1 py-3 px-4 text-xs font-bold uppercase flex items-center justify-center gap-2 border-r-4 border-border last:border-r-0 transition-all ${
            activeTab === "apps"
              ? "bg-main text-main-foreground"
              : "hover:bg-neutral-50 text-foreground"
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Global Applications
        </button>
        <button
          onClick={() => setActiveTab("telemetry")}
          className={`flex-1 py-3 px-4 text-xs font-bold uppercase flex items-center justify-center gap-2 transition-all ${
            activeTab === "telemetry"
              ? "bg-main text-main-foreground"
              : "hover:bg-neutral-50 text-foreground"
          }`}
        >
          <Cpu className="w-4 h-4" />
          Worker Status
        </button>
      </div>

      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b-2 border-border pb-1.5">
            <h2 className="text-lg font-heading uppercase">Registered Users</h2>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-1 border-2 border-border bg-background hover:bg-neutral-100"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && usersList.length === 0 ? (
            <div className="text-center py-12 text-sm">
              Querying system database...
            </div>
          ) : (
            <div className="border-2 border-border bg-white overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 border-b-2 border-border text-[10px] uppercase font-bold text-muted-foreground">
                    <th className="p-3 border-r border-border">ID</th>
                    <th className="p-3 border-r border-border">Username</th>
                    <th className="p-3 border-r border-border">Email</th>
                    <th className="p-3 border-r border-border">Level</th>
                    <th className="p-3 border-r border-border">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((usr) => (
                    <tr
                      key={usr.id}
                      className="border-b border-border last:border-b-0 hover:bg-neutral-50 font-mono"
                    >
                      <td className="p-3 border-r border-border">{usr.id}</td>
                      <td className="p-3 border-r border-border font-bold">
                        {usr.username}
                      </td>
                      <td className="p-3 border-r border-border">
                        {usr.email || "-"}
                      </td>
                      <td className="p-3 border-r border-border">
                        <button
                          onClick={() =>
                            handleToggleUserRole(usr.id, usr.is_admin)
                          }
                          className={`font-bold px-1.5 py-0.5 border text-[9px] ${
                            usr.is_admin
                              ? "bg-purple-100 text-purple-800 border-purple-300"
                              : "bg-neutral-100 text-neutral-800 border-neutral-300"
                          }`}
                        >
                          {usr.is_admin ? "ADMIN" : "USER"}
                        </button>
                      </td>
                      <td className="p-3 border-r border-border">
                        <button
                          onClick={() =>
                            handleToggleUserStatus(usr.id, usr.is_active)
                          }
                          className={`font-bold px-1.5 py-0.5 border text-[9px] ${
                            usr.is_active
                              ? "bg-green-100 text-green-800 border-green-300"
                              : "bg-red-100 text-red-800 border-red-300"
                          }`}
                        >
                          {usr.is_active ? "ACTIVE" : "SUSPENDED"}
                        </button>
                      </td>
                      <td className="p-3 flex items-center gap-2">
                        <button
                          onClick={() =>
                            setEditingUserId(
                              editingUserId === usr.id ? null : usr.id,
                            )
                          }
                          className="p-1 border border-border bg-neutral-100 hover:bg-neutral-200"
                          title="Change Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(usr.id)}
                          className="p-1 border border-border bg-red-50 hover:bg-red-100 text-red-700"
                          title="Purge Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {editingUserId && (
            <div className="border-4 border-border p-4 bg-background">
              <h3 className="font-heading text-sm mb-3 uppercase flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-main" />
                Change User #{editingUserId} Password
              </h3>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 bg-white border-2 border-border p-2 text-xs"
                />
                <button
                  onClick={() => handleChangePassword(editingUserId)}
                  disabled={changingPassId !== null}
                  className="bg-main text-main-foreground border-2 border-border px-4 font-bold text-xs uppercase"
                >
                  {changingPassId ? "..." : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "apps" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b-2 border-border pb-1.5">
            <h2 className="text-lg font-heading uppercase">
              System Script Registry
            </h2>
            <button
              onClick={fetchApps}
              disabled={loading}
              className="p-1 border-2 border-border bg-background hover:bg-neutral-100"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && appsList.length === 0 ? (
            <div className="text-center py-12 text-sm">
              Querying system applications registry...
            </div>
          ) : (
            <div className="border-2 border-border bg-white overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 border-b-2 border-border text-[10px] uppercase font-bold text-muted-foreground">
                    <th className="p-3 border-r border-border">UUID</th>
                    <th className="p-3 border-r border-border">Filename</th>
                    <th className="p-3 border-r border-border">Date Created</th>
                    <th className="p-3 border-r border-border">Status</th>
                    <th className="p-3">Control</th>
                  </tr>
                </thead>
                <tbody>
                  {appsList.map((app) => (
                    <tr
                      key={app.id}
                      className="border-b border-border last:border-b-0 hover:bg-neutral-50 font-mono"
                    >
                      <td className="p-3 border-r border-border text-[10px] truncate max-w-[120px]">
                        {app.id}
                      </td>
                      <td className="p-3 border-r border-border font-bold">
                        {app.filename}
                      </td>
                      <td className="p-3 border-r border-border">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 border-r border-border">
                        <span
                          className={`font-bold px-1.5 py-0.5 border text-[9px] ${
                            app.is_active
                              ? "bg-green-100 text-green-800 border-green-300"
                              : "bg-red-100 text-red-800 border-red-300"
                          }`}
                        >
                          {app.is_active ? "RUNNING" : "SUSPENDED"}
                        </span>
                      </td>
                      <td className="p-3 flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleToggleAppStatus(app.id, app.is_active)
                          }
                          className="p-1 border border-border bg-neutral-100 hover:bg-neutral-200"
                        >
                          {app.is_active ? (
                            <ToggleRight className="w-4 h-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-neutral-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteApp(app.id)}
                          className="p-1 border border-border bg-red-50 hover:bg-red-100 text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "telemetry" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b-2 border-border pb-1.5">
            <h2 className="text-lg font-heading uppercase">
              PHP-FPM Worker Monitor
            </h2>
            <button
              onClick={fetchTelemetry}
              disabled={loadingTelemetry}
              className="p-1 border-2 border-border bg-background hover:bg-neutral-100"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border-2 border-border p-3 bg-white">
              <div className="text-[10px] text-muted-foreground uppercase font-bold">
                FPM Pool Manager
              </div>
              <div className="font-heading text-lg mt-0.5">
                {telemetry?.pool_manager || "unknown"}
              </div>
            </div>
            <div className="border-2 border-border p-3 bg-white">
              <div className="text-[10px] text-muted-foreground uppercase font-bold">
                Active Workers Count
              </div>
              <div className="font-heading text-lg mt-0.5">
                {telemetry?.active_workers_count ?? "-"}
              </div>
            </div>
            <div className="border-2 border-border p-3 bg-white">
              <div className="text-[10px] text-muted-foreground uppercase font-bold">
                Max Execution Limits
              </div>
              <div className="font-heading text-lg mt-0.5">
                {telemetry?.max_active_processes ?? "-"} workers
              </div>
            </div>
          </div>

          <h3 className="font-heading text-sm uppercase pt-2">
            Live Processes
          </h3>

          {loadingTelemetry && !telemetry ? (
            <div className="text-center py-8 text-sm">
              Intercepting Unix domain socket streams...
            </div>
          ) : !telemetry ||
            !telemetry.live_execution_stats ||
            telemetry.live_execution_stats.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border bg-white text-xs text-muted-foreground">
              No processes currently running in the FPM socket queue.
            </div>
          ) : (
            <div className="border-2 border-border bg-white overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-100 border-b-2 border-border text-[10px] uppercase font-bold text-muted-foreground">
                    <th className="p-3 border-r border-border">PID</th>
                    <th className="p-3 border-r border-border">App ID</th>
                    <th className="p-3 border-r border-border">Request URI</th>
                    <th className="p-3 border-r border-border">CPU %</th>
                    <th className="p-3 border-r border-border">Memory</th>
                    <th className="p-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetry.live_execution_stats.map((worker) => (
                    <tr
                      key={worker.pid}
                      className="border-b border-border last:border-b-0 hover:bg-neutral-50 font-mono text-[11px]"
                    >
                      <td className="p-3 border-r border-border">
                        {worker.pid}
                      </td>
                      <td className="p-3 border-r border-border text-main font-bold">
                        {worker.app_id}
                      </td>
                      <td className="p-3 border-r border-border font-bold truncate max-w-[150px]">
                        {worker.request_uri}
                      </td>
                      <td className="p-3 border-r border-border font-bold text-amber-600">
                        {worker.cpu_percent}%
                      </td>
                      <td className="p-3 border-r border-border">
                        {worker.memory_kb.toFixed(1)} KB
                      </td>
                      <td className="p-3 font-bold text-green-600">
                        {worker.execution_time_seconds.toFixed(4)}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
