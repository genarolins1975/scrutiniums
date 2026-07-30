type Kind = "info" | "erro" | "sucesso" | "aviso";

const styles: Record<Kind, string> = {
  info: "border-linha text-carvao-muted",
  erro: "border-erro text-erro",
  sucesso: "border-sucesso text-sucesso",
  aviso: "border-aviso text-aviso",
};

export function Alert({ kind = "info", children }: { kind?: Kind; children: React.ReactNode }) {
  return (
    <div
      role={kind === "erro" ? "alert" : "status"}
      className={`border-l-2 bg-papel px-4 py-3 text-sm ${styles[kind]}`}
    >
      {children}
    </div>
  );
}
