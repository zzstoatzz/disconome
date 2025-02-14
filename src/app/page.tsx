"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SearchSuggestions, Suggestion } from "@/components/SearchSuggestions";
import { useSearch } from "@/hooks/useSearch";
import { Leaderboard } from "@/components/Leaderboard";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { query, setQuery, suggestions, setSuggestions, debouncedFetch } =
    useSearch();

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

      <Leaderboard />
    </main>
  );
}
