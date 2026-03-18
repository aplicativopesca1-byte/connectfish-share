import TournamentValidationCapturesClient from "./TournamentValidationCapturesClient";

type PageProps = {
  params: {
    id: string;
  };
};

export default function TournamentCapturesPage({ params }: PageProps) {
  return <TournamentValidationCapturesClient tournamentId={params.id} />;
}