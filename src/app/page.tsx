"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { FullPageSpinner } from "@/components/ui/Spinner";

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready) router.replace(user ? "/chat/" : "/login/");
  }, [ready, user, router]);

  return <FullPageSpinner />;
}
