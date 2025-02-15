import Link from "next/link";
import { useEffect, useState } from "react";

interface LeaderboardEntry {
  slug: string;
  title: string;
  count: number;
}

export function Leaderboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/track-visit")
      .then((res) => res.json())
      .then((data) => {
        setLeaderboard(data);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching leaderboard:", error);
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="mt-12 relative z-10">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100 text-center">
        most viewed entities
      </h2>
      {isLoading ? (
        <div className="text-gray-600 text-center">
          Loading trending entities...
        </div>
      ) : leaderboard.length > 0 ? (
        <div className="space-y-2">
          {leaderboard.slice(0, 3).map((entry, index) => (
            <Link
              key={entry.slug}
              href={`/wiki/${entry.slug}`}
              className="flex items-center p-3 bg-white/90 dark:bg-gray-800/90 
                       rounded-lg shadow-sm 
                       hover:shadow-md hover:translate-x-0.5
                       active:translate-x-0 active:shadow-sm
                       transition-all duration-200 relative
                       hover:bg-white/95 dark:hover:bg-gray-800/95"
            >
              <span
                className="text-2xl font-bold text-gray-400 w-12 
                           group-hover:text-gray-500 transition-colors"
              >
                #{index + 1}
              </span>
              <div className="flex-grow">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  {entry.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {entry.count} views
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-gray-600">No trending entities yet</div>
      )}
    </div>
  );
}
