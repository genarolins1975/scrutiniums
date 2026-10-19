"use client";

import Link from "@/components/i18n/LinkIdioma";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { hrefNoIdioma } from "@/lib/i18n-href";

/**
 * Link de conta sensível à sessão num cabeçalho estático: visitante vê
 * "Entrar"; quem tem sessão vê "Minha conta". Consulta GET /api/auth/estado
 * (sempre 200, resposta mínima sem PII). Enquanto a resposta não chega, o
 * espaço fica reservado e vazio, para quem está logado não ver "Entrar" piscar.
 * O retorno depois do login preserva a página, o modo (?modo=) e a âncora,
 * lidos no momento do clique: a troca de modo no cliente não muda o pathname.
 */
export function AcessoConta({ destino }: { destino: string }) {
  const idioma = useIdioma();
  const tx = useTx();
  // em inglês, "Sign in" leva à irmã /en/entrar; o retorno (?de=) é o endereço da página, como em português
  const entrar = (de: string) => hrefNoIdioma(`/entrar?de=${encodeURIComponent(de)}`, idioma);
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
  const aqui = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return (
    <EstadoConta
      logado={logado}
      hrefEntrar={entrar(volta)}
      rotulos={{ conta: tx("Minha conta", "My account"), entrar: tx("Entrar", "Sign in") }}
      onAtualiza={() => setVolta(aqui())}
      onEntrar={() => window.location.assign(entrar(aqui()))}
    />
  );
}

/**
 * O que a barra mostra para cada estado da sessão (separado para os testes de com e sem sessão): enquanto a resposta não
 * chega, um espaço reservado e nenhum link; com sessão, só "Minha conta"; sem sessão, só "Entrar", com volta à página.
 */
export function EstadoConta({
  logado,
  hrefEntrar,
  rotulos,
  onAtualiza,
  onEntrar,
}: {
  logado: boolean | null;
  hrefEntrar: string;
  rotulos: { conta: string; entrar: string };
  onAtualiza?: () => void;
  onEntrar?: () => void;
}) {
  const classe = "rotulo inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao-muted hover:text-energia-dark";
  if (logado === null) return <span aria-hidden="true" className="inline-block min-h-[44px] w-20" />;
  return logado ? (
    <Link href="/app/conta" className={classe}>
      {rotulos.conta}
    </Link>
  ) : (
    <a
      href={hrefEntrar}
      className={classe}
      onMouseEnter={onAtualiza}
      onFocus={onAtualiza}
      onClick={(e) => {
        if (!onEntrar || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onEntrar();
      }}
    >
      {rotulos.entrar}
    </a>
  );
}
