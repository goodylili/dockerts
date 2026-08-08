"use client";

import { useCallback, useState } from "react";

import { BioForm } from "@/components/bio-form";
import { RecentSubmissions } from "@/components/recent-submissions";

export function BiodataApp() {
  const [refreshToken, setRefreshToken] = useState(0);
  const onSaved = useCallback(() => setRefreshToken((n) => n + 1), []);

  return (
    <div className="space-y-8">
      <BioForm onSaved={onSaved} />
      <RecentSubmissions refreshToken={refreshToken} />
    </div>
  );
}
