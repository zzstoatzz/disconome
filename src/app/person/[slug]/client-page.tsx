"use client";

import { useState, useEffect } from "react";

export default function ClientPage({ slug }: { slug: string }) {
  const [lineage, setLineage] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLineage() {
      try {
        const artistName = decodeURIComponent(slug);
        const blobPath = `lineages/${artistName.toLowerCase().replace(/\s+/g, "-")}.json`;

        // Try to get from blob storage first
        try {
          const response = await fetch(
            `/api/blob?path=${encodeURIComponent(blobPath)}`,
          );
          if (response.ok) {
            const cachedLineage = await response.json();
            if (cachedLineage) {
              setLineage(cachedLineage);
              setLoading(false);
              return;
            }
          }
        } catch (blobErr) {
          console.error("Blob storage error:", blobErr);
        }

        // Generate new lineage data via API route
        const response = await fetch("/api/lineage", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ artistName }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate lineage");
        }

        const newLineage = await response.json();
        setLineage(newLineage);
      } catch (err) {
        console.error("General error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to generate lineage",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchLineage();
  }, [slug]);

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-mono mb-8 font-fira-code">Loading...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-mono mb-8 font-fira-code">Error</h1>
        <div className="text-red-500">{error}</div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-mono mb-8 font-fira-code">
        {decodeURIComponent(slug)}
      </h1>
      <div className="space-y-4">
        <pre className="text-foreground">
          {JSON.stringify(lineage, null, 2)}
        </pre>
      </div>
    </main>
  );
}
