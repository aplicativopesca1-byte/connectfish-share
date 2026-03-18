import TournamentTeamsClient from "./TournamentTeamsClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TournamentTeamsPage({ params }: PageProps) {
  const { id } = await params;

  return <TournamentTeamsClient tournamentId={id} />;
}