import TournamentMapEditor from "./TournamentMapEditor";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TournamentMapPage({ params }: PageProps) {
  const { id } = await params;

  return <TournamentMapEditor tournamentId={id} />;
}