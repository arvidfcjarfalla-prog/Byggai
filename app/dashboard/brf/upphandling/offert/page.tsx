"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { routes } from "../../../../lib/routes";

export default function BrfProcurementOfferIndexRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(routes.brf.procurementOfferStep1());
  }, [router]);

  return null;
}

