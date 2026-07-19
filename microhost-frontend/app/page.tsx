"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-background font-sans">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-foreground border-t-transparent"></div>
    </div>
  );
}
