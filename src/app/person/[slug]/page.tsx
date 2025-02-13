import { notFound } from "next/navigation";
import Link from "next/link";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

async function getWikiData(name: string) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles=${encodeURIComponent(name)}&origin=*`;

  try {
    const response = await fetch(searchUrl);
    const data = await response.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];

    if (pageId === "-1") {
      return null;
    }

    return {
      extract: pages[pageId].extract,
      title: pages[pageId].title,
    };
  } catch (error) {
    console.error("Error fetching Wikipedia data:", error);
    return null;
  }
}

export default async function PersonPage({ params }: PageProps) {
  const { slug } = await params;
  const name = decodeURIComponent(slug)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const wikiData = await getWikiData(name);

  if (!wikiData) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-4">{wikiData.title}</h1>
      <div
        className="prose lg:prose-xl"
        dangerouslySetInnerHTML={{ __html: wikiData.extract }}
      />
      <div className="mt-8">
        <Link href="/" className="text-blue-500 hover:underline">
          ← Back to Search
        </Link>
      </div>
    </div>
  );
}
