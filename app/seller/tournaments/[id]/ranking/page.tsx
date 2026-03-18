import TournamentRankingClient from "./TournamentRankingClient";

type PageProps = {
  params:
    | {
        id: string;
      }
    | Promise<{
        id: string;
      }>;
};

export default async function TournamentRankingPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const tournamentId = resolvedParams?.id ?? "";

  return <TournamentRankingClient tournamentId={tournamentId} />;
}