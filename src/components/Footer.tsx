import Link from "next/link";

export default function Footer() {
  return (
    <footer className="flex-shrink-0 py-4 text-sm text-gray-500 text-center z-10">
      <div className="container mx-auto px-4">
        <p>
          Built by{" "}
          <Link
            href="https://github.com/zzstoatzz"
            className="text-blue-600 hover:text-blue-800 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            zzstoatzz
          </Link>{" "}
          · Open source on{" "}
          <Link
            href="https://github.com/zzstoatzz/disconome"
            className="text-blue-600 hover:text-blue-800 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
        </p>
        <p className="mt-1">
          Content from{" "}
          <Link
            href="https://www.wikipedia.org/"
            className="text-blue-600 hover:text-blue-800 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Wikipedia
          </Link>
          {" "}
          and{" "}
          <Link
            href="https://docs.bsky.app/docs/get-started"
            className="text-blue-600 hover:text-blue-800 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bluesky API
          </Link>
        </p>
      </div>
    </footer>
  );
}
