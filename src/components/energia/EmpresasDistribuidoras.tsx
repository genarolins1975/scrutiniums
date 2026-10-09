"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { COLUNAS_DISTRIBUIDORAS, avisoAnosComparacao, rotaEntidade, type LinhaComparacao } from "@/lib/energia/empresas";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { num, pct } from "@/lib/energia/formato";
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
  const esquema = useEsquema({ entidades, padrao });
  const [v, definir] = useEstadoUrl(esquema);
  const porId = useMemo(() => new Map(comparacao.map((c) => [c.id, c])), [comparacao]);
  const dados = useMemo(() => v.cmp.map((id) => porId.get(id)).filter((x): x is LinhaComparacao => !!x), [v.cmp, porId]);
  const aviso = avisoAnosComparacao(dados);
  const nomeDe = (id: string) => entidades.find((e) => e.id === id)?.rotulo ?? id;
  const ehPadrao = v.cmp.join(",") === padrao.join(",");
  const anos = (k: "ano_perdas" | "ano_qualidade") => Array.from(new Set(dados.map((d) => d[k]).filter((a): a is number => a !== null))).join(", ") || "sem dado";

  return (
    <div className="space-y-4" id="comparar">
      <Comparador
        rotulo="Distribuidoras comparadas (até 4)"
        entidades={entidades}
        selecionadas={v.cmp}
        onMudar={(ids) => definir({ cmp: ids })}
        dicaBusca="Sigla, nome, CNPJ ou UF"
        vazio="Nenhuma distribuidora escolhida. Escolha aqui ou pelo índice, mais abaixo."
      >
        {() => null}
      </Comparador>
      <p className="text-sm text-carvao-muted">
        {ehPadrao
          ? "Sem escolha no link, entram as quatro distribuidoras ativas com mais unidades consumidoras no ano de referência da continuidade."
          : `Comparando ${dados.map((d) => d.rotulo).join(", ") || "nenhuma"}.`}{" "}
        Perdas de {anos("ano_perdas")}; continuidade de {anos("ano_qualidade")}; tarifa vigente na data das tarifas de aplicação. A regra de pares completa está na ficha de cada uma.
      </p>
      {aviso && (
        <p role="note" className="border-l-2 border-mineral pl-3 text-sm text-carvao">
          {aviso}
        </p>
      )}
      {dados.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <GraficoBarras
            titulo="Perdas totais sobre a energia injetada"
            dados={dados}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "perdas", rotulo: "Perdas totais", cor: "var(--serie-comp-1)" }]}
            unidade="%"
            casas={2}
            orientacao="horizontal"
            rotulosValor
            referencias={referenciaPerdas ? [referenciaPerdas] : []}
          />
          <GraficoBarras
            titulo="Tarifa residencial B1 vigente, sem tributos"
            dados={dados}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "tarifa", rotulo: "Tarifa B1 (TE + TUSD)", cor: "var(--serie-comp-2)" }]}
            unidade="R$/MWh"
            casas={2}
            orientacao="horizontal"
            rotulosValor
          />
          <GraficoPontos
            titulo="DEC apurado diante do limite de cada distribuidora"
            itens={dados.map((d) => ({ id: d.id, rotulo: d.rotulo, valor: d.dec, referencia: d.dec_limite }))}
            unidade="h"
            casas={2}
            rotuloValor="DEC apurado"
            rotuloReferencia="Limite regulatório"
            zeroNoEixo
          />
          <GraficoPontos
            titulo="FEC apurado diante do limite de cada distribuidora"
            itens={dados.map((d) => ({ id: d.id, rotulo: d.rotulo, valor: d.fec, referencia: d.fec_limite }))}
            unidade="interrupções"
            casas={2}
            rotuloValor="FEC apurado"
            rotuloReferencia="Limite regulatório"
            zeroNoEixo
          />
        </div>
      )}
      {dados.length > 0 && (
        <div className="space-y-1 text-xs leading-relaxed text-carvao-muted" data-valores-continuidade="">
          <p>
            DEC apurado e limite: {dados.map((d) => `${d.rotulo}, ${d.dec === null ? "sem dado" : `${num(d.dec, 2)} h`} e ${d.dec_limite === null ? "sem limite" : `${num(d.dec_limite, 2)} h`}`).join("; ")}.
          </p>
          <p>
            FEC apurado e limite: {dados.map((d) => `${d.rotulo}, ${d.fec === null ? "sem dado" : num(d.fec, 2)} e ${d.fec_limite === null ? "sem limite" : num(d.fec_limite, 2)} interrupções`).join("; ")}.
          </p>
        </div>
      )}
      {dados.length > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {dados.map((d) => (
            <li key={d.id}>
              <Link href={rotaEntidade(d.id)} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
                Ficha de {nomeDe(d.id)}
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
  const esquema = useEsquema({ entidades, padrao });
  const [v, definir] = useEstadoUrl(esquema);
  const escolhida = v.f ? linhas.find((l) => l.id === v.f) : undefined;
  const naComparacao = !!escolhida && v.cmp.includes(String(escolhida.id));

  return (
    <div className="space-y-4">
      <TabelaInterativa
        titulo="Índice das distribuidoras: identidade, números de referência e controle"
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
        dicaBusca="Sigla, razão social, CNPJ ou UF"
        nota="Escolha uma linha para ver o resumo e abrir a ficha completa. Ausência é ausência na base de origem (a distribuidora não aparece nela ou não tem o ano de referência), nunca zero."
      />

      {escolhida && (
        <div aria-live="polite" className="space-y-2 border border-energia bg-energia-fundo px-4 py-3 text-sm text-carvao">
          <p className="font-medium">
            {String(escolhida.sigla)} · {String(escolhida.nome ?? "")}
          </p>
          <p className="text-carvao-muted">
            Perdas {escolhida.perdas_pct === null ? "sem dado" : pct(escolhida.perdas_pct as number, 2)} · DEC {escolhida.dec === null ? "sem dado" : `${num(escolhida.dec as number, 2)} h`} · FEC{" "}
            {escolhida.fec === null ? "sem dado" : num(escolhida.fec as number, 2)} · tarifa B1 {escolhida.tarifa === null ? "sem tarifa vigente" : `R$ ${num(escolhida.tarifa as number, 2)}/MWh`}
          </p>
          <div className="flex flex-wrap items-center gap-x-5">
            <Link href={rotaEntidade(String(escolhida.id))} className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4 hover:text-carvao">
              Abrir a ficha completa de {String(escolhida.sigla)}
            </Link>
            {naComparacao ? (
              <span className="text-carvao-muted">{String(escolhida.sigla)} está na comparação, no alto da página.</span>
            ) : v.cmp.length < LIMITE_COMPARACAO ? (
              <button
                type="button"
                onClick={() => definir({ cmp: [...v.cmp, String(escolhida.id)] })}
                className="rotulo inline-flex min-h-[44px] items-center text-carvao-muted underline underline-offset-4 hover:text-carvao"
              >
                Incluir na comparação
              </button>
            ) : (
              <span className="text-carvao-muted">A comparação já tem {LIMITE_COMPARACAO} distribuidoras; retire uma para incluir esta.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
