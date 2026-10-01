"use client";

import { useMemo, type ReactNode } from "react";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, reais } from "@/lib/energia/formato";
import { CAMPOS_LIMITE, COLUNAS_LIMITES, COR_LIMITE, NOME_LIMITE, SERIES_LIMITES, type LinhaLimites } from "@/lib/energia/regulacao";

/**
 * P044, limites do PLD por ano: gráfico de barras agrupadas (piso, teto estrutural e
 * teto horário de cada ano, todas a partir do zero), a tabela de vigências com as
 * mesmas linhas (publicação no DOU e vigência em colunas distintas) e o detalhe do
 * ano escolhido. O ano mora em `?ano=` (clicar na barra, na linha da tabela ou no
 * seletor muda os três; o voltar desfaz); sem ano no link vale o ano da data de
 * referência da gold. A comparação de até quatro anos mora em `?anos=`.
 *
 * A resposta e o detalhe de cada ano chegam prontos do servidor (respostaLimites e o
 * bloco dos atos): este componente só escolhe qual mostrar, sem refazer conta.
 */
export function RegulacaoLimites({
  linhas,
  anoPadrao,
  respostas,
  detalhes,
  fonte,
  versao,
}: {
  linhas: LinhaLimites[];
  anoPadrao: string;
  respostas: Record<string, string>;
  detalhes: Record<string, ReactNode>;
  fonte: string;
  versao: string;
}) {
  const anos = useMemo(() => linhas.map((l) => l.id), [linhas]);
  const esquema = useMemo(() => ({ ano: campo(tiposUrl.opcao(anos), anoPadrao, { param: "ano" }) }), [anos.join(","), anoPadrao]); // eslint-disable-line react-hooks/exhaustive-deps
  const [v, definir] = useEstadoUrl(esquema);
  const ano = v.ano;
  const selecionar = (id: string | null) => definir({ ano: id ?? anoPadrao });
  const porId = useMemo(() => new Map(linhas.map((l) => [l.id, l])), [linhas]);
  const entidades = useMemo(() => linhas.map((l) => ({ id: l.id, rotulo: l.rotulo, detalhe: `vigência de ${dataBR(l.inicio)} a ${dataBR(l.fim)}` })), [linhas]);
  const padraoComparacao = useMemo(() => (anos.length > 1 ? [anos[0], anos[anos.length - 1]] : anos), [anos]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="flex flex-wrap items-center gap-3 text-sm text-carvao">
          <span className="rotulo text-mineral">Ano</span>
          <select
            value={ano}
            onChange={(e) => selecionar(e.currentTarget.value)}
            className="min-h-[44px] border border-linha bg-superficie px-2 text-sm text-carvao focus:border-energia"
          >
            {linhas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.rotulo}
              </option>
            ))}
          </select>
        </label>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao" aria-live="polite" data-resposta-ano={ano}>
          {ano === anoPadrao ? "Ano da data de referência: os limites dele estão na resposta acima; escolha outro ano para comparar." : respostas[ano]}
        </p>
      </div>

      <GraficoBarras
        titulo="Piso, teto estrutural e teto horário do PLD por ano"
        dados={linhas}
        chaveCategoria="id"
        chaveRotulo="rotulo"
        series={SERIES_LIMITES}
        unidade="R$/MWh"
        casas={2}
        selecionado={ano}
        onSelecionar={(id) => id && selecionar(id)}
        altura={320}
      />

      <TabelaInterativa
        titulo="Tabela de vigências dos limites do PLD"
        colunas={COLUNAS_LIMITES}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo="regulacao-limites-pld-vigencias"
        chaveUrl="lim"
        selecionado={ano}
        onSelecionar={(id) => id && selecionar(id)}
        nota="Publicação no Diário Oficial e início de vigência são colunas distintas. Data de publicação vazia quer dizer que o extrato do ato não pôde ser lido; nunca é a data de captura."
      />

      <section aria-labelledby="detalhe-ano-titulo" className="space-y-3 border-t border-linha pt-4" data-detalhe-ano={ano}>
        <h3 id="detalhe-ano-titulo" className="font-serif text-lg text-carvao">
          Atos de {porId.get(ano)?.rotulo ?? ano}: o que cada um fixou, quando saiu e desde quando vale
        </h3>
        {detalhes[ano]}
      </section>

      <section data-nivel="analisar" aria-labelledby="comparar-anos-titulo" className="space-y-3 border-t border-linha pt-5">
        <h3 id="comparar-anos-titulo" className="font-serif text-lg text-carvao">
          Comparar até quatro anos na mesma escala
        </h3>
        <p className="max-w-prose2 text-sm text-carvao-muted">
          Valores nominais, como escritos nos atos. Os tetos de cada ano são o teto do ano anterior atualizado pela inflação (IPCA), por isso a diferença entre anos não
          é aumento real; o piso segue a tarifa de otimização das hidrelétricas e pode cair.
        </p>
        <Comparador
          rotulo="Anos para comparar (até 4)"
          entidades={entidades}
          padrao={padraoComparacao}
          chaveUrl="anos"
          valores={(id) => CAMPOS_LIMITE.map((c) => porId.get(id)?.[c] ?? null)}
          zeroNaEscala
          unidade="R$/MWh"
          dicaBusca="Digite o ano"
          vazio="Nenhum ano escolhido. Escolha até quatro para comparar os três limites lado a lado."
          renderizarItem={(e, ctx) => {
            const l = porId.get(e.id);
            const d = ctx.dominio;
            const largura = (val: number | null) => (val === null || !d || d.max === d.min ? 0 : Math.max(0, Math.min(100, (100 * (val - d.min)) / (d.max - d.min))));
            return (
              <figure className="border border-linha bg-superficie p-3" data-comparacao-ano={e.id}>
                <figcaption className="font-serif text-base text-carvao">{e.rotulo}</figcaption>
                <dl className="mt-2 space-y-2">
                  {CAMPOS_LIMITE.map((c) => {
                    const val = l?.[c] ?? null;
                    return (
                      <div key={c}>
                        <dt className="flex justify-between gap-2 text-xs text-carvao-muted">
                          <span>{NOME_LIMITE[c]}</span>
                          <span className="tabular-nums text-carvao">{val === null ? "sem valor" : `${reais(val, 2)}/MWh`}</span>
                        </dt>
                        <dd className="mt-0.5 h-3 w-full bg-papel" aria-hidden="true">
                          {val === null ? (
                            <span
                              className="block h-3 w-4 border border-mineral"
                              style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--cor-mineral) 0 1px, transparent 1px 4px)" }}
                            />
                          ) : (
                            <span className="block h-3" style={{ width: `${largura(val)}%`, background: COR_LIMITE[c] }} />
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <p className="mt-2 text-xs text-carvao-muted">
                  Piso: {l?.ato_pld_min ?? "sem ato"}. Tetos: {l?.ato_tetos ?? "sem ato"}.
                </p>
              </figure>
            );
          }}
        />
      </section>
    </div>
  );
}
