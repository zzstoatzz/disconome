"use client";

import { useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SearchSuggestions, Suggestion } from "@/components/SearchSuggestions";
import { useSearch } from "@/hooks/useSearch";
import { Leaderboard } from "@/components/Leaderboard";
import EntityGraph from "@/components/entity-graph";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Create a wrapper component for the search params functionality
function HomeContent() {
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { query, setQuery, suggestions, setSuggestions, debouncedFetch } =
    useSearch();

  const isContentVisible = searchParams.get("zen") !== "true";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsLoading(true);
      const slug = query.trim().toLowerCase().replace(/\s+/g, "-");
      const zenParam = searchParams.get("zen") === "true" ? "?zen=true" : "";
      router.push(`/wiki/${slug}${zenParam}`);
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
    const zenParam = searchParams.get("zen") === "true" ? "?zen=true" : "";
    router.push(`/wiki/${suggestion.slug}${zenParam}`);
  };

  const handleVisibilityToggle = () => {
    const newParams = new URLSearchParams(searchParams);
    if (isContentVisible) {
      newParams.set("zen", "true");
    } else {
      newParams.delete("zen");
    }
    router.push(`/?${newParams.toString()}`);
  };

  return (
    <main className="h-full relative">
      <div className="fixed inset-0">
        <ErrorBoundary>
          <EntityGraph />
        </ErrorBoundary>
      </div>

      <div className="fixed bottom-6 left-6 z-20">
        <button
          onClick={() => {
            document.dispatchEvent(new CustomEvent("selectRandomNode"));
          }}
          className="p-2 px-4 rounded-lg bg-white/90 dark:bg-gray-800/90 
                   shadow-lg backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 
                   transition-all duration-200 text-sm flex items-center gap-2
                   sm:opacity-70 hover:opacity-100
                   text-gray-800 dark:text-gray-200"
        >
          <span className="hidden sm:inline">random</span>
          <span>✧</span>
        </button>
      </div>

      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        {isContentVisible && (
          <div className="w-full max-w-md mt-16 transition-opacity duration-300 pointer-events-auto">
            <div className="flex flex-col items-center gap-12">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 text-center">
                discono.me
              </h1>
              <div className="w-full relative backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 p-4 rounded-lg sm:bg-transparent sm:dark:bg-transparent sm:backdrop-blur-none sm:p-0">
                <form ref={formRef} onSubmit={handleSubmit} className="relative">
                  <input
                    type="text"
                    value={query}
                    onChange={handleQueryChange}
                    placeholder="submit a wikipedia page ..."
                    className="w-full p-4 pr-12 text-sm font-mono border-2 border-gray-200 dark:border-gray-700 
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
          </div>
        )}
      </div>

      <button
        onClick={handleVisibilityToggle}
        className="fixed bottom-6 right-6 z-20 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 
                 shadow-lg backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 
                 transition-all duration-200 text-gray-800 dark:text-gray-200"
        aria-label={isContentVisible ? "Enter zen mode" : "Exit zen mode"}
      >
        {isContentVisible ? "⌘" : "⎋"}
      </button>
    </main>
  );
}

// Main component with Suspense boundary
export default function Home() {
  return (
    <Suspense fallback={<div className="h-full grid place-items-center">
      <LoadingSpinner />
    </div>}>
      <HomeContent />
    </Suspense>
  );
}
