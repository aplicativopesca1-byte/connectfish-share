import TournamentPublicClient from "./TournamentPublicClient";

type PageProps = {
  params:
    | {
        slug: string;
      }
    | Promise<{
        slug: string;
      }>;
};

export default async function TournamentPublicPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug ?? "";

  return <TournamentPublicClient slug={slug} />;
}