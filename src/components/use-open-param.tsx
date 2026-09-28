"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Item id to open on this page, seeded from `?open=<id>` (used by search
 * results) and then owned locally. The param is stripped once consumed.
 */
export function useOpenParam() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const requested = params.get("open");
  const [openId, setOpenId] = useState<string | null>(requested);

  useEffect(() => {
    if (!requested) return;
    setOpenId(requested);
    router.replace(pathname, { scroll: false });
  }, [requested, pathname, router]);

  return [openId, setOpenId] as const;
}
