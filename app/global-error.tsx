"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui", padding: 20 }}>
        <h1>Erro no app</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {String(error?.message || error)}
          {"\n"}
          {error?.digest ? `digest: ${error.digest}\n` : ""}
          {error?.stack || ""}
        </pre>
        <button onClick={() => reset()}>Tentar novamente</button>
      </body>
    </html>
  );
}