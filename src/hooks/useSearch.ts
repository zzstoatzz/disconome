import { useState, useCallback, useRef } from "react";
import { Suggestion } from "@/components/SearchSuggestions";
import debounce from "debounce";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/suggestions?q=${encodeURIComponent(value)}`,
      );
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setSuggestions([]);
    }
  }, []);

  // Create a memoized debounced function that persists across renders
  const debouncedFetchRef = useRef(
    debounce((value: string) => {
      fetchSuggestions(value);
    }, 300),
  );

  // Return the stable function reference that calls the debounced function
  const debouncedFetch = useCallback((value: string) => {
    debouncedFetchRef.current(value);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    setSuggestions,
    debouncedFetch,
  };
}
