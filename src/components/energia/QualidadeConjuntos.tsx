"use client";

import { useEffect, useMemo, useState } from "react";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { COLUNAS_CONJUNTOS, arquivoConjuntosDoAno, carregarUmaVez, conjuntosDoCsv } from "@/lib/energia/qualidade";
import type { LinhaTabela } from "@/lib/energia/tabela";

/**
 * Explorador dos conjuntos elétricos (P051 e P052): DEC, FEC, limites e razões de todos
 * os conjuntos com 12 meses num ano, com busca, filtros, ordem e exportação do recorte.
 * Os conjuntos (3 mil por ano) não cabem na página: as linhas vêm do mesmo CSV anual por
 * década que está nos downloads, buscado só quando a pessoa pede (o arquivo de 2000 a 2009
 * tem cerca de 5 MB). O ano fica em `?cano=`; voltar e avançar trocam o ano.
 */
export function QualidadeConjuntos({ anoInicial, anoFinal, tamanhos, fonte }: { anoInicial: number; anoFinal: number; tamanhos: Record<string, string>; fonte: string }) {
  const esquema = useMemo(() => ({ ano: campo(tiposUrl.inteiro({ min: anoInicial, max: anoFinal }), anoFinal, { param: "cano" }) }), [anoInicial, anoFinal]);
  const [v, definir] = useEstadoUrl(esquema);
  const [pedido, setPedido] = useState(false);
  const [linhas, setLinhas] = useState<LinhaTabela[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const arquivo = arquivoConjuntosDoAno(v.ano);

  // um link com ?cano= ou com o recorte da tabela (tcj.*) já é um pedido explícito
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has("cano") || Array.from(p.keys()).some((k) => k.startsWith("tcj."))) setPedido(true);
  }, []);

  useEffect(() => {
    if (!pedido) return;
    let vivo = true;
    setLinhas(null);
    setErro(null);
    carregarUmaVez(arquivo, (r) => r.text()).then(
      (t) => vivo && setLinhas(conjuntosDoCsv(t, v.ano)),
      (e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [pedido, arquivo, v.ano]);

  const anos: number[] = [];
  for (let a = anoFinal; a >= anoInicial; a--) anos.push(a);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-carvao">
          <span className="rotulo text-mineral">Ano</span>
          <select
            value={v.ano}
            onChange={(e) => definir({ ano: Number(e.target.value) })}
            className="min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
          >
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        {!pedido && (
          <button
            type="button"
            onClick={() => setPedido(true)}
            className="inline-flex min-h-[44px] items-center border border-energia bg-superficie px-3 text-sm text-carvao hover:bg-energia-fundo focus:outline-none focus-visible:ring-2 focus-visible:ring-energia"
          >
            Carregar os conjuntos de {v.ano} ({tamanhos[arquivo] ?? "arquivo anual por década"})
          </button>
        )}
      </div>
      {pedido && !linhas && !erro && (
        <p role="status" className="text-sm text-carvao-muted">
          Carregando os conjuntos de {v.ano}…
        </p>
      )}
      {erro && (
        <p role="alert" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-carvao">
          Não foi possível carregar os conjuntos ({erro}).{" "}
          <a href={arquivo} download className="text-energia-dark underline underline-offset-4">
            Baixar o arquivo do período
          </a>
          .
        </p>
      )}
      {linhas && (
        <TabelaInterativa
          titulo={`Conjuntos elétricos em ${v.ano}`}
          colunas={COLUNAS_CONJUNTOS}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="nome"
          fonte={fonte}
          versao={String(v.ano)}
          nomeArquivo={`qualidade-conjuntos-${v.ano}`}
          chaveUrl="tcj"
          ordemInicial={{ coluna: "razao_dec", direcao: "desc" }}
          dicaBusca="Nome ou código do conjunto, distribuidora"
          semLinhas={`Nenhum conjunto publicado para ${v.ano} no arquivo.`}
          nota="Comparação com o limite em centésimos, como a ANEEL publica: DEC igual ao limite não é transgressão."
        />
      )}
    </div>
  );
}
