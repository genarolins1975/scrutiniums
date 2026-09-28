"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Link de conta sensível à sessão num cabeçalho estático: visitante vê
 * "Entrar"; quem tem sessão vê "Minha conta". Consulta GET /api/auth/estado
 * (sempre 200, resposta mínima sem PII). Enquanto a resposta não chega, o
 * espaço fica reservado e vazio, para quem está logado não ver "Entrar" piscar.
 * O retorno depois do login preserva a página, o modo (?modo=) e a âncora,
 * lidos no momento do clique: a troca de modo no cliente não muda o pathname.
 */
export function AcessoConta({ destino }: { destino: string }) {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [volta, setVolta] = useState(destino);
  const caminho = usePathname() || destino;
  useEffect(() => {
    setVolta(`${caminho}${window.location.search}${window.location.hash}`);
    fetch("/api/auth/estado", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { logado: false }))
      .then((j: { logado?: boolean }) => setLogado(j.logado === true))
      .catch(() => setLogado(false));
  }, [caminho]);
  const classe = "rotulo inline-flex min-h-[44px] items-center text-carvao-muted hover:text-energia-dark";
  if (logado === null) return <span aria-hidden="true" className="inline-block min-h-[44px] w-20" />;
  const atualiza = () => setVolta(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  return logado ? (
    <Link href="/app/conta" className={classe}>
      Minha conta
    </Link>
  ) : (
    <a
      href={`/entrar?de=${encodeURIComponent(volta)}`}
      className={classe}
      onMouseEnter={atualiza}
      onFocus={atualiza}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        window.location.assign(`/entrar?de=${encodeURIComponent(`${window.location.pathname}${window.location.search}${window.location.hash}`)}`);
      }}
    >
      Entrar
    </a>
  );
}
