"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { useState } from "react";
import axios from "axios";
import { Key, Copy, Check, Terminal, Play, HelpCircle } from "lucide-react";
import { toast } from "sonner";

export default function DashboardPage() {
  const { user, apps, token } = useDashboard();
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  const generateKey = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(
        `${API_URL}/api-keys`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setApiKey(res.data.api_key);
      toast.success("New API key generated.");
    } catch (err) {
      toast.error("Failed to generate API key.");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("API key copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading mb-1 uppercase">Console Overview</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back to your MicroHost management dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border-2 border-border p-4 bg-background flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Total Deployed Apps</div>
            <div className="text-3xl font-heading mb-2">{apps.length}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            PHP applications active on your sandbox node.
          </p>
        </div>

        <div className="border-2 border-border p-4 bg-background flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase mb-1">Account Role</div>
            <div className="text-2xl font-heading mb-2 text-main uppercase">
              {user?.is_admin ? "Administrator" : "Standard User"}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
          </p>
        </div>
      </div>

      <div className="border-4 border-border p-5 bg-background shadow-[4px_4px_0px_0px_var(--border)]">
        <div className="flex items-center gap-2 border-b-2 border-border pb-3 mb-4">
          <Key className="w-5 h-5 text-main" />
          <h2 className="text-lg font-heading uppercase">API Access Credentials</h2>
        </div>

        <p className="text-xs mb-4 leading-relaxed">
          Generate an API Key to push script deployments directly from a CLI or CI/CD pipeline.
        </p>

        {apiKey ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 bg-white border-2 border-border p-2.5 font-mono text-xs overflow-x-auto whitespace-nowrap">
                {apiKey}
              </div>
              <button
                onClick={copyToClipboard}
                className="bg-main text-main-foreground border-2 border-border p-2.5 flex items-center justify-center"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-red-500 font-bold">
              Warning: Copy this key now. It will not be shown again for security reasons.
            </p>
          </div>
        ) : (
          <button
            onClick={generateKey}
            disabled={generating}
            className="text-xs font-bold bg-foreground text-background border-2 border-border px-4 py-2 hover:bg-neutral-800 transition-all"
          >
            {generating ? "Generating..." : "Generate API Key"}
          </button>
        )}
      </div>

      <div className="border-2 border-border p-4 bg-background">
        <div className="flex items-center gap-2 border-b-2 border-border pb-2 mb-3">
          <Terminal className="w-4 h-4 text-main" />
          <span className="font-heading text-sm uppercase">Quick Deployment Helper</span>
        </div>

        <p className="text-xs mb-3">
          Deploy any single PHP script dynamically via cURL:
        </p>

        <div className="bg-white border-2 border-border p-3 font-mono text-[11px] overflow-x-auto whitespace-pre">
          {`curl -X POST \\
  -H "X-API-KEY: ${apiKey || "YOUR_API_KEY"}" \\
  -F "file=@index.php" \\
  ${API_URL}/upload`}
        </div>
      </div>
    </div>
  );
}
