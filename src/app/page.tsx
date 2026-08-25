import type { Metadata } from "next";
import HomeClient from "./home-client";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}): Promise<Metadata> {
  const { u } = await searchParams;
  const title = u ? `${u}'s GitHub network · gitphere` : "gitphere";
  const description = "See your GitHub network on a map.";
  const ogImage = u ? `/api/og?u=${encodeURIComponent(u)}` : "/api/og";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function Page() {
  return <HomeClient />;
}
