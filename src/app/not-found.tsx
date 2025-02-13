import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-4">Person Not Found</h1>
      <p className="mb-8">
        We could not find information about this person (are they on
        Wikipedia?).
      </p>
      <Link href="/" className="text-blue-500 hover:underline">
        ← Back to Search
      </Link>
    </div>
  );
}
