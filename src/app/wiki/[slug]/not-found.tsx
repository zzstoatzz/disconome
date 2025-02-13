import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-mono mb-4">Topic Not Found</h1>
      <div className="max-w-md text-center mb-8">
        <p className="mb-4">
          We couldn&apos;t find this topic on Wikipedia. This might be because:
        </p>
        <ul className="text-left list-disc ml-8 mb-4">
          <li>The spelling might be different</li>
          <li>The topic might be known by another name</li>
          <li>The topic might not have a Wikipedia page yet</li>
        </ul>
        <p>Try searching with a different term or check the spelling.</p>
      </div>
      <Link
        href="/"
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        ← Back to Search
      </Link>
    </div>
  );
}
