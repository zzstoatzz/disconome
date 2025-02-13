export function LoadingSpinner() {
  return (
    <div className="inline-block h-4 w-4">
      <div className="h-full w-full animate-spin rounded-full border-2 border-gray-900 dark:border-white border-t-transparent" />
    </div>
  );
}
