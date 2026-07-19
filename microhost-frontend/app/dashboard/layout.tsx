"use client";

import { useState } from "react";
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context";
import {
  Server,
  Cpu,
  HardDrive,
  Plus,
  LogOut,
  RefreshCw,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, apps, serverStatus, refreshServerStatus, loading, logout } =
    useDashboard();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen font-sans">
        <div className="border-4 border-foreground border-t-transparent rounded-full w-10 h-10 animate-spin"></div>
        <p className="mt-4 font-bold text-foreground text-lg">
          Loading Console...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen font-sans">
      <header className="bg-secondary-background shadow-shadow mb-6 border-4 border-border">
        <div className="flex justify-between items-center mx-auto px-6 max-w-7xl h-16">
          <div className="flex items-center gap-2">
            <span className="font-heading text-2xl tracking-tighter">
              MICROHOST
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-6">
            <Link
              href="/dashboard"
              className={`text-sm font-bold border-b-2 hover:border-foreground transition-all ${pathname === "/dashboard"
                ? "border-foreground"
                : "border-transparent"
                }`}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/apps"
              className={`text-sm font-bold border-b-2 hover:border-foreground transition-all ${pathname === "/dashboard/apps"
                ? "border-foreground"
                : "border-transparent"
                }`}
            >
              Apps
            </Link>
            <Link
              href="/dashboard/account"
              className={`text-sm font-bold border-b-2 hover:border-foreground transition-all ${pathname === "/dashboard/account"
                ? "border-foreground"
                : "border-transparent"
                }`}
            >
              Account
            </Link>
            {user?.is_admin && (
              <Link
                href="/dashboard/admin"
                className={`text-sm font-bold border-b-2 hover:border-foreground transition-all ${pathname === "/dashboard/admin"
                  ? "border-foreground"
                  : "border-transparent"
                  }`}
              >
                Admin
              </Link>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1 bg-transparent border-none font-bold text-main text-sm hover:underline"
            >
              <LogOut className="w-4 h-4" />
              Exit
            </button>
          </nav>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden flex justify-center items-center bg-background hover:bg-neutral-100 p-2 border-2 border-border transition-all"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto px-4 w-full max-w-7xl">
        <div className="items-start gap-6 grid grid-cols-1 lg:grid-cols-12">
          <aside className="flex flex-col gap-6 lg:col-span-3 bg-secondary-background shadow-shadow p-6 border-4 border-border">
            <div>
              <h2 className="mb-4 pb-2 border-border border-b-4 font-heading text-lg uppercase">
                User Status
              </h2>
              <div className="flex items-center gap-3 bg-background p-4 border-2 border-border">
                <div className="flex justify-center items-center bg-main border-2 border-border w-10 h-10 font-heading text-main-foreground text-lg">
                  {user?.username?.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-sm tracking-tight">
                    {user?.username}
                  </div>
                  <div className="inline-block bg-foreground mt-1 px-1.5 py-0.5 font-bold text-background text-xs">
                    {user?.is_admin ? "ADMINISTRATOR" : "STANDARD"}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="mb-4 pb-2 border-border border-b-4 font-heading text-lg uppercase">
                My Projects
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-neutral-100 p-2 border-2 border-border font-bold text-muted-foreground text-xs">
                  <span>DEPLOYED APPS</span>
                  <span className="bg-foreground px-1.5 py-0.2 rounded-sm text-background">
                    {apps.length}
                  </span>
                </div>

                {apps.length === 0 ? (
                  <div className="bg-neutral-50 py-6 border-2 border-border border-dashed text-sm text-center">
                    No active PHP apps.
                  </div>
                ) : (
                  <div className="space-y-2 pr-1 max-h-60 overflow-y-auto">
                    {apps.slice(0, 5).map((app) => (
                      <div
                        key={app.id}
                        className="flex flex-col gap-1 bg-background hover:shadow-none p-3 border-2 border-border text-xs transition-all hover:translate-x-1 hover:translate-y-1"
                      >
                        <div className="flex justify-between items-center font-bold">
                          <span className="max-w-[140px] truncate">
                            {app.filename}
                          </span>
                          <span
                            className={`w-2.5 h-2.5 rounded-full border border-border ${app.is_active ? "bg-green-500" : "bg-red-500"
                              }`}
                          ></span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {app.id}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Link href="/dashboard/apps" className="block">
                  <button className="flex justify-center items-center gap-1.5 bg-main shadow-[2px_2px_0px_0px_var(--border)] hover:shadow-none p-2 border-2 border-border w-full font-bold text-main-foreground text-xs transition-all hover:translate-x-[2px] hover:translate-y-[2px]">
                    <Plus className="w-3.5 h-3.5" />
                    Upload Script
                  </button>
                </Link>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-6 bg-secondary-background shadow-shadow p-6 border-4 border-border min-h-[500px]">
            {children}
          </section>

          <aside className="flex flex-col gap-6 lg:col-span-3 bg-secondary-background shadow-shadow p-6 border-4 border-border">
            <div className="flex justify-between items-center pb-2 border-border border-b-4">
              <h2 className="font-heading text-lg uppercase">Server Info</h2>
              <button
                onClick={refreshServerStatus}
                className="bg-background hover:bg-neutral-100 p-1 border-2 border-border"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {serverStatus ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-background p-3 border-2 border-border">
                  <Cpu className="mt-0.5 w-5 h-5 text-main" />
                  <div className="flex-1 text-xs">
                    <div className="mb-1 font-bold uppercase">
                      Processor Load
                    </div>
                    <div className="flex justify-between mb-1 text-[11px]">
                      <span>1 min:</span>
                      <span className="font-mono font-bold">
                        {serverStatus.hardware.cpu_load_avg["1m"]}
                      </span>
                    </div>
                    <div className="flex justify-between mb-1 text-[11px]">
                      <span>5 min:</span>
                      <span className="font-mono font-bold">
                        {serverStatus.hardware.cpu_load_avg["5m"]}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>15 min:</span>
                      <span className="font-mono font-bold">
                        {serverStatus.hardware.cpu_load_avg["15m"]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-background p-3 border-2 border-border">
                  <Server className="mt-0.5 w-5 h-5 text-main" />
                  <div className="flex-1 text-xs">
                    <div className="mb-1.5 font-bold uppercase">
                      Memory Status
                    </div>
                    <div className="flex justify-between mb-1 text-[11px]">
                      <span>Usage:</span>
                      <span className="font-mono font-bold">
                        {serverStatus.hardware.ram_usage_percent}%
                      </span>
                    </div>
                    <div className="bg-neutral-200 border border-border w-full h-2">
                      <div
                        className="bg-main h-full"
                        style={{
                          width: `${serverStatus.hardware.ram_usage_percent}%`,
                        }}
                      ></div>
                    </div>
                    <div className="mt-1 text-[9px] text-muted-foreground text-right">
                      {serverStatus.hardware.ram_available_mb} MB available
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-background p-3 border-2 border-border">
                  <HardDrive className="mt-0.5 w-5 h-5 text-main" />
                  <div className="flex-1 text-xs">
                    <div className="mb-1.5 font-bold uppercase">
                      Disk Storage
                    </div>
                    <div className="flex justify-between mb-1 text-[11px]">
                      <span>Usage:</span>
                      <span className="font-mono font-bold">
                        {serverStatus.hardware.disk_usage_percent}%
                      </span>
                    </div>
                    <div className="bg-neutral-200 border border-border w-full h-2">
                      <div
                        className="bg-main h-full"
                        style={{
                          width: `${serverStatus.hardware.disk_usage_percent}%`,
                        }}
                      ></div>
                    </div>
                    <div className="mt-1 text-[9px] text-muted-foreground text-right">
                      {serverStatus.hardware.disk_free_gb} GB free space
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-sm text-center">
                Failed to retrieve server data.
              </div>
            )}
          </aside>
        </div>
      </main>

      {isMobileMenuOpen && (
        <div className="lg:hidden z-50 fixed inset-0">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="top-0 right-0 slide-in-from-right bottom-0 fixed flex flex-col gap-6 bg-background shadow-[-4px_0px_0px_0px_var(--border)] p-6 border-border border-l-4 w-64 animate-in duration-200">
            <div className="flex justify-between items-center pb-4 border-border border-b-2">
              <span className="font-heading text-lg tracking-tighter">
                NAVIGATION
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="bg-background hover:bg-neutral-100 p-1 border-2 border-border"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-4">
              <Link
                href="/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-sm font-bold p-2 border-2 hover:bg-neutral-50 transition-all ${pathname === "/dashboard"
                  ? "bg-neutral-100 border-border"
                  : "border-transparent"
                  }`}
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/apps"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-sm font-bold p-2 border-2 hover:bg-neutral-50 transition-all ${pathname === "/dashboard/apps"
                  ? "bg-neutral-100 border-border"
                  : "border-transparent"
                  }`}
              >
                Apps
              </Link>
              <Link
                href="/dashboard/account"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-sm font-bold p-2 border-2 hover:bg-neutral-50 transition-all ${pathname === "/dashboard/account"
                  ? "bg-neutral-100 border-border"
                  : "border-transparent"
                  }`}
              >
                Account
              </Link>
              {user?.is_admin && (
                <Link
                  href="/dashboard/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm font-bold p-2 border-2 hover:bg-neutral-50 transition-all ${pathname === "/dashboard/admin"
                    ? "bg-neutral-100 border-border"
                    : "border-transparent"
                    }`}
                >
                  Admin
                </Link>
              )}
              <hr className="my-2 border-border border-t-2" />
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="flex justify-center items-center gap-1.5 bg-main shadow-[2px_2px_0px_0px_var(--border)] hover:shadow-none p-2 border-2 border-border font-bold text-main-foreground text-sm transition-all hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </DashboardProvider>
  );
}
