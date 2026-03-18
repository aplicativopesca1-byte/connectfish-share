import TournamentForm from "../../components/TournamentForm";

export default function EditTournamentPage({
  params,
}: {
  params: { id: string };
}) {
  return <TournamentForm mode="edit" tournamentId={params.id} />;
}