"use client";

import Link from "@/components/energia/LinkSemPrefetch";
import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { COLUNAS_DISTRIBUIDORAS, avisoAnosComparacao, rotaEntidade, type LinhaComparacao } from "@/lib/energia/empresas";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { Nome } from "@/components/i18n/Nome";
import { LIMITE_COMPARACAO, type EntidadeBuscavel, type LinhaTabela } from "@/lib/energia/tabela";

/**
 * P037: o comparador de até quatro distribuidoras (a figura principal da página) e o índice de todas elas (tabela com busca, filtros e
 * exportação), com os números de referência copiados das páginas de origem pelo mesmo CNPJ (perdas, DEC e FEC diante do limite de cada
 * uma, tarifa B1 vigente). Os dois pedaços compartilham o estado da URL: a distribuidora escolhida no índice (?dist.f=, abre o resumo
 * com o link para a ficha) e as comparadas (?dist.cmp=). Sem nada no link, entram as quatro ativas com mais unidades consumidoras (padrão
 * dito no texto e não gravado na URL); ?dist.cmp= vazio é a escolha explícita de nenhuma. Os gráficos e a tabela do comparador usam as
 * mesmas linhas.
 */
type Props = {
  entidades: EntidadeBuscavel[];
  padrao: string[];
};

/** Esquema da URL comum aos dois pedaços (as distribuidoras aceitas e a comparação padrão). */
function useEsquema({ entidades, padrao }: Props) {
  const slugs = useMemo(() => entidades.map((e) => e.id), [entidades]);
  return useMemo(
    () => ({
      f: campo(tiposUrl.opcao(slugs), "", { param: "dist.f" }),
      cmp: campo(tiposUrl.lista(tiposUrl.opcao(slugs), { max: LIMITE_COMPARACAO }), padrao, { param: "dist.cmp" }),
    }),
    [slugs.join(","), padrao.join(",")], // eslint-disable-line react-hooks/exhaustive-deps
  );
}

export type EmpresasComparadorProps = Props & {
  comparacao: LinhaComparacao[];
  /** Taxa nacional da gold de Perdas (mesmo ano), como referência das barras; null quando a gold não publica. */
  referenciaPerdas: { valor: number; rotulo: string } | null;
};

export function EmpresasComparador({ entidades, padrao, comparacao, referenciaPerdas }: EmpresasComparadorProps) {
  const tx = useTx();
  const idioma = useIdioma();
  const { num } = formatos(idioma);
  const esquema = useEsquema({ entidades, padrao });
  const [v, definir] = useEstadoUrl(esquema);
  const porId = useMemo(() => new Map(comparacao.map((c) => [c.id, c])), [comparacao]);
  const dados = useMemo(() => v.cmp.map((id) => porId.get(id)).filter((x): x is LinhaComparacao => !!x), [v.cmp, porId]);
  const aviso = avisoAnosComparacao(dados, idioma);
  const nomeDe = (id: string) => entidades.find((e) => e.id === id)?.rotulo ?? id;
  const ehPadrao = v.cmp.join(",") === padrao.join(",");
  const anos = (k: "ano_perdas" | "ano_qualidade") => Array.from(new Set(dados.map((d) => d[k]).filter((a): a is number => a !== null))).join(", ") || tx("sem dado", "no data");

  return (
    <div className="space-y-4" id="comparar">
      <Comparador
        rotulo={tx("Distribuidoras comparadas (até 4)", "Distribution utilities compared (up to 4)")}
        entidades={entidades}
        selecionadas={v.cmp}
        onMudar={(ids) => definir({ cmp: ids })}
        dicaBusca={tx("Sigla, nome, CNPJ ou UF", "Acronym, name, CNPJ or state")}
        vazio={tx("Nenhuma distribuidora escolhida. Escolha aqui ou pelo índice, mais abaixo.", "No distribution utility chosen. Choose here or from the index, further below.")}
      >
        {() => null}
      </Comparador>
      <p className="text-sm text-carvao-muted">
        {ehPadrao
          ? tx(
              "Sem escolha no link, entram as quatro distribuidoras ativas com mais unidades consumidoras no ano de referência da continuidade.",
              "With no choice in the link, the four active distribution utilities with the most consumer units in the continuity reference year are shown.",
            )
          : tx(`Comparando ${dados.map((d) => d.rotulo).join(", ") || "nenhuma"}.`, `Comparing ${dados.map((d) => d.rotulo).join(", ") || "none"}.`)}{" "}
        {tx(
          `Perdas de ${anos("ano_perdas")}; continuidade de ${anos("ano_qualidade")}; tarifa vigente na data das tarifas de aplicação. A regra de pares completa está na ficha de cada uma.`,
          `Losses for ${anos("ano_perdas")}; continuity of supply for ${anos("ano_qualidade")}; tariff in force on the date of the application tariffs. The full peer rule is in each one's profile.`,
        )}
      </p>
      {aviso && (
        <p role="note" className="border-l-2 border-mineral pl-3 text-sm text-carvao">
          {aviso}
        </p>
      )}
      {dados.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <GraficoBarras
            rotulosSaoNomes
            titulo={tx("Perdas totais sobre a energia injetada", "Total losses over the energy injected")}
            dados={dados}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "perdas", rotulo: tx("Perdas totais", "Total losses"), cor: "var(--serie-comp-1)" }]}
            unidade="%"
            casas={2}
            orientacao="horizontal"
            rotulosValor
            referencias={referenciaPerdas ? [referenciaPerdas] : []}
          />
          <GraficoBarras
            rotulosSaoNomes
            titulo={tx("Tarifa residencial B1 vigente, sem tributos", "Residential B1 tariff in force, excluding taxes")}
            dados={dados}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "tarifa", rotulo: tx("Tarifa B1 (TE + TUSD)", "B1 tariff (TE + TUSD)"), cor: "var(--serie-comp-2)" }]}
            unidade="R$/MWh"
            casas={2}
            orientacao="horizontal"
            rotulosValor
          />
          <GraficoPontos
            rotulosSaoNomes
            titulo={tx("DEC apurado diante do limite de cada distribuidora", "Measured DEC against each distribution utility's limit")}
            itens={dados.map((d) => ({ id: d.id, rotulo: d.rotulo, valor: d.dec, referencia: d.dec_limite }))}
            unidade="h"
            casas={2}
            rotuloValor={tx("DEC apurado", "Measured DEC")}
            rotuloReferencia={tx("Limite regulatório", "Regulatory limit")}
            zeroNoEixo
          />
          <GraficoPontos
            rotulosSaoNomes
            titulo={tx("FEC apurado diante do limite de cada distribuidora", "Measured FEC against each distribution utility's limit")}
            itens={dados.map((d) => ({ id: d.id, rotulo: d.rotulo, valor: d.fec, referencia: d.fec_limite }))}
            unidade={tx("interrupções", "interruptions")}
            casas={2}
            rotuloValor={tx("FEC apurado", "Measured FEC")}
            rotuloReferencia={tx("Limite regulatório", "Regulatory limit")}
            zeroNoEixo
          />
        </div>
      )}
      {dados.length > 0 && (
        <div className="space-y-1 text-xs leading-relaxed text-carvao-muted" data-valores-continuidade="">
          <p>
            {tx(
              // i18n: dado (forma portuguesa do tx)
              `DEC apurado e limite: ${dados.map((d) => `${d.rotulo}, ${d.dec === null ? "sem dado" : `${num(d.dec, 2)} h`} e ${d.dec_limite === null ? "sem limite" : `${num(d.dec_limite, 2)} h`}`).join("; ")}.`,
              `Measured DEC and limit: ${dados.map((d) => `${d.rotulo}, ${d.dec === null ? "no data" : `${num(d.dec, 2)} h`} and ${d.dec_limite === null ? "no limit" : `${num(d.dec_limite, 2)} h`}`).join("; ")}.`,
            )}
          </p>
          <p>
            {tx(
              // i18n: dado (forma portuguesa do tx)
              `FEC apurado e limite: ${dados.map((d) => `${d.rotulo}, ${d.fec === null ? "sem dado" : num(d.fec, 2)} e ${d.fec_limite === null ? "sem limite" : num(d.fec_limite, 2)} interrupções`).join("; ")}.`,
              `Measured FEC and limit: ${dados.map((d) => `${d.rotulo}, ${d.fec === null ? "no data" : num(d.fec, 2)} and ${d.fec_limite === null ? "no limit" : num(d.fec_limite, 2)} interruptions`).join("; ")}.`,
            )}
          </p>
        </div>
      )}
      {dados.length > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {dados.map((d) => (
            <li key={d.id}>
              <Link href={rotaEntidade(d.id)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                {tx(<>Ficha de {nomeDe(d.id)}</>, <>Profile of <Nome>{nomeDe(d.id)}</Nome></>)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type EmpresasIndiceProps = Props & {
  linhas: LinhaTabela[];
  fonte: string;
  versao: string;
};

export function EmpresasIndiceDistribuidoras({ entidades, padrao, linhas, fonte, versao }: EmpresasIndiceProps) {
  const tx = useTx();
  const { num, pct } = formatos(useIdioma());
  const esquema = useEsquema({ entidades, padrao });
  const [v, definir] = useEstadoUrl(esquema);
  const escolhida = v.f ? linhas.find((l) => l.id === v.f) : undefined;
  const naComparacao = !!escolhida && v.cmp.includes(String(escolhida.id));

  return (
    <div className="space-y-4">
      <TabelaInterativa
        titulo={tx("Índice das distribuidoras: identidade, números de referência e controle", "Index of distribution utilities: identity, reference figures and control")}
        colunas={COLUNAS_DISTRIBUIDORAS}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="sigla"
        fonte={fonte}
        versao={versao}
        nomeArquivo="empresas-distribuidoras"
        chaveUrl="dist.tab"
        ordemInicial={{ coluna: "sigla", direcao: "asc" }}
        selecionado={v.f || null}
        onSelecionar={(id) => definir({ f: id ?? "" })}
        dicaBusca={tx("Sigla, razão social, CNPJ ou UF", "Acronym, legal name, CNPJ or state")}
        nota={tx(
          "Escolha uma linha para ver o resumo e abrir a ficha completa. Ausência é ausência na base de origem (a distribuidora não aparece nela ou não tem o ano de referência), nunca zero.",
          "Choose a row to see the summary and open the full profile. A missing value is missing in the source database (the distribution utility does not appear in it or lacks the reference year), never zero.",
        )}
      />

      {escolhida && (
        <div aria-live="polite" className="space-y-2 border border-energia bg-energia-fundo px-4 py-3 text-sm text-carvao">
          <p className="font-medium">
            <Nome>{String(escolhida.sigla)}</Nome> · <Nome>{String(escolhida.nome ?? "")}</Nome>
          </p>
          <p className="text-carvao-muted">
            {tx(
              <>
                Perdas {escolhida.perdas_pct === null ? "sem dado" : pct(escolhida.perdas_pct as number, 2)} · DEC {escolhida.dec === null ? "sem dado" : `${num(escolhida.dec as number, 2)} h`} · FEC{" "}
                {escolhida.fec === null ? "sem dado" : num(escolhida.fec as number, 2)} · tarifa B1 {escolhida.tarifa === null ? "sem tarifa vigente" : `R$ ${num(escolhida.tarifa as number, 2)}/MWh`}
              </>,
              <>
                Losses {escolhida.perdas_pct === null ? "no data" : pct(escolhida.perdas_pct as number, 2)} · DEC {escolhida.dec === null ? "no data" : `${num(escolhida.dec as number, 2)} h`} · FEC{" "}
                {escolhida.fec === null ? "no data" : num(escolhida.fec as number, 2)} · B1 tariff {escolhida.tarifa === null ? "no tariff in force" : `R$ ${num(escolhida.tarifa as number, 2)}/MWh`}
              </>,
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-5">
            <Link href={rotaEntidade(String(escolhida.id))} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
              {tx(<>Abrir a ficha completa de {String(escolhida.sigla)}</>, <>Open the full profile of <Nome>{String(escolhida.sigla)}</Nome></>)}
            </Link>
            {naComparacao ? (
              <span className="text-carvao-muted">
                {tx(<>{String(escolhida.sigla)} está na comparação, no alto da página.</>, <><Nome>{String(escolhida.sigla)}</Nome> is in the comparison, at the top of the page.</>)}
              </span>
            ) : v.cmp.length < LIMITE_COMPARACAO ? (
              <button
                type="button"
                onClick={() => definir({ cmp: [...v.cmp, String(escolhida.id)] })}
                className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao"
              >
                {tx("Incluir na comparação", "Add to the comparison")}
              </button>
            ) : (
              <span className="text-carvao-muted">
                {tx(
                  <>A comparação já tem {LIMITE_COMPARACAO} distribuidoras; retire uma para incluir esta.</>,
                  <>The comparison already has {LIMITE_COMPARACAO} distribution utilities; remove one to add this one.</>,
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
