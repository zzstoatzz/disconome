"use client";

import React, { useEffect } from "react";
import { useCompletion } from "ai/react";

export default function ArtistLineage({ artist }: { artist: string }) {
  const { completion, complete } = useCompletion({
    api: "/api/generate-lineage",
    onFinish: () => {
      // Handle completion
    },
  });

  // Trigger completion when component mounts
  useEffect(() => {
    complete(artist);
  }, [artist, complete]);

  return (
    <pre className="text-foreground whitespace-pre-wrap">
      {completion || "Generating lineage..."}
    </pre>
  );
}
