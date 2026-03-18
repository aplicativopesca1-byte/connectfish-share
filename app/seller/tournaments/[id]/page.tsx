import TournamentDashboardClient from "./TournamentDashboardClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TournamentPage({ params }: PageProps) {
  const { id } = await params;

  return <TournamentDashboardClient tournamentId={id} />;
}