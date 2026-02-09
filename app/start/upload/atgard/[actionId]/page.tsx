"use client";

import { useParams, useSearchParams } from "next/navigation";
import { BrfActionDetailsEditor } from "../../../../components/brf-action-details-editor";

function toParamValue(value: string | string[] | undefined): string {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] || "";
  return value;
}

export default function UploadActionDetailsPage() {
  const params = useParams<{ actionId: string }>();
  const searchParams = useSearchParams();
  const actionId = decodeURIComponent(toParamValue(params?.actionId));
  const from = searchParams.get("from");
  const backHref = from && from.startsWith("/") ? from : "/start/upload";

  return (
    <main className="min-h-screen bg-[#F6F3EE] px-4 py-8 text-[#2A2520] antialiased md:px-6">
      <div className="mx-auto max-w-7xl">
        <BrfActionDetailsEditor key={actionId} actionId={actionId} backHref={backHref} />
      </div>
    </main>
  );
}
