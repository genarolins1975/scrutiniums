"use client";

import { useEffect, useMemo, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import {
  arquivoConjuntosDoAno,
  colunasConjuntosMunicipio,
  definicaoConjunto,
  carregarUmaVez,
  conjuntosDoCsv,
  conjuntosDoMunicipio,
  textoMesesIncompletos,
} from "@/lib/energia/qualidade";
import type { LinhaTabela } from "@/lib/energia/tabela";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { Nome } from "@/components/i18n/Nome";

/**
 * Ficha do município (mapa): os conjuntos elétricos que atendem o município escolhido, cada um com DEC, FEC, o limite do próprio conjunto e a
 * razão, no ano do mapa. É a resposta de quem quer saber "como está o meu conjunto": em vez de uma lista de códigos para procurar noutra
 * tabela, as linhas já vêm com os valores. Elas saem do mesmo CSV anual por década que o explorador de conjuntos lê (um download só, em
 * cache para o explorador de Analisar), buscado quando o município é escolhido. O valor é do conjunto inteiro, nunca do município.
 */
export function QualidadeConjuntosDoMunicipio({
  ano,
  codigoMunicipio,
  municipio,
  codigos,
  fonte,
  tamanho,
  nivelTitulo = 5,
}: {
  ano: number;
  /** Código IBGE do município (nome estável do arquivo exportado). */
  codigoMunicipio: string;
  municipio: string;
  /** Códigos dos conjuntos que a base da ANEEL cita para o município. */
  codigos: string[];
  fonte: string;
  /** Tamanho do arquivo anual (dito antes de baixar). */
  tamanho?: string;
  /** Nível do título: 3 na resposta do alto da página, logo abaixo do título do município. */
  nivelTitulo?: 3 | 4 | 5;
}) {
  const arquivo = arquivoConjuntosDoAno(ano);
  const idioma = useIdioma();
  const tx = useTx();
  const [linhasAno, setLinhasAno] = useState<LinhaTabela[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setErro(null);
    carregarUmaVez(arquivo, (r) => r.text()).then(
      (t) => vivo && setLinhasAno(conjuntosDoCsv(t, ano, idioma)),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [arquivo, ano, tentativa, idioma]);

  const chave = codigos.join(",");
  const { linhas, semValor } = useMemo(() => (linhasAno ? conjuntosDoMunicipio(linhasAno, codigos) : { linhas: [], semValor: [] as string[] }), [linhasAno, chave]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!codigos.length) return null;
  const n = codigos.length;
  const Titulo = `h${nivelTitulo}` as const;

  return (
    <div className="space-y-3 border-t border-linha pt-4" data-conjuntos-do-municipio="">
      <Titulo className="font-serif text-base text-carvao">
        {tx(
          <>
            {n === 1 ? "O conjunto que atende" : `Os ${n.toLocaleString("pt-BR")} conjuntos que atendem`} {municipio}, com o limite de cada um
          </>,
          <>
            {n === 1 ? "The consumer set that serves" : `The ${n.toLocaleString("en-US")} consumer sets that serve`} <Nome>{municipio}</Nome>, with the limit of each one
          </>,
        )}
      </Titulo>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {definicaoConjunto(idioma)}{" "}
        {tx(
          "Para saber qual é o seu, procure o nome do conjunto na fatura de energia, junto dos indicadores de continuidade, ou pergunte à distribuidora.",
          "To learn which one is yours, look for the consumer set name on your electricity bill, next to the continuity indicators, or ask the distribution utility.",
        )}
      </p>
      {erro ? (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          {tx(<>Não foi possível carregar os valores dos conjuntos ({erro}).</>, <>The values of the consumer sets could not be loaded ({erro}).</>)}{" "}
          <a href={arquivo} download className="text-energia-dark underline underline-offset-4">
            {tx("Baixar o arquivo do período", "Download the file for the period")}
          </a>
          .{" "}
          <button
            type="button"
            onClick={() => setTentativa((t) => t + 1)}
            className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
          >
            {tx("Tentar de novo", "Try again")}
          </button>
        </p>
      ) : !linhasAno ? (
        <p role="status" className="text-sm text-carvao-muted">
          {tx(
            <>
              Carregando os valores dos {n === 1 ? "conjunto" : "conjuntos"} ({tamanho ?? "arquivo anual por década"}, o mesmo do explorador de Analisar)…
            </>,
            <>
              Loading the values of the {n === 1 ? "consumer set" : "consumer sets"} ({tamanho ?? "annual file by decade"}, the same as the Analyse explorer)…
            </>,
          )}
        </p>
      ) : (
        <>
          {linhas.length > 0 ? (
            <TabelaInterativa
              titulo={tx(`Conjuntos que atendem ${municipio}, ${ano}`, `Consumer sets serving ${municipio}, ${ano}`)}
              colunas={colunasConjuntosMunicipio(idioma)}
              linhas={linhas}
              chaveLinha="id"
              colunaRotulo="nome"
              fonte={fonte}
              versao={String(ano)}
              nomeArquivo={`qualidade-conjuntos-${codigoMunicipio}-${ano}`}
              ordemInicial={{ coluna: "razao_dec", direcao: "desc" }}
              dicaBusca={tx("Nome ou código do conjunto, distribuidora", "Name or code of the consumer set, distribution utility")}
              recolher={false}
              nota={tx(
                "Valor e limite do conjunto inteiro, não do município. Comparação com o limite em centésimos, como a ANEEL publica: igual ao limite não é transgressão. Conjunto com menos de 12 meses publicados mostra a soma dos meses que existem, sem razão nem comparação com o limite.",
                "Value and limit of the whole consumer set, not of the municipality. Comparison with the limit in hundredths, as ANEEL publishes it: equal to the limit is not a violation. A cluster with fewer than 12 months published shows the sum of the existing months, with no ratio and no comparison with the limit.",
              )}
            />
          ) : (
            <p className="text-sm text-carvao-muted">
              {tx(
                <>
                  Nenhum dos conjuntos citados para {municipio} tem valor anual publicado em {ano}.
                </>,
                <>
                  None of the consumer sets listed for <Nome>{municipio}</Nome> has an annual value published in {ano}.
                </>,
              )}
            </p>
          )}
          {textoMesesIncompletos(linhas, idioma) && (
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-texto="meses-incompletos">
              {textoMesesIncompletos(linhas, idioma)}
            </p>
          )}
          {semValor.length > 0 && (
            <p className="text-sm leading-relaxed text-carvao-muted">
              {tx(
                <>
                  {semValor.length === 1 ? "Um conjunto citado não tem" : `${semValor.length.toLocaleString("pt-BR")} conjuntos citados não têm`} valor anual publicado em {ano} (menos de 12 meses ou sem limite): {semValor.join(", ")}.
                </>,
                <>
                  {semValor.length === 1 ? "One listed consumer set has" : `${semValor.length.toLocaleString("en-US")} listed consumer sets have`} no annual value published in {ano} (fewer than 12 months or no limit): {semValor.join(", ")}.
                </>,
              )}
            </p>
          )}
          <p className="text-sm">
            <a href="#conjuntos-do-ano" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              {tx(<>Ver os conjuntos de todo o país em {ano}, com busca e exportação (Analisar)</>, <>See the consumer sets of the whole country in {ano}, with search and export (Analyse)</>)}
            </a>
          </p>
        </>
      )}
    </div>
  );
}
