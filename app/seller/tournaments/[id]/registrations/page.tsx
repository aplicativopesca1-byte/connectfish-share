import TournamentRegistrationsPageClient from "./TournamentRegistrationsPageClient";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TournamentRegistrationsPage({ params }: Props) {
  const { id } = await params;

  return <TournamentRegistrationsPageClient tournamentId={id} />;
}