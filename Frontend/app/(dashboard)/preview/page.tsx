"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PreviewRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/roles");
  }, [router]);

  return null;
}
