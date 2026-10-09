"use client";

import { useEffect, useMemo, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import {
  COLUNAS_CONJUNTOS_MUNICIPIO,
  DEFINICAO_CONJUNTO,
  arquivoConjuntosDoAno,
  carregarUmaVez,
  conjuntosDoCsv,
  conjuntosDoMunicipio,
} from "@/lib/energia/qualidade";
import type { LinhaTabela } from "@/lib/energia/tabela";

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
}) {
  const arquivo = arquivoConjuntosDoAno(ano);
  const [linhasAno, setLinhasAno] = useState<LinhaTabela[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    setErro(null);
    carregarUmaVez(arquivo, (r) => r.text()).then(
      (t) => vivo && setLinhasAno(conjuntosDoCsv(t, ano)),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [arquivo, ano, tentativa]);

  const chave = codigos.join(",");
  const { linhas, semValor } = useMemo(() => (linhasAno ? conjuntosDoMunicipio(linhasAno, codigos) : { linhas: [], semValor: [] as string[] }), [linhasAno, chave]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!codigos.length) return null;
  const n = codigos.length;

  return (
    <div className="space-y-3 border-t border-linha pt-4" data-conjuntos-do-municipio="">
      <h5 className="font-serif text-base text-carvao">
        {n === 1 ? "O conjunto que atende" : `Os ${n.toLocaleString("pt-BR")} conjuntos que atendem`} {municipio}, com o limite de cada um
      </h5>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {DEFINICAO_CONJUNTO} Para saber qual é o seu, procure o nome do conjunto na fatura de energia, junto dos indicadores de continuidade, ou pergunte à distribuidora.
      </p>
      {erro ? (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          Não foi possível carregar os valores dos conjuntos ({erro}).{" "}
          <a href={arquivo} download className="text-energia-dark underline underline-offset-4">
            Baixar o arquivo do período
          </a>
          .{" "}
          <button
            type="button"
            onClick={() => setTentativa((t) => t + 1)}
            className="inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-sm text-carvao hover:border-energia focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
          >
            Tentar de novo
          </button>
        </p>
      ) : !linhasAno ? (
        <p role="status" className="text-sm text-carvao-muted">
          Carregando os valores dos {n === 1 ? "conjunto" : "conjuntos"} ({tamanho ?? "arquivo anual por década"}, o mesmo do explorador de Analisar)…
        </p>
      ) : (
        <>
          {linhas.length > 0 ? (
            <TabelaInterativa
              titulo={`Conjuntos que atendem ${municipio}, ${ano}`}
              colunas={COLUNAS_CONJUNTOS_MUNICIPIO}
              linhas={linhas}
              chaveLinha="id"
              colunaRotulo="nome"
              fonte={fonte}
              versao={String(ano)}
              nomeArquivo={`qualidade-conjuntos-${codigoMunicipio}-${ano}`}
              ordemInicial={{ coluna: "razao_dec", direcao: "desc" }}
              dicaBusca="Nome ou código do conjunto, distribuidora"
              recolher={false}
              nota="Valor e limite do conjunto inteiro, não do município. Comparação com o limite em centésimos, como a ANEEL publica: igual ao limite não é transgressão. FEC com menos de 12 meses não tem razão calculada e fica fora da contagem."
            />
          ) : (
            <p className="text-sm text-carvao-muted">Nenhum dos conjuntos citados para {municipio} tem valor anual publicado em {ano}.</p>
          )}
          {semValor.length > 0 && (
            <p className="text-xs leading-relaxed text-carvao-muted">
              {semValor.length === 1 ? "Um conjunto citado não tem" : `${semValor.length.toLocaleString("pt-BR")} conjuntos citados não têm`} valor anual publicado em {ano} (menos de 12 meses ou sem limite): {semValor.join(", ")}.
            </p>
          )}
          <p className="text-sm">
            <a href="#conjuntos-do-ano" className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
              Ver os conjuntos de todo o país em {ano}, com busca e exportação (Analisar)
            </a>
          </p>
        </>
      )}
    </div>
  );
}
