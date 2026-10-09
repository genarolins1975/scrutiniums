"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { ContaEscolha, ContaLista, type OpcaoConta } from "@/components/energia/ContaControles";
import { ContaReferencias } from "@/components/energia/ContaReferencias";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
import {
  CAMPO_DIST,
  CAMPO_PERFIL,
  COLUNAS_RANKING,
  destacar,
  destaquesDoPerfil,
  linhasRanking,
  referenciasDoPerfil,
  remover,
  respostaTarifa,
  rotuloDistribuidora,
  vereditoTarifa,
  type Perfil,
} from "@/lib/energia/conta";
import type { ResumoTarifas, TarifaVigente } from "@/lib/energia/tipos-conta";

/**
 * P047, "Quanto custa um perfil comparável?": o mesmo consumo em cada distribuidora, pela tarifa B1 residencial de aplicação vigente.
 * Três leituras do MESMO número publicado, todas para o perfil escolhido: as três referências (menor, mediana e maior, com a faixa
 * do 1º ao 3º quartil), o ranking de todas as distribuidoras (custo do perfil em R$/mês ou tarifa TE + TUSD em R$/MWh, empilhada
 * nas duas parcelas) e a tabela equivalente. Perfil e leitura ficam na URL, e a faixa de métricas da abertura lê o mesmo
 * `?perfil=`; a distribuidora escolhida (?dist=) acende a barra, a linha da tabela, o losango da figura das referências e os outros
 * painéis da página. A tabela recebe as mesmas linhas do gráfico, então o que se exporta é o que se vê.
 */

const ESQUEMA = {
  dist: CAMPO_DIST,
  perfil: CAMPO_PERFIL,
  leitura: campo(tiposUrl.opcao(["perfil", "tarifa"] as const), "perfil", {
    param: "leitura",
  }),
};

const OPCOES_PERFIL: OpcaoConta<"100" | "200" | "300">[] = (["100", "200", "300"] as const).map((p) => ({ id: p, rotulo: `${p} kWh/mês` }));
const OPCOES_LEITURA: OpcaoConta<"perfil" | "tarifa">[] = [
  { id: "perfil", rotulo: "Custo do perfil (R$/mês)" },
  { id: "tarifa", rotulo: "Tarifa TE + TUSD (R$/MWh)" },
];

export type ContaTarifasProps = {
  vigentes: TarifaVigente[];
  resumo: ResumoTarifas;
  dataReferencia: string;
  fonte: string;
  /** Período, universo e unidade do painel, logo depois das figuras. */
  recorte?: ReactNode;
  /** Notas do painel (NotasDoPainel), depois das figuras e antes da tabela. */
  notas?: ReactNode;
};

export function ContaTarifas({ vigentes, resumo, dataReferencia, fonte, recorte, notas }: ContaTarifasProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const perfil = Number(v.perfil) as Perfil;
  const linhas = useMemo(() => linhasRanking(vigentes, perfil), [vigentes, perfil]);
  const referencias = useMemo(() => referenciasDoPerfil(vigentes, resumo, perfil), [vigentes, resumo, perfil]);
  const destaque = v.dist[0] ?? null;
  const naRanking = destaque !== null && linhas.some((l) => l.id === destaque);
  const destaques = useMemo(() => destaquesDoPerfil(vigentes, resumo, perfil, v.dist), [vigentes, resumo, perfil, v.dist]);
  const selecionar = (id: string | null) => {
    if (id) definir({ dist: destacar(v.dist, id) });
    else if (destaque) definir({ dist: remover(v.dist, destaque) });
  };
  const resposta = respostaTarifa(dataReferencia, resumo, vigentes, perfil);
  const chavePerfil = String(perfil) as "100" | "200" | "300";
  // distribuidoras por ordem alfabética: quem procura a sua pelo nome não precisa percorrer o ranking de 81 barras
  const opcoesDistribuidora = useMemo<OpcaoConta<string>[]>(
    () => [
      { id: "", rotulo: "Nenhuma" },
      ...vigentes
        .map((x) => ({ id: x.cnpj, rotulo: rotuloDistribuidora(x.sigla, x.cnpj) }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    ],
    [vigentes],
  );

  // a lista do ranking mostra só parte das barras (rola dentro da caixa): ao escolher a distribuidora pelo seletor, a barra dela entra
  // na parte visível da lista, sem mover a página
  const ranking = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!naRanking || !destaque) return;
    const area = ranking.current?.querySelector<HTMLElement>("[data-rolagem]");
    const barra = area?.querySelector<SVGGElement>(`g[data-id="${destaque}"]`);
    if (!area || !barra) return;
    const a = area.getBoundingClientRect();
    const b = barra.getBoundingClientRect();
    if (b.top < a.top || b.bottom > a.bottom) area.scrollTop += b.top - a.top - (a.height - b.height) / 2;
  }, [destaque, naRanking, v.leitura]);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p047" vivo veredito={vereditoTarifa(dataReferencia, resumo, vigentes, perfil)}>
          {resposta}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <ContaEscolha legenda="Perfil de consumo" opcoes={OPCOES_PERFIL} valor={v.perfil} onEscolher={(p) => definir({ perfil: p })} />
          <ContaLista rotulo="Distribuidora em destaque" opcoes={opcoesDistribuidora} valor={naRanking && destaque ? destaque : ""} onEscolher={(id) => selecionar(id || null)} />
        </div>
      </div>

      <ContaReferencias referencias={referencias} destaques={destaques} />

      <div ref={ranking}>
        <SecaoDoPainel id="ranking" titulo="Todas as distribuidoras, da mais barata à mais cara">
          <ContaEscolha legenda="Leitura do ranking" opcoes={OPCOES_LEITURA} valor={v.leitura} onEscolher={(l) => definir({ leitura: l })} />

          <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="ordem-ranking">
            A lista começa pela distribuidora mais barata e segue até a mais cara ({linhas.length} no total): as primeiras barras são as menores, e a escala do gráfico vai até a maior de todas. Role a lista ou use
            &quot;Mostrar todas&quot; para ver as mais caras.
          </p>

          {v.leitura === "perfil" ? (
            <GraficoBarras
              titulo={`Custo de ${perfil} kWh/mês pela tarifa B1 residencial, por distribuidora (sem tributos e sem bandeira)`}
              dados={linhas}
              chaveCategoria="id"
              chaveRotulo="sigla"
              series={[
                {
                  id: "custo",
                  rotulo: `Custo de ${perfil} kWh`,
                  cor: "var(--cor-energia)",
                },
              ]}
              unidade="R$/mês"
              casas={2}
              orientacao="horizontal"
              referencias={[
                {
                  valor: resumo.perfis_mediana[chavePerfil] ?? NaN,
                  rotulo: "Mediana entre distribuidoras",
                },
              ].filter((r) => Number.isFinite(r.valor))}
              selecionado={naRanking ? destaque : null}
              onSelecionar={selecionar}
              alturaCategoria={44}
              alturaMaxima={520}
            />
          ) : (
            <GraficoBarras
              titulo="Tarifa B1 residencial de aplicação por distribuidora: TE e TUSD empilhadas (somam o total)"
              dados={linhas}
              chaveCategoria="id"
              chaveRotulo="sigla"
              series={[
                { id: "te", rotulo: "TE (energia)", cor: "var(--serie-comp-1)" },
                {
                  id: "tusd",
                  rotulo: "TUSD (uso da rede)",
                  cor: "var(--serie-solar)",
                },
              ]}
              empilhado
              unidade="R$/MWh"
              casas={2}
              orientacao="horizontal"
              referencias={[
                { valor: resumo.p25 ?? NaN, rotulo: "1º quartil" },
                { valor: resumo.mediana ?? NaN, rotulo: "Mediana" },
                { valor: resumo.p75 ?? NaN, rotulo: "3º quartil" },
              ].filter((r) => Number.isFinite(r.valor))}
              selecionado={naRanking ? destaque : null}
              onSelecionar={selecionar}
              alturaCategoria={44}
              alturaMaxima={520}
            />
          )}

          {destaque && !naRanking && (
            <p className="text-sm text-carvao-muted" role="status">
              A distribuidora escolhida não tem tarifa B1 vigente em {dataBR(dataReferencia)} e não entra no ranking; o histórico dela aparece no modo Analisar e o motivo,
              na lista de distribuidoras sem tarifa vigente do modo Auditar.
            </p>
          )}
        </SecaoDoPainel>
      </div>

      {recorte}
      {notas}

      <TabelaInterativa
        titulo="Tarifas B1 residenciais vigentes e custo por perfil"
        colunas={COLUNAS_RANKING}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="sigla"
        fonte={fonte}
        versao={dataReferencia}
        nomeArquivo="conta-tarifas-b1-vigentes"
        chaveUrl="tar"
        ordemInicial={{ coluna: "posicao", direcao: "asc" }}
        selecionado={naRanking ? destaque : null}
        onSelecionar={selecionar}
        dicaBusca="Sigla, razão social ou CNPJ"
        nota="Tarifa de aplicação homologada sem ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira. Base econômica é a tarifa usada no cálculo tarifário, sem os componentes financeiros do processo."
      />
    </div>
  );
}
