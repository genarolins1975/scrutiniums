import type { ReactNode } from "react";
import { TermoDica } from "@/components/evidencia/TermoDica";
import { LISTA_UNIDADES, Unidade } from "@/components/evidencia/Unidade";
import { Nome } from "@/components/i18n/Nome";
import { textoUnidadeMwmes } from "@/lib/energia/agua";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";

/**
 * Legenda de recorte de uma figura de Água e clima: período, universo e unidade em três colunas, logo abaixo da figura que descrevem
 * (o recorte como legenda, e não como bloco antes dela). Sem estado: serve às figuras que são componentes de cliente e às páginas.
 * O atributo `data-recorte-painel` é o mesmo que a abertura do módulo usa.
 *
 * O texto de cada coluna define, no ponto de uso, os termos que a figura usa (unidade, sigla, produto de dados): quem lê só a figura
 * não precisa abrir a abertura recolhida da página.
 */
export function AguaLegenda({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="grid gap-x-6 gap-y-2 border-t border-linha pt-3 text-sm text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Universo", "Scope")}</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

const escapa = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Frase já escrita no idioma (texto montado em src/lib/energia) com os nomes próprios da lista marcados: em inglês, cada ocorrência
 * inteira de um nome (reservatório, REE, bacia, UF, conjunto de dados) sai em <Nome>; em português, o texto como está, sem elemento.
 * O nome mais longo vence ("Corumbá IV" antes de "Corumbá").
 */
export function comNomes(texto: string, nomes: Iterable<string | null | undefined>, idioma: Idioma = idiomaEnergia()): ReactNode {
  if (idioma !== "en" || !texto) return texto;
  const lista = Array.from(new Set(Array.from(nomes).filter((n): n is string => !!n && texto.includes(n)))).sort((a, b) => b.length - a.length);
  if (!lista.length) return texto;
  const partes = texto.split(new RegExp(`(?<![\\p{L}])(${lista.map(escapa).join("|")})(?![\\p{L}])`, "u"));
  return <>{partes.map((p, i) => (i % 2 ? <Nome key={i}>{p}</Nome> : p))}</>;
}

/**
 * A unidade da EAR com a dica de unidades: em português, a Unidade "MWmês" de sempre; em inglês, "MWmonth" (a forma das publicações
 * em inglês do ONS) com a mesma dica e o mesmo destino.
 */
export function UnidadeMwmes({ idioma = idiomaEnergia() }: { idioma?: Idioma }) {
  if (idioma !== "en") return <Unidade u="MWmês" />; // i18n: dado (identificador da unidade)
  const dica = LISTA_UNIDADES.find((x) => x.u === "MWmês");
  return (
    <TermoDica href="/setor-eletrico/metodologia#unidades" rotulo={`MWmonth · ${dica?.nome ?? "Megawatt-month"}`} dica={dica?.dica ?? ""}>
      MWmonth
    </TermoDica>
  );
}

/** textoUnidadeMwmes (src/lib/energia/agua.ts) com a publicação do ONS citada pelo nome, marcada, na página inglesa. */
export function TextoUnidadeMwmes({ idioma = idiomaEnergia(), sufixo = "" }: { idioma?: Idioma; sufixo?: string }) {
  return tx<ReactNode>(
    `${textoUnidadeMwmes("pt")}${sufixo}`,
    <>
      MWmonth, the energy of one average megawatt over a 30-day month (1 MWmonth = 720 MWh, conversion from the ONS glossary in{" "}
      <Nome>Dados Relevantes 2010</Nome>){sufixo}
    </>,
    idioma,
  );
}
