import Link from "next/link";
import { useState, useEffect } from "react";
import { Label } from "@/lib/types";

type Entity = {
  slug: string;
  title: string;
  count: number;
  labels: Label[];
};

export function Leaderboard() {
  const [stats, setStats] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/track-visit?_=${Date.now()}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("📊 Leaderboard - Received stats:", data);
        setStats(data);
      } catch (err) {
        console.error("❌ Leaderboard - Error:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    // Refresh every 5 minutes instead of 30 seconds
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Stats are already sorted by count from the API
  const topEntries = stats.slice(0, 3);

  return (
    <div className="mt-8 sm:mt-12 relative z-10 px-4 sm:px-0 max-w-sm mx-auto overflow-visible">
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100 text-center">
        most viewed entities
      </h2>
      {isLoading ? (
        <div className="text-sm sm:text-base text-gray-600 text-center">
          Loading trending entities...
        </div>
      ) : error ? (
        <div className="text-sm sm:text-base text-red-600 text-center">
          Error loading trending entities
        </div>
      ) : topEntries.length > 0 ? (
        <div className="space-y-2 overflow-visible">
          {topEntries.map((entry, index) => (
            <Link
              key={entry.slug}
              href={`/wiki/${entry.slug}`}
              className="flex items-center p-2 sm:p-3 bg-white/90 dark:bg-gray-800/90 
                       rounded-lg shadow-sm 
                       hover:shadow-md hover:translate-x-0.5
                       active:translate-x-0 active:shadow-sm
                       transition-all duration-200 relative
                       hover:bg-white/95 dark:hover:bg-gray-800/95"
            >
              <span
                className="text-xl sm:text-2xl font-bold text-gray-400 w-8 sm:w-12 
                         group-hover:text-gray-500 transition-colors text-center"
              >
                #{index + 1}
              </span>
              <div className="flex-grow min-w-0">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm sm:text-base truncate">
                  {entry.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {entry.count} views
                </p>
                {entry.labels && entry.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {entry.labels.map((label, i) => (
                      <span
                        key={`${entry.slug}-${label.name}-${i}`}
                        className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-sm sm:text-base text-gray-600 text-center">
          No trending entities yet
        </div>
      )}
    </div>
  );
}
