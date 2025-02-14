"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SearchSuggestions } from "@/components/SearchSuggestions";
import Link from "next/link";

const SAMPLE_SUGGESTIONS = [
  "Albert Einstein",
  "Bitcoin",
  "World War II",
  "The Internet",
  "Quantum Physics",
  "Mount Everest",
  "Renaissance",
  "Industrial Revolution",
  "Artificial Intelligence",
];

interface LeaderboardEntry {
  slug: string;
  title: string;
  count: number;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsLoading(true);
      const slug = query.trim().toLowerCase().replace(/\s+/g, "-");
      router.push(`/wiki/${slug}`);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim()) {
      const filtered = SAMPLE_SUGGESTIONS.filter((item) =>
        item.toLowerCase().includes(value.toLowerCase()),
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setSuggestions([]);
    const slug = suggestion.toLowerCase().replace(/\s+/g, "-");
    router.push(`/wiki/${slug}`);
  };

  useEffect(() => {
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
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <h1 className="text-5xl font-bold mb-12 text-gray-800 dark:text-gray-100">
        discono.me
      </h1>
      <div className="w-full max-w-md relative">
        <form ref={formRef} onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Enter something..."
            className="w-full p-4 pr-12 text-lg font-mono border-2 border-gray-200 dark:border-gray-700 
                     rounded-lg focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 
                     focus:ring-0 text-gray-700 dark:text-gray-100 placeholder-gray-400 
                     dark:placeholder-gray-500 bg-white dark:bg-gray-800 shadow-sm
                     transition duration-200 ease-in-out"
            autoFocus
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400">
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              query && <span className="text-sm">Press Enter ↵</span>
            )}
          </div>
        </form>

        <SearchSuggestions
          suggestions={suggestions}
          onSelect={handleSuggestionSelect}
        />
      </div>

      {/* Leaderboard Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Most Viewed Entities</h2>
        {isLoading ? (
          <div className="text-gray-600">Loading trending entities...</div>
        ) : leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <Link
                key={entry.slug}
                href={`/wiki/${entry.slug}`}
                className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <span className="text-2xl font-bold text-gray-400 w-12">
                  #{index + 1}
                </span>
                <div className="flex-grow">
                  <h3 className="font-semibold">{entry.title}</h3>
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
    </main>
  );
}
