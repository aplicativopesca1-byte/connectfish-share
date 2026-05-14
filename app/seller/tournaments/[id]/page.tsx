import TournamentDashboardClient from "./TournamentDashboardClient";

type PageProps = {
  params: {
    id: string;
  };
};

export default function TournamentPage({ params }: PageProps) {
  const { id } = params;

  return <TournamentDashboardClient tournamentId={id} />;
}