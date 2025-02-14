export type Suggestion = {
  title: string;
  slug: string;
};

type SearchSuggestionsProps = {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
  className?: string;
};

export function SearchSuggestions({
  suggestions,
  onSelect,
  className = "",
}: SearchSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={`absolute w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 
                   dark:border-gray-700 rounded-lg shadow-lg overflow-hidden ${className}`}
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.slug}
          onClick={() => onSelect(suggestion)}
          className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-100 
                             hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          <span className="block font-medium">{suggestion.title}</span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">
            {suggestion.slug}
          </span>
        </button>
      ))}
    </div>
  );
}
