import type { ReactNode } from "react";
import Link from "@/components/energia/LinkSemPrefetch";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { dataBR } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";
import type { ControleVisao } from "@/lib/energia/tipos-visao";
import { datasLegiveis, enumLegivel, painelVisao, type IdPainelVisao } from "@/lib/energia/visao";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { goldEmString, goldNoBloco } from "@/lib/energia/i18n/entrada-visao";

/**
 * Peças de servidor da Visão geral (/setor-eletrico/visao-geral): o painel (pergunta, subtítulo, "Por que isso importa" recolhido
 * e fonte curta), a tira das regras que pedem atenção, as datas de cada parte, o recorte (período, universo e unidade), os avisos
 * de ausência e defasagem, os controles da publicação e o estado de ausência da gold inteira.
 *
 * Os quatro painéis ficam numa página só porque a Visão geral é o resumo de poucos minutos; o peso fica abaixo da meta de cerca de
 * 600 KB de HTML porque séries longas, históricos e as regras completas estão nos CSV de download e nos módulos de origem.
 */

/**
 * Painel da Visão geral: a pergunta em serifa, o subtítulo (que traz a razão do painel numa oração, à vista), o corpo e a fonte. Mantém a âncora e
 * `aria-labelledby` de sempre. O bloco recolhido "Por que isso importa" saiu: a razão está no subtítulo e na abertura da página.
 */
export function PainelVisao({
  id,
  subtitulo,
  fonte,
  children,
}: {
  id: IdPainelVisao;
  /** Linha sob a pergunta: o que o painel mostra e por que ele existe. */
  subtitulo?: ReactNode;
  fonte: ReactNode;
  children: ReactNode;
}) {
  const p = painelVisao(id);
  return (
    <section id={id} aria-labelledby={`${id}-h`} data-painel-evidencia="" className="scroll-mt-28 border-t border-linha pt-6">
      <header>
        <h2 id={`${id}-h`} className="ed-h2 font-serif text-carvao">
          {p.pergunta}
        </h2>
        {subtitulo && <p className="mt-2 max-w-prose2 text-sm text-carvao-muted">{subtitulo}</p>}
      </header>
      <div className="mt-5 space-y-6">{children}</div>
      <footer className="mt-3 border-t border-linha pt-3">
        <p className="text-xs leading-relaxed text-carvao-muted">{fonte}</p>
      </footer>
    </section>
  );
}

/** Data de referência de cada parte da página, na forma de uma lista curta (dentro do bloco "Fontes, datas e siglas" da abertura). */
export function VisaoDatas({ itens }: { itens: { rotulo: string; texto: string; natureza?: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label={tx("Datas de referência de cada parte", "Reference dates of each part")}>
      {itens.map((x) => (
        <li key={x.rotulo} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.texto}
          </span>
          {x.natureza && <SeloNatureza natureza={x.natureza} compacto />}
        </li>
      ))}
    </ul>
  );
}

type RegraDaTira = { id: string; titulo: string };

/**
 * Tira do topo com as regras que pedem atenção: as que estão em alerta sobre o sistema, as em observação (a condição existe, mas ainda
 * sem a duração mínima) e quantas estão em alerta sobre os próprios dados. Sem regra nessa situação, diz isso. Cada título leva à regra.
 */
export function VisaoAtencao({
  alertaSistema,
  observacao,
  alertaDados,
}: {
  alertaSistema: readonly RegraDaTira[];
  observacao: readonly RegraDaTira[];
  alertaDados: readonly RegraDaTira[];
}) {
  const idioma = idiomaEnergia();
  const lista = (xs: readonly RegraDaTira[]) =>
    xs.map((x, i) => (
      <span key={x.id}>
        {i > 0 && "; "}
        <Link href={`#regra-${x.id}`} className="text-energia-dark underline underline-offset-4 hover:text-carvao">
          {goldEmString(x.titulo, idioma)}
        </Link>
      </span>
    ));
  const nada = alertaSistema.length === 0 && observacao.length === 0;
  // mais de uma regra sobre os dados vira contagem com ligação, para a tira caber numa linha
  const dados =
    alertaDados.length > 1 ? (
      <Link href="#observar" className="text-energia-dark underline underline-offset-4 hover:text-carvao">
        {tx(`${alertaDados.length} regras`, `${alertaDados.length} rules`)}
      </Link>
    ) : (
      lista(alertaDados)
    );
  return (
    <aside aria-label={tx("Regras que pedem atenção", "Rules that call for attention")} data-atencao="" className="space-y-1 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao">
      {nada && <p>{tx("Nenhuma regra sobre o sistema está em alerta nem em observação.", "No rule about the system is in alert or under observation.")}</p>}
      {alertaSistema.length > 0 && (
        <p>
          <span className="rotulo mr-2 text-mineral">{tx("Em alerta sobre o sistema", "In alert about the system")}</span>
          {lista(alertaSistema)}.
        </p>
      )}
      {observacao.length > 0 && (
        <p>
          <span className="rotulo mr-2 text-mineral">{tx("Em observação", "Under observation")}</span>
          {lista(observacao)} <span className="text-carvao-muted">{tx("(ainda sem a duração mínima de alerta)", "(still without the minimum alert duration)")}</span>.
          {alertaDados.length > 0 && (
            <>
              {" "}
              <span className="rotulo mx-2 text-mineral">{tx("Em alerta sobre os dados", "In alert about the data")}</span>
              {dados}.
            </>
          )}
        </p>
      )}
      {observacao.length === 0 && alertaDados.length > 0 && (
        <p>
          <span className="rotulo mr-2 text-mineral">{tx("Em alerta sobre os dados", "In alert about the data")}</span>
          {dados}.
        </p>
      )}
    </aside>
  );
}

/** Período, universo e unidade do painel (o recorte que a abertura da página dá para o conjunto, repetido por painel). */
export function VisaoRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-xs text-carvao-muted sm:grid-cols-3" data-recorte-painel="">
      <div>
        <dt className="rotulo text-mineral">{tx("Período", "Period")}</dt>
        <dd className="mt-0.5 leading-relaxed">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Universo", "Universe")}</dt>
        <dd className="mt-0.5 leading-relaxed">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">{tx("Unidade", "Unit")}</dt>
        <dd className="mt-0.5 leading-relaxed">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Aviso que muda a leitura (fonte defasada, ausência legítima, datas diferentes). */
export function VisaoAviso({ children, tipo = "nota" }: { children: ReactNode; tipo?: "nota" | "alerta" }) {
  return (
    <div
      role={tipo === "alerta" ? "note" : undefined}
      className={`max-w-prose2 border-l-2 pl-3 text-sm leading-relaxed ${tipo === "alerta" ? "border-aviso text-carvao" : "border-mineral text-carvao-muted"}`}
    >
      {children}
    </div>
  );
}

/** Controles de execução publicados na gold (não são testes): nome, resultado com palavra e detalhe. */
export function VisaoControles({ controles }: { controles: ControleVisao[] }) {
  const idioma = idiomaEnergia();
  const rot = tx<Record<string, string>>(
    { aprovado: "aprovado", ressalva: "com ressalva", reprovado: "reprovado" },
    { aprovado: "passed", ressalva: "passed with a caveat", reprovado: "failed" },
  );
  return (
    <ul className="space-y-1.5 text-sm text-carvao-muted">
      {controles.map((c) => (
        <li key={c.nome} className="leading-relaxed [overflow-wrap:anywhere]">
          <span className={c.resultado === "aprovado" ? "text-carvao" : "text-aviso"}>{rot[c.resultado] ?? c.resultado}</span>:{" "}
          {idioma === "en" ? (
            <>
              {goldNoBloco(c.nome, idioma, "visao-controle-nome")}. {goldNoBloco(enumLegivel(datasLegiveis(c.detalhe, "pt"), "pt"), idioma, "visao-controle-detalhe")}
            </>
          ) : (
            `${c.nome}. ${enumLegivel(datasLegiveis(c.detalhe))}`
          )}
        </li>
      ))}
    </ul>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function VisaoIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="visao-geral" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo={tx("Visão geral indisponível nesta publicação", "Overview unavailable in this publication")}
          motivo={
            motivo
              ? goldNoBloco(motivo, idiomaEnergia(), "visao-indisponivel")
              : tx(
                  "A gold da visão geral (public/energia/gold/sintese.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe.",
                  "The overview gold (public/energia/gold/sintese.json) was not generated or did not pass validation; the last valid publication is kept when it exists.",
                )
          }
        />
        <p className="mt-6 text-sm">
          <Link href="/setor-eletrico" className="text-energia-dark underline underline-offset-4">
            {tx("Voltar ao mapa do observatório", "Back to the observatory map")}
          </Link>
        </p>
      </main>
    </>
  );
}

/** Data na forma da página, para os textos de datas das partes. */
export function dataDaParte(dia: string | null): string {
  return dia ? dataBR(dia) : tx("sem dado nesta publicação", "no data in this publication");

}
