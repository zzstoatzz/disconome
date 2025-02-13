type SearchSuggestionsProps = {
    suggestions: string[]
    onSelect: (suggestion: string) => void
    className?: string
}

export function SearchSuggestions({ suggestions, onSelect, className = '' }: SearchSuggestionsProps) {
    if (suggestions.length === 0) return null

    return (
        <div className={`absolute w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 
                   dark:border-gray-700 rounded-lg shadow-lg overflow-hidden ${className}`}>
            {suggestions.map((suggestion, index) => (
                <button
                    key={index}
                    onClick={() => onSelect(suggestion)}
                    className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-100 
                   hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                >
                    {suggestion}
                </button>
            ))}
        </div>
    )
} 