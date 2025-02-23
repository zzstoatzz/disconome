import Link from "next/link";
import { useData } from "@/hooks/useData";
import { StatsMap } from "@/types";
import { STATS_PATH } from "@/app/constants";

export function Leaderboard() {
  const { data: stats, error } = useData<StatsMap>(STATS_PATH, {
    refreshInterval: 30000 // Refresh every 30 seconds
  });

  const isLoading = !stats && !error;

  const sortedEntries = stats
    ? Object.entries(stats)
      .sort(([, a], [, b]) => (b.views || 0) - (a.views || 0))
      .slice(0, 3)
    : [];

  return (
    <div className="mt-8 sm:mt-12 relative z-10 px-4 sm:px-0 max-w-sm mx-auto overflow-visible">
      <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-gray-800 dark:text-gray-100 text-center">
        most viewed entities
      </h2>
      {isLoading ? (
        <div className="text-sm sm:text-base text-gray-600 text-center">
          Loading trending entities...
        </div>
      ) : sortedEntries.length > 0 ? (
        <div className="space-y-2 overflow-visible">
          {sortedEntries.map(([slug, entry], index) => (
            <Link
              key={slug}
              href={`/wiki/${slug}`}
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
                  {entry.views} views
                </p>
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
