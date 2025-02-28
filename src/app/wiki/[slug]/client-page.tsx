"use client";

import { experimental_useObject as useObject } from "ai/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { slugify } from "@/lib/utils";
import { TrackVisitResponse } from "@/lib/api-types";

const schema = z.object({
  events: z.object({
    items: z.array(
      z.object({
        date: z.string(),
        title: z.string(),
        description: z.string(),
      }),
    ),
  }),
});

interface WikiData {
  extract: string;
  title: string;
  url?: string;
  isDisambiguation?: boolean;
  disambiguationOptions?: Array<{
    title: string;
    snippet: string;
  }>;
}

async function getWikiData(name: string) {
  // First, try to get an exact match
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(name)}&origin=*`;

  try {
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.query?.search?.length) {
      return null;
    }

    // Take the first result as it's usually the most relevant
    const searchResult = searchData.query.search[0];

    // Get the full page content
    const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|categories&exintro=true&titles=${encodeURIComponent(searchResult.title)}&origin=*`;
    const response = await fetch(pageUrl);
    const data = await response.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];

    if (pageId === "-1") {
      return null;
    }

    const page = pages[pageId];

    // Check if this is a disambiguation page
    const isDisambiguation = page.categories?.some((cat: { title: string }) =>
      cat.title === 'Category:Disambiguation pages' ||
      cat.title === 'Category:All disambiguation pages'
    );

    if (isDisambiguation) {
      // If it's a disambiguation page, get all the options
      const options = searchData.query.search.map((result: { title: string; snippet: string }) => ({
        title: result.title,
        snippet: result.snippet.replace(/<\/?span[^>]*>/g, '')  // Remove highlight spans
      }));

      return {
        extract: page.extract,
        title: page.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        isDisambiguation: true,
        disambiguationOptions: options
      };
    }

    return {
      extract: page.extract,
      title: page.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
      isDisambiguation: false
    };
  } catch (error) {
    console.error("Error fetching Wikipedia data:", error);
    return null;
  }
}

const hasVisited = (slug: string) => {
  try {
    const normalizedSlug = slugify(slug);
    const visits = JSON.parse(localStorage.getItem("visits") || "{}");
    return !!visits[normalizedSlug];
  } catch {
    return false;
  }
};

const markVisited = (slug: string) => {
  try {
    const normalizedSlug = slugify(slug);
    const visits = JSON.parse(localStorage.getItem("visits") || "{}");
    visits[normalizedSlug] = Date.now();
    localStorage.setItem("visits", JSON.stringify(visits));
  } catch (e) {
    console.error("Failed to mark visit:", e);
  }
};

export default function ClientPage({ slug }: { slug: string }) {
  const [wikiData, setWikiData] = useState<WikiData | null>(null);
  const [hasRequested, setHasRequested] = useState(false);
  const [isWikiLoading, setIsWikiLoading] = useState(true);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Array<{ name: string; source: string }>>([]);
  const searchParams = useSearchParams();
  const isZenMode = searchParams.get("zen") === "true";
  const homeLink = isZenMode ? "/?zen=true" : "/";

  const {
    object: eventData,
    isLoading,
    error,
    submit,
  } = useObject({
    api: "/api/lineage",
    schema: schema,
  });

  // Show either partial or final data
  const events = eventData?.events?.items;

  // Only submit once and only if we have Wikipedia data
  useEffect(() => {
    if (!hasRequested && wikiData) {
      submit({
        prompt: wikiData.title,
        wikiContent: wikiData.extract,
      });
      setHasRequested(true);
    }
  }, [submit, hasRequested, wikiData]);

  // Load Wikipedia data
  useEffect(() => {
    async function loadWikiData() {
      setIsWikiLoading(true);
      const name = decodeURIComponent(slug)
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      const data = await getWikiData(name);
      if (data) {
        // Use the original search term as the title for tracking
        // This ensures trending topics are tracked consistently
        data.title = name;
        setWikiData(data);
      }
      setIsWikiLoading(false);
    }
    loadWikiData();
  }, [slug]);

  // Track visit when Wikipedia data is loaded
  useEffect(() => {
    async function trackVisit() {
      // Only track visits for non-disambiguation pages
      if (wikiData && !wikiData.isDisambiguation && !hasVisited(slug)) {
        try {
          const response = await fetch("/api/track-visit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              slug,
              title: wikiData.title,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const responseData = await response.json() as TrackVisitResponse;
          if (responseData.success) {
            markVisited(slug);
            if (responseData.data?.labels) {
              setLabels(responseData.data.labels);
            }
          } else {
            setVisitError(responseData.message || "Failed to track visit");
          }
        } catch (error) {
          console.error("❌ Visit tracking - Failed:", error);
          setVisitError("Failed to track visit. Please try again later.");
        }
      }
    }

    trackVisit();
  }, [slug, wikiData]);

  // Debug logs for timeline generation
  useEffect(() => {
    console.log("📊 Timeline state:", {
      hasWikiData: !!wikiData,
      hasEvents: !!eventData,
      isLoading,
      error,
    });
  }, [wikiData, eventData, isLoading, error]);

  if (isWikiLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-gray-900 dark:text-white">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href={homeLink}
            className="flex items-center text-lg text-gray-900 dark:text-white hover:text-blue-500 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Search
          </Link>
        </nav>
        <div className="flex items-center space-x-3">
          <LoadingSpinner />
          <span>Searching Wikipedia...</span>
        </div>
      </div>
    );
  }

  if (!wikiData) {
    return (
      <div className="container mx-auto px-4 py-8 text-gray-900 dark:text-white">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href={homeLink}
            className="flex items-center text-lg text-gray-900 dark:text-white hover:text-blue-500 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Search
          </Link>
        </nav>
        <div>No Wikipedia information found.</div>
      </div>
    );
  }

  if (wikiData.isDisambiguation) {
    return (
      <div className="container mx-auto px-4 py-8 text-gray-900 dark:text-white">
        <nav className="mb-8 flex items-center justify-between">
          <Link
            href={homeLink}
            className="flex items-center text-lg text-gray-900 dark:text-white hover:text-blue-500 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Search
          </Link>
        </nav>
        <h1 className="text-4xl font-mono mb-4">Did you mean...</h1>
        <div className="space-y-4">
          {wikiData.disambiguationOptions?.map((option, index) => (
            <Link
              key={index}
              href={`/wiki/${encodeURIComponent(option.title.toLowerCase().replace(/ /g, '-'))}${isZenMode ? '?zen=true' : ''}`}
              className="block p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <h3 className="text-xl font-mono mb-2">{option.title}</h3>
              <p className="text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: option.snippet }} />
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="container mx-auto px-4 py-8">
        <nav className="mb-8 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 py-4">
          <Link
            href={homeLink}
            className="flex items-center text-lg text-gray-900 dark:text-white hover:text-blue-500 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Search
          </Link>
          {wikiData.url && (
            <a
              href={wikiData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-blue-500 hover:text-blue-600 transition-colors"
            >
              <span>View on Wikipedia</span>
              <span className="ml-1">↗</span>
            </a>
          )}
        </nav>

        {visitError && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg">
            {visitError}
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-4xl font-mono mb-4 text-gray-900 dark:text-white">
            {wikiData.title}
          </h1>
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg max-w-[1200px]">
              {labels.map((label, index) => {
                const isTrending = label.source === 'trending';
                return (
                  <span
                    key={index}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5
                      ${isTrending
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200 dark:border-sky-700 cursor-pointer hover:bg-sky-200 dark:hover:bg-sky-900/50'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}
                    onClick={() => {
                      if (isTrending) {
                        window.open(`https://bsky.app/search?q=${encodeURIComponent(label.name)}`, '_blank');
                      }
                    }}
                  >
                    {isTrending && (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 6l-9.5 9.5-5-5L1 18" />
                        <path d="M17 6h6v6" />
                      </svg>
                    )}
                    {label.name}
                  </span>
                );
              })}
            </div>
          )}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            From Wikipedia, the free encyclopedia
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto">
          {/* Left side: Events */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white sticky top-0 bg-white dark:bg-gray-900 py-2">
              Timeline
            </h2>
            {isLoading && (
              <div className="flex items-center space-x-3 text-gray-900 dark:text-white">
                <LoadingSpinner />
                <span>Generating timeline... (this may take a minute)</span>
              </div>
            )}
            {error && (
              <div className="text-red-600 dark:text-red-400">
                Error: {error.message}
              </div>
            )}
            {!isLoading && !error && (!events || events.length === 0) && (
              <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                <p className="text-gray-700 dark:text-gray-300">
                  No timeline events could be generated from the available
                  information. This might be because:
                </p>
                <ul className="list-disc ml-6 mt-2 text-gray-600 dark:text-gray-400">
                  <li>
                    The Wikipedia excerpt doesn&apos;t contain enough
                    chronological information
                  </li>
                  <li>
                    The subject matter might not have a clear timeline of events
                  </li>
                </ul>
                <p className="mt-2 text-gray-700 dark:text-gray-300">
                  You can still read the Wikipedia description on the right.
                </p>
              </div>
            )}
            <div className="space-y-4">
              {events?.map((event, i) => (
                <div
                  key={i}
                  className="p-4 border-l-4 border-blue-300 rounded-lg 
                           bg-white dark:bg-gray-800 shadow-sm 
                           hover:shadow-md transition-all duration-200"
                >
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {event?.date}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {event?.title}
                  </h3>
                  <p className="mt-2 text-gray-800 dark:text-gray-200">
                    {event?.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right side: Wikipedia Content */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Description
            </h2>
            <div
              className="prose lg:prose-xl max-w-none
                       prose-headings:text-gray-900 prose-headings:dark:text-white
                       prose-p:text-gray-800 prose-p:dark:text-gray-200
                       prose-a:text-blue-600 prose-a:dark:text-blue-400"
              dangerouslySetInnerHTML={{ __html: wikiData.extract }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
