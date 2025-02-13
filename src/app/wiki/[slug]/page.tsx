import { notFound } from "next/navigation";
import ClientPage from "./client-page";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;

  if (!resolvedParams.slug) {
    notFound();
  }

  return <ClientPage slug={resolvedParams.slug} />;
}
