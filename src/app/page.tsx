"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SearchSuggestions, Suggestion } from "@/components/SearchSuggestions";
import { useSearch } from "@/hooks/useSearch";
import { Leaderboard } from "@/components/Leaderboard";
import EntityGraph from "@/components/EntityGraph";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { query, setQuery, suggestions, setSuggestions, debouncedFetch } =
    useSearch();
  const [isContentVisible, setIsContentVisible] = useState(true);

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
      debouncedFetch(value);
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionSelect = (suggestion: Suggestion) => {
    setQuery(suggestion.title);
    setSuggestions([]);
    router.push(`/wiki/${suggestion.slug}`);
  };

  return (
    <main className="min-h-screen p-4 relative grid place-items-center">
      <div className="fixed inset-0 transition-colors duration-500">
        <ErrorBoundary>
          <EntityGraph />
        </ErrorBoundary>
      </div>

      <div
        className={`relative z-10 w-full max-w-md transition-opacity duration-300 ${
          isContentVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <h1 className="text-5xl font-bold mb-12 text-gray-800 dark:text-gray-100 text-center">
          discono.me
        </h1>
        <div className="w-full relative backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 p-4 rounded-lg sm:bg-transparent sm:dark:bg-transparent sm:backdrop-blur-none sm:p-0">
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
                query && <span className="text-sm">↵</span>
              )}
            </div>
          </form>

          <SearchSuggestions
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
          />

          <Leaderboard />
        </div>
      </div>

      <button
        onClick={() => setIsContentVisible(!isContentVisible)}
        className="fixed bottom-6 right-6 z-20 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 
                 shadow-lg backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 
                 transition-all duration-200"
        aria-label={isContentVisible ? "Enter zen mode" : "Exit zen mode"}
      >
        {isContentVisible ? "⌘" : "⎋"}
      </button>
    </main>
  );
}
