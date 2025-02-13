import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-mono mb-4">Page Not Found</h1>
      <p className="mb-8">
        We could not find information about this topic on Wikipedia.
      </p>
      <Link href="/" className="text-blue-500 hover:text-blue-600">
        ← Back to Search
      </Link>
    </div>
  );
}
