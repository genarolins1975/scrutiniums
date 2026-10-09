"use client";

import { useMemo } from "react";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { num } from "@/lib/energia/formato";
import { VARIAVEL_D7, type LinhaCoeficiente } from "@/lib/energia/previsoes";
import type { ColunaTabela } from "@/lib/energia/tabela";

/**
 * Ficha de um candidato C2: o coeficiente de uma variável em todos os segmentos
 * (horizonte × submercado) do último ajuste, com a linha em 1 na média dos 7 dias
 * (acima dela a correção amplia o desvio recente), e a tabela com todas as variáveis. A variável mora em `?var=` e o segmento em
 * `?seg=` (barra e linha da tabela sincronizadas; o voltar desfaz).
 */
export function PrevisoesCoeficientes({
  modelo,
  linhas,
  colunas,
  variaveis,
  variavelPadrao,
  fonte,
  versao,
}: {
  modelo: string;
  linhas: LinhaCoeficiente[];
  colunas: ColunaTabela[];
  variaveis: { id: string; rotulo: string }[];
  variavelPadrao: string;
  fonte: string;
  versao: string;
}) {
  const idsVar = useMemo(() => variaveis.map((v) => v.id), [variaveis]);
  const idsSeg = useMemo(() => linhas.map((l) => l.segmento), [linhas]);
  const esquema = useMemo(
    () => ({
      var: campo(tiposUrl.opcao(idsVar), variavelPadrao, { param: "var" }),
      seg: campo(tiposUrl.opcao(idsSeg), "" as string, { param: "seg" }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as chaves resumem as listas
    [idsVar.join(","), idsSeg.join(","), variavelPadrao],
  );
  const [v, definir] = useEstadoUrl(esquema);
  const variavel = variaveis.find((x) => x.id === v.var) ?? variaveis[0];
  const dados = linhas.map((l) => ({ id: l.segmento, rotulo: `${l.horizonte} ${l.sm}`, valor: (l[v.var] as number | null) ?? null }));
  const acima = dados.filter((d) => typeof d.valor === "number" && d.valor > 1);
  const negativos = dados.filter((d) => typeof d.valor === "number" && d.valor < 0);
  const sel = linhas.find((l) => l.segmento === v.seg) ?? null;
  const ehD7 = v.var === VARIAVEL_D7;
  // o registro só diz a unidade do coeficiente e, para a média dos 7 dias, o que passar de 1 quer dizer; nas outras variáveis a frase só descreve o que a barra mostra
  const leituraBarra = `Cada barra mostra o coeficiente estimado de “${variavel?.rotulo ?? v.var}” em um segmento (horizonte e submercado), no último ajuste.${
    ehD7
      ? " Nesta variável, um coeficiente c soma ao B0 c vezes a diferença entre a média dos 7 últimos dias e o B0; acima de 1, a correção passa da própria diferença e amplia o desvio recente."
      : ""
  }`;

  return (
    <div className="space-y-4">
      <label className="flex flex-wrap items-center gap-3 text-sm text-carvao">
        <span className="rotulo text-mineral">Variável</span>
        <select
          value={v.var}
          onChange={(e) => definir({ var: e.currentTarget.value })}
          className="min-h-[44px] max-w-full border border-linha bg-superficie px-2 text-sm text-carvao focus:border-energia"
        >
          {variaveis.map((x) => (
            <option key={x.id} value={x.id}>
              {x.rotulo}
            </option>
          ))}
        </select>
      </label>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao" aria-live="polite" data-texto-variavel={v.var}>
        {`${variavel?.rotulo ?? v.var} no ${modelo}: ${dados.length} segmentos ajustados; ${
          acima.length ? `acima de 1 em ${acima.map((d) => `${d.rotulo} (${num(d.valor as number, 2)})`).join(", ")}` : "nenhum acima de 1"
        }; ${negativos.length ? `negativo em ${negativos.length}` : "nenhum negativo"}.`}
        {sel ? ` Segmento escolhido, ${sel.horizonte} ${sel.sm}: λ ${sel.lambda}, ${sel.entregas_treino ?? "sem contagem de"} entregas de treino.` : ""}
      </p>
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-leitura-coeficiente={v.var}>
        {leituraBarra}
      </p>
      <GraficoBarras
        titulo={`${variavel?.rotulo ?? v.var}: coeficiente do ${modelo} por segmento, último ajuste`}
        dados={dados}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={[{ id: "valor", rotulo: "coeficiente", cor: "var(--serie-1)" }]}
        unidade="coeficiente"
        casas={2}
        orientacao="horizontal"
        rotulosValor
        referencias={ehD7 ? [{ valor: 1, rotulo: "1: acima disso, a correção amplia o desvio recente" }] : []}
        selecionado={v.seg || null}
        onSelecionar={(id) => definir({ seg: id && id !== v.seg ? id : "" })}
        alturaMaxima={560}
      />
      <TabelaInterativa
        titulo={`Coeficientes do último ajuste do ${modelo}`}
        colunas={colunas}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="horizonte"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`previsoes-pld-coeficientes-${modelo.toLowerCase()}`}
        chaveUrl="coef"
        selecionado={sel?.id ?? null}
        onSelecionar={(id) => definir({ seg: linhas.find((l) => l.id === id)?.segmento ?? "" })}
        dicaBusca="Horizonte ou submercado"
      />
    </div>
  );
}
