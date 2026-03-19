import TournamentForm from "../../components/TournamentForm";

type PageProps = {
  params:
    | {
        id: string;
      }
    | Promise<{
        id: string;
      }>;
};

export default async function EditTournamentPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const tournamentId = resolvedParams?.id ?? "";

  return <TournamentForm mode="edit" tournamentId={tournamentId} />;
}