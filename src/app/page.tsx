"use client";

import { useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SearchSuggestions, Suggestion } from "@/components/SearchSuggestions";
import { useSearch } from "@/hooks/useSearch";
import { Leaderboard } from "@/components/Leaderboard";
import EntityGraph from "@/components/EntityGraph";
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
    <main className="min-h-screen p-4 relative grid place-items-center">
      <div className="fixed inset-0 transition-colors duration-500">
        <ErrorBoundary>
          <EntityGraph />
        </ErrorBoundary>
      </div>

      <div className="fixed top-4 left-4 z-20">
        <div className="group relative">
          <button
            className="p-2 rounded-full bg-white/90 dark:bg-gray-800/90 
                     shadow-lg backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 
                     transition-all duration-200"
            aria-label="What is this?"
          >
            ?
          </button>
          <div
            className="absolute left-0 top-full mt-2 w-72 p-4 rounded-lg 
                        bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg 
                        invisible group-hover:visible opacity-0 group-hover:opacity-100 
                        transition-all duration-200
                        sm:w-72 w-[calc(100vw-2rem)] max-w-[90vw]"
          >
            <h3 className="font-bold mb-2">What is this?</h3>
            <p className="text-sm mb-2">
              A graph of Wikipedia entities most viewed via this site. A
              wikipedia entity is just what I&apos;m calling the header of a
              wikipedia page + what an LLM produces as a structured timeline for
              that page. In the graph, nodes are sized by popularity and members
              of groups by label (as labeled by the LLM).
            </p>
            <a
              href="https://github.com/zzstoatzz/disconome"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Learn more →
            </a>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 left-6 z-20">
        <button
          onClick={() => {
            document.dispatchEvent(new CustomEvent("selectRandomNode"));
          }}
          className="p-2 px-4 rounded-lg bg-white/90 dark:bg-gray-800/90 
                   shadow-lg backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 
                   transition-all duration-200 text-sm flex items-center gap-2
                   sm:opacity-70 hover:opacity-100"
        >
          <span className="hidden sm:inline">random</span>
          <span>✧</span>
        </button>
      </div>

      <div
        className={`relative z-10 w-full max-w-md transition-opacity duration-300 ${isContentVisible ? "opacity-100" : "opacity-0 pointer-events-none"
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
              placeholder="enter something on wikipedia..."
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
        onClick={handleVisibilityToggle}
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

// Main component with Suspense boundary
export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center">
      <LoadingSpinner />
    </div>}>
      <HomeContent />
    </Suspense>
  );
}
