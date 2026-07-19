"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { useState, useRef } from "react";
import axios from "axios";
import { Upload, Trash2, ShieldAlert, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function AppsPage() {
  const { user, apps, refreshApps, token } = useDashboard();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.name.endsWith(".php")) {
        toast.error("Only PHP scripts (.php) are allowed.");
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      toast.success("Script uploaded and compiled successfully.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refreshApps();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Upload failed due to malware scan or syntax error.";
      toast.error(msg, { duration: 5000 });
    } finally {
      setUploading(false);
    }
  };

  const handleToggleStatus = async (appId: string, currentStatus: boolean) => {
    if (!user?.is_admin) return;
    setTogglingId(appId);
    try {
      await axios.patch(
        `${API_URL}/admin/apps/${appId}/status`,
        { is_active: !currentStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Application status updated.");
      await refreshApps();
    } catch (err) {
      toast.error("Failed to update status.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (appId: string) => {
    if (!user?.is_admin) return;
    if (!confirm("Are you sure you want to permanently delete this application?")) return;

    setDeletingId(appId);
    try {
      await axios.delete(`${API_URL}/admin/apps/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Application deleted successfully.");
      await refreshApps();
    } catch (err) {
      toast.error("Failed to delete application.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 font-heading text-2xl uppercase">Deploy Apps</h1>
        <p className="text-muted-foreground text-sm">
          Deploy scripts, manage active containers, and monitor script routes.
        </p>
      </div>

      <div className="bg-background shadow-[4px_4px_0px_0px_var(--border)] p-5 border-4 border-border">
        <div className="flex items-center gap-2 mb-4 pb-3 border-border border-b-2">
          <Upload className="w-5 h-5 text-main" />
          <h2 className="font-heading text-lg uppercase">Deploy New Script</h2>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="flex flex-col justify-center items-center bg-white p-6 border-2 border-border border-dashed text-center">
            <input
              type="file"
              accept=".php"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
              id="script-file"
              disabled={uploading}
            />
            <label htmlFor="script-file" className="flex flex-col items-center gap-2 cursor-pointer">
              <div className="flex justify-center items-center bg-neutral-100 hover:bg-neutral-200 border-2 border-border w-12 h-12 transition-all">
                <Upload className="w-5 h-5 text-foreground" />
              </div>
              <span className="font-bold text-xs underline">
                {selectedFile ? selectedFile.name : "Select index.php file"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Only standard PHP source scripts are permitted (max 10MB).
              </span>
            </label>
          </div>

          <div className="flex items-start gap-2 bg-amber-50 p-3 border-2 border-amber-300 text-[11px] text-amber-800">
            <ShieldAlert className="mt-0.5 w-4 h-4 shrink-0" />
            <div>
              <p className="font-bold">Automated Protection Active</p>
              <p className="mt-0.5 leading-relaxed">
                All scripts are automatically scanned for web shells, backdoors, dynamic code execution (eval, system, shell_exec), and malicious payloads before release.
              </p>
            </div>
          </div>

          {selectedFile && (
            <button
              type="submit"
              disabled={uploading}
              className="bg-main shadow-shadow hover:shadow-none p-2.5 border-2 border-border w-full font-bold text-main-foreground text-xs uppercase transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY"
            >
              {uploading ? "Deploying & Scanning..." : "Deploy to Production"}
            </button>
          )}
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="pb-1.5 border-border border-b-2 font-heading text-lg uppercase">Current Apps</h2>

        {apps.length === 0 ? (
          <div className="bg-white py-12 border-2 border-border border-dashed text-muted-foreground text-xs text-center">
            No scripts deployed. Use the form above to release your first script.
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                className="flex md:flex-row flex-col justify-between md:items-center gap-4 bg-white shadow-[2px_2px_0px_0px_var(--border)] p-4 border-2 border-border"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm">{app.filename}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 border ${app.is_active
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-red-100 text-red-800 border-red-300"
                        }`}
                    >
                      {app.is_active ? "RUNNING" : "SUSPENDED"}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    ID: {app.id} | Released: {new Date(app.created_at).toLocaleDateString()}
                  </div>
                  {app.is_active && (
                    <a
                      href={app.url.startsWith("/") ? `${API_URL}/${app.url}` : app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 mt-1 font-bold text-main text-xs hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Endpoint
                    </a>
                  )}
                </div>

                <div className="flex items-center self-start md:self-auto gap-2">
                  {user?.is_admin ? (
                    <>
                      <button
                        onClick={() => handleToggleStatus(app.id, app.is_active)}
                        disabled={togglingId !== null}
                        className="bg-background hover:bg-neutral-50 px-3 py-1.5 border-2 border-border font-bold text-xs"
                      >
                        {togglingId === app.id ? "..." : app.is_active ? "Suspend" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(app.id)}
                        disabled={deletingId !== null}
                        className="bg-red-100 hover:bg-red-200 p-1.5 border-2 border-border text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1 bg-neutral-50 p-1.5 border border-border text-[10px] text-muted-foreground">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Requires admin to modify state
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
