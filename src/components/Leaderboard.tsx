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
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        Most Viewed Entities
      </h2>
      {isLoading ? (
        <div className="text-gray-600">Loading trending entities...</div>
      ) : leaderboard.length > 0 ? (
        <div className="space-y-2">
          {leaderboard.slice(0, 5).map((entry, index) => (
            <Link
              key={entry.slug}
              href={`/wiki/${entry.slug}`}
              className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-2xl font-bold text-gray-400 w-12">
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
