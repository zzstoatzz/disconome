import { useState, useCallback } from "react";
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

  const debouncedFetch = useCallback(
    debounce((value: string) => {
      fetchSuggestions(value);
    }, 300),
    [fetchSuggestions],
  );

  return {
    query,
    setQuery,
    suggestions,
    setSuggestions,
    debouncedFetch,
  };
}
