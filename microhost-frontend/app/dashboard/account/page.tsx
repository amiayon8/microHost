"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { useState } from "react";
import axios from "axios";
import { User, Mail, Shield, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function AccountPage() {
  const { user, token, refreshUser } = useDashboard();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setUpdatingEmail(true);
    try {
      await axios.patch(
        `${API_URL}/users/me`,
        { email },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Email address updated.");
      await refreshUser();
      setEmail("");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update email.");
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      await axios.patch(
        `${API_URL}/users/me`,
        { password },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Password updated successfully.");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading mb-1 uppercase">Account Management</h1>
        <p className="text-sm text-muted-foreground">
          Modify your profile details and update your credentials.
        </p>
      </div>

      <div className="border-4 border-border p-5 bg-background shadow-[4px_4px_0px_0px_var(--border)]">
        <div className="flex items-center gap-2 border-b-2 border-border pb-3 mb-4">
          <User className="w-5 h-5 text-main" />
          <h2 className="text-lg font-heading uppercase">Profile Information</h2>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="flex border-b border-neutral-200 py-2">
            <span className="w-32 text-muted-foreground font-bold">USERNAME:</span>
            <span className="font-bold">{user?.username}</span>
          </div>
          <div className="flex border-b border-neutral-200 py-2">
            <span className="w-32 text-muted-foreground font-bold">EMAIL ADDRESS:</span>
            <span className="font-bold">{user?.email || "Not Provided"}</span>
          </div>
          <div className="flex py-2">
            <span className="w-32 text-muted-foreground font-bold">MEMBER SINCE:</span>
            <span className="font-bold">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border-4 border-border p-5 bg-background shadow-[4px_4px_0px_0px_var(--border)]">
          <div className="flex items-center gap-2 border-b-2 border-border pb-3 mb-4">
            <Mail className="w-5 h-5 text-main" />
            <h2 className="text-base font-heading uppercase">Update Email</h2>
          </div>

          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div>
              <label htmlFor="new-email" className="block text-xs font-bold uppercase mb-1">
                New Email Address
              </label>
              <input
                id="new-email"
                type="email"
                required
                placeholder="developer@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={updatingEmail}
                className="w-full bg-white border-2 border-border p-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={updatingEmail}
              className="w-full font-bold bg-foreground text-background border-2 border-border p-2 hover:bg-neutral-800 transition-all text-xs uppercase"
            >
              {updatingEmail ? "Saving..." : "Save Email"}
            </button>
          </form>
        </div>

        <div className="border-4 border-border p-5 bg-background shadow-[4px_4px_0px_0px_var(--border)]">
          <div className="flex items-center gap-2 border-b-2 border-border pb-3 mb-4">
            <Shield className="w-5 h-5 text-main" />
            <h2 className="text-base font-heading uppercase">Change Password</h2>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label htmlFor="new-pass" className="block text-xs font-bold uppercase mb-1">
                New Password
              </label>
              <input
                id="new-pass"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={updatingPassword}
                className="w-full bg-white border-2 border-border p-2 text-xs"
              />
            </div>

            <div>
              <label htmlFor="confirm-pass" className="block text-xs font-bold uppercase mb-1">
                Confirm Password
              </label>
              <input
                id="confirm-pass"
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={updatingPassword}
                className="w-full bg-white border-2 border-border p-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={updatingPassword}
              className="w-full font-bold bg-main text-main-foreground border-2 border-border p-2 shadow-[2px_2px_0px_0px_var(--border)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-xs uppercase"
            >
              {updatingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
