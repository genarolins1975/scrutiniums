"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ContaBuscaMunicipio } from "@/components/energia/ContaBuscaMunicipio";
import { ContaEscolha } from "@/components/energia/ContaControles";
import { ContaPontos, MarcaDaLegenda as Marcador } from "@/components/energia/ContaPontos";
import { ContaSelecionadas } from "@/components/energia/ContaSelecionadas";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno, pct } from "@/lib/energia/formato";
import {
  CAMPO_DIST,
  COLUNAS_JANELA,
  destacar,
  expandirInfo,
  janelasNoMesmoConjunto,
  linhasJanela,
  remover,
  respostaReajustes,
  rotuloDistribuidora,
  textoJanelasNoMesmoConjunto,
  textoUltimaMudanca,
  textoMunicipioReajuste,
  vereditoReajustes,
  type InfoCompacta,
  type MunicipioEncontrado,
} from "@/lib/energia/conta";
import { LIMITE_COMPARACAO, type ColunaTabela } from "@/lib/energia/tabela";
import type { JanelaInflacao, UltimoEvento } from "@/lib/energia/tipos-conta";

/**
 * P050, "A tarifa subiu mais que a inflação?": variação da tarifa B1 residencial de cada distribuidora entre o fim do mês inicial e o
 * fim do mês final de uma janela de 12, 60 ou 120 meses, com o IPCA dos mesmos meses como linha de referência. Distribuidoras sem
 * tarifa numa das datas ou com área alterada por incorporação ficam fora e são listadas. É a variação da tarifa B1 entre duas datas,
 * não o efeito médio do processo tarifário (bloqueado na fonte): o aviso disso fica logo abaixo da resposta.
 *
 * A faixa de pontos mostra todas as distribuidoras da janela de uma vez, com a mediana, o IPCA e as distribuidoras escolhidas; a lista
 * de barras abaixo é a leitura de uma por uma. O cartão da mediana acompanha a janela (a ficha de prova só existe para a de 12 meses,
 * e diz isso nas outras), e a mediana das distribuidoras comuns às três janelas fica ao lado: cada janela tem o seu universo.
 *
 * Janela na URL (?jan=); a distribuidora em destaque (?dist=) é a mesma dos outros painéis.
 */

const ESQUEMA = {
  dist: CAMPO_DIST,
  janela: campo(tiposUrl.opcao(["12", "60", "120"] as const), "12", {
    param: "jan",
  }),
};

const COLUNAS_ULTIMOS: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "data", rotulo: "Data da última mudança", tipo: "data" },
  { id: "ato", rotulo: "Ato da ANEEL", tipo: "texto", literal: { classe: "ato-retificacao-sem-numero", origem: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica" } },
  {
    id: "variacao",
    rotulo: "Variação da tarifa B1",
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "ipca",
    rotulo: "IPCA desde a mudança anterior",
    tipo: "percentual",
    casas: 2,
  },
  { id: "meses", rotulo: "Meses do IPCA", tipo: "texto" },
  { id: "perimetro", rotulo: "Mudança de perímetro (ato)", tipo: "texto" },
];

export type ContaReajustesProps = {
  janelas: JanelaInflacao[];
  ultimos: UltimoEvento[];
  dataReferencia: string;
  fonte: string;
  /** UF de cada distribuidora: o nome na lista e na faixa de pontos leva a UF (`compactarInfo`). */
  info: InfoCompacta;
  /** Ficha "Comprove este número" da mediana de 12 meses, a única que a gold publica. */
  evidencia: Evidencia | null;
  /** Página e âncora do cartão da mediana, para a citação. */
  endereco: string;
  /** Aviso do efeito médio do processo tarifário, no ponto de uso: logo abaixo da resposta. */
  aviso?: ReactNode;
};

export function ContaReajustes({ janelas, ultimos, dataReferencia, fonte, info: infoCompacta, evidencia, endereco, aviso }: ContaReajustesProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const info = useMemo(() => expandirInfo(infoCompacta), [infoCompacta]);
  const janela = janelas.find((j) => String(j.meses) === v.janela) ?? janelas[0];
  const linhas = useMemo(() => (janela ? linhasJanela(janela) : []), [janela]);
  const comuns = useMemo(() => janelasNoMesmoConjunto(janelas), [janelas]);
  const [aviso1, setAviso1] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState<string | null>(null);
  const destaque = v.dist.find((id) => linhas.some((l) => l.id === id)) ?? null;
  const rotulo = (id: string) => {
    const l = linhas.find((x) => x.id === id);
    return l ? l.sigla : rotuloDistribuidora(null, id);
  };
  const selecionar = (id: string | null) => {
    if (id) {
      // o limite de quatro descarta a escolha mais antiga: o aviso diz qual saiu
      const descartada = !v.dist.includes(id) && v.dist.length >= LIMITE_COMPARACAO ? v.dist[LIMITE_COMPARACAO - 1] : null;
      setAviso1(descartada ? `O limite é de ${LIMITE_COMPARACAO} distribuidoras: ${rotulo(descartada)} saiu da seleção para entrar ${rotulo(id)}.` : null);
      definir({ dist: destacar(v.dist, id) });
    } else if (destaque) {
      setAviso1(null);
      definir({ dist: remover(v.dist, destaque) });
    }
  };
  const escolherMunicipio = (m: MunicipioEncontrado) => {
    if (!janela) return;
    const validos = m.vinculos.filter((x) => x.estado !== 0);
    const usados = (validos.length ? validos : m.vinculos).map((x) => x.cnpj).filter((c) => linhas.some((l) => l.id === c));
    setAviso1(null);
    setMunicipio(textoMunicipioReajuste(m, linhas, janela));
    if (usados.length) definir({ dist: usados.slice(0, LIMITE_COMPARACAO) });
  };
  // a lista mostra só parte das barras (rola dentro da caixa): a distribuidora que veio do link ou da outra página entra na parte visível
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!destaque) return;
    const area = lista.current?.querySelector<HTMLElement>("[data-rolagem]");
    const barra = area?.querySelector<SVGGElement>(`g[data-id="${destaque}"]`);
    if (!area || !barra) return;
    const a = area.getBoundingClientRect();
    const b = barra.getBoundingClientRect();
    if (b.top < a.top || b.bottom > a.bottom) area.scrollTop += b.top - a.top - (a.height - b.height) / 2;
  }, [destaque, v.janela]);
  const ultimasLinhas = useMemo(
    () =>
      ultimos.map((u) => ({
        id: u[0],
        sigla: rotuloDistribuidora(u[1], u[0]),
        data: u[2],
        ato: u[3],
        variacao: u[4],
        ipca: u[5],
        meses: `${mesAno(`${u[6]}-01`)} a ${mesAno(`${u[7]}-01`)}`,
        perimetro: u[8],
      })),
    [ultimos],
  );
  const dadosGrafico = useMemo(() => linhas.map((l) => ({ ...l, rotulo: info[l.id]?.uf ? `${l.sigla} · ${info[l.id].uf}` : l.sigla })), [linhas, info]);
  const pontos = useMemo(
    () => linhas.filter((l) => l.variacao !== null).map((l) => ({ id: l.id, valor: l.variacao as number, rotulo: info[l.id]?.uf ? `${l.sigla} (${info[l.id].uf})` : l.sigla })),
    [linhas, info],
  );
  if (!janela) return <p className="text-sm text-carvao-muted">Sem janela de comparação com o IPCA publicada.</p>;

  const refs = [
    ...(janela.ipca_pct !== null
      ? [
          {
            valor: janela.ipca_pct,
            rotulo: `IPCA de ${mesAno(`${janela.ipca_meses[0]}-01`)} a ${mesAno(`${janela.ipca_meses[1]}-01`)}`,
          },
        ]
      : []),
    // a mediana não vira segunda linha tracejada: IPCA e mediana, com o mesmo traço, só se distinguiam pela legenda; ela está na faixa de
    // pontos acima, no cartão da janela e na tabela
  ];
  const marcas = [
    ...(janela.mediana_pct !== null ? [{ valor: janela.mediana_pct, rotulo: `Mediana ${pct(janela.mediana_pct, 2)}`, tipo: "mediana" as const }] : []),
    ...(janela.ipca_pct !== null ? [{ valor: janela.ipca_pct, rotulo: `IPCA ${pct(janela.ipca_pct, 2)}`, tipo: "referencia" as const }] : []),
  ];
  const temFaixa = janela.p25_pct !== null && janela.p75_pct !== null;
  const descricao =
    `Variação da tarifa B1 em ${janela.meses} meses de ${janela.n} distribuidoras, de ${dataBR(janela.de)} a ${dataBR(janela.ate)}: ` +
    `${janela.mediana_pct !== null ? `mediana ${pct(janela.mediana_pct, 2)}, ` : ""}${janela.ipca_pct !== null ? `IPCA ${pct(janela.ipca_pct, 2)}; ` : ""}` +
    `${janela.acima_ipca} acima do IPCA e ${janela.abaixo_ou_igual_ipca} abaixo ou iguais. Cada ponto é uma distribuidora.`;

  return (
    <div className="space-y-5">
      <div className="grid gap-x-10 gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <RespostaCurta id="p050-reajustes" vivo veredito={vereditoReajustes(janela)}>
          {respostaReajustes(janela)}
        </RespostaCurta>
        <ContaEscolha
          emLinha
          legenda="Janela de comparação"
          opcoes={janelas.map((j) => ({ id: String(j.meses) as "12" | "60" | "120", rotulo: `${j.meses} meses` }))}
          valor={v.janela}
          onEscolher={(id) => definir({ janela: id })}
        />
      </div>

      {aviso}

      <div data-grafico-pontos="reajustes">
        <p className="mb-1 text-sm font-medium text-carvao">
          As {janela.n} distribuidoras na janela de {janela.meses} meses<span className="font-normal text-mineral">, variação da tarifa B1 em %</span>
        </p>
        <ContaPontos
          descricao={descricao}
          pontos={pontos}
          faixa={temFaixa ? { de: janela.p25_pct as number, ate: janela.p75_pct as number, rotulo: `Do 1º ao 3º quartil: ${pct(janela.p25_pct, 2)} a ${pct(janela.p75_pct, 2)}` } : null}
          marcas={marcas}
          escolhidos={v.dist.filter((id) => pontos.some((p) => p.id === id))}
          formatar={(x) => pct(x, 2)}
          zeroNoEixo
          aoEscolher={selecionar}
        />
        <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs text-carvao-muted" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <Marcador tipo="ponto" />
            uma distribuidora
          </li>
          <li className="flex items-center gap-1.5">
            <Marcador tipo="extremo" />
            menor e maior variação
          </li>
          <li className="flex items-center gap-1.5">
            <Marcador tipo="mediana" />
            mediana
          </li>
          {janela.ipca_pct !== null && (
            <li className="flex items-center gap-1.5">
              <Marcador tipo="referencia" />
              IPCA do período: à direita da linha, a tarifa subiu mais que a inflação
            </li>
          )}
          {temFaixa && (
            <li className="flex items-center gap-1.5">
              <Marcador tipo="faixa" />
              do 1º ao 3º quartil
            </li>
          )}
          <li className="flex items-center gap-1.5">
            <Marcador tipo="destaque" />
            distribuidora escolhida
          </li>
        </ul>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <ContaBuscaMunicipio aoEscolher={escolherMunicipio} />
            <p className="max-w-prose2 text-sm text-carvao-muted">Não sabe a sua distribuidora? O nome dela está no alto da fatura de luz; a busca pelo município também a acha.</p>
          </div>
          {municipio && (
            <p role="status" className="max-w-prose2 text-sm text-carvao" data-municipio="">
              {municipio}
            </p>
          )}
          <ContaSelecionadas
            ids={v.dist}
            rotulo={rotulo}
            aoTirar={(id) => {
              setAviso1(null);
              definir({ dist: remover(v.dist, id) });
            }}
            aoLimpar={() => {
              setAviso1(null);
              setMunicipio(null);
              definir({ dist: [] });
            }}
            aviso={aviso1}
            limite={LIMITE_COMPARACAO}
          />
          {v.dist.length > 0 && (
            <ul className="max-w-prose2 space-y-1 text-sm leading-relaxed text-carvao" aria-label="Última mudança da tarifa das distribuidoras selecionadas" data-ultima-mudanca="">
              {v.dist.map((id) => {
                const u = ultimos.find((x) => x[0] === id);
                return <li key={id}>{u ? textoUltimaMudanca(u) : `${rotulo(id)}: nenhuma mudança da tarifa B1 no arquivo.`}</li>;
              })}
            </ul>
          )}
        </div>
      </div>

      <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="ordem-ranking">
        A lista começa pelas menores variações e segue até a maior ({linhas.length} no total). As primeiras barras ficam à esquerda do IPCA e da mediana: {janela.abaixo_ou_igual_ipca} distribuidoras
        ficaram abaixo da inflação ou iguais a ela, e {janela.acima_ipca} ficaram acima. Role a lista ou use &quot;Mostrar todas&quot; para ver as que ficaram acima.
      </p>

      <div ref={lista}>
        <GraficoBarras
          titulo={`Variação da tarifa B1 residencial de ${dataBR(janela.de)} a ${dataBR(janela.ate)}, por distribuidora, com o IPCA do período`}
          dados={dadosGrafico}
          chaveCategoria="id"
          chaveRotulo="rotulo"
          series={[
            {
              id: "variacao",
              rotulo: "Variação da tarifa B1",
              cor: "var(--cor-energia)",
            },
          ]}
          unidade="%"
          casas={2}
          orientacao="horizontal"
          referencias={refs}
          selecionado={destaque}
          onSelecionar={selecionar}
          alturaCategoria={44}
          alturaMaxima={520}
          limiteInicial={12}
        />
      </div>

      <div className="grid gap-x-10 gap-y-4 border-t border-linha pt-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <Numero
          variante="faixa"
          rotulo={`Variação mediana da tarifa B1 em ${janela.meses} meses`}
          natureza="CALCULADO"
          valor={janela.mediana_pct}
          formato="pct"
          casas={2}
          evidencia={janela.meses === 12 ? evidencia : null}
          motivoAusencia="Sem IPCA ou sem tarifa nas duas datas da janela."
          nota={
            <>
              {janela.n} distribuidoras. IPCA no mesmo período: {pct(janela.ipca_pct, 2)}.
              {janela.meses !== 12 && " A ficha de prova só está publicada para a janela de 12 meses; as variações de cada distribuidora desta janela estão na tabela abaixo."}
            </>
          }
          endereco={endereco}
        />
        {comuns && (
          <div className="min-w-0" data-bloco="janelas-mesmo-conjunto">
            <p className="rotulo text-mineral">No mesmo conjunto de distribuidoras</p>
            <p className="mt-1 max-w-prose2 text-sm leading-relaxed text-carvao" data-nota="janelas-mesmo-conjunto">
              {textoJanelasNoMesmoConjunto(comuns)}
            </p>
            <p className="mt-1 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
              Cada janela, sozinha, tem um universo próprio ({comuns.itens.map((i) => `${i.nDaJanela} em ${i.meses} meses`).join(", ")}): as medianas publicadas de janelas diferentes não se comparam entre si, e no mesmo conjunto
              se comparam.
            </p>
          </div>
        )}
      </div>

      {(janela.excluidas_mudanca_perimetro.length > 0 || janela.excluidas_sem_tarifa_nas_duas_datas > 0) && (
        <div className="text-sm text-carvao-muted">
          <p>
            Fora desta janela: {janela.excluidas_sem_tarifa_nas_duas_datas} {janela.excluidas_sem_tarifa_nas_duas_datas === 1 ? "distribuidora" : "distribuidoras"} sem tarifa B1
            numa das duas datas
            {janela.excluidas_mudanca_perimetro.length > 0 ? ` e ${janela.excluidas_mudanca_perimetro.length} com a área alterada por incorporação entre as datas:` : "."}
          </p>
          {janela.excluidas_mudanca_perimetro.length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {janela.excluidas_mudanca_perimetro.map((e) => (
                <li key={e.cnpj}>
                  {rotuloDistribuidora(e.sigla, e.cnpj)}: incorporação com tarifa unificada desde {dataBR(e.data)} ({e.ato}); a variação de {pct(e.variacao_pct_nao_comparavel, 2)}{" "}
                  compara áreas diferentes e não entra na mediana.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ContaSobDemanda chaveUrl="reaj" rotulo="a tabela da janela com a variação real" detalhe={`${linhas.length} distribuidoras, ordenável e exportável`}>
        <TabelaInterativa
          titulo={`Variação em ${janela.meses} meses e IPCA de ${pct(janela.ipca_pct, 2)}`}
          colunas={COLUNAS_JANELA}
          linhas={linhas}
          chaveLinha="id"
          colunaRotulo="sigla"
          fonte={fonte}
          versao={dataReferencia}
          nomeArquivo={`conta-variacao-${janela.meses}-meses`}
          chaveUrl="reaj"
          ordemInicial={{ coluna: "variacao", direcao: "asc" }}
          selecionado={destaque}
          onSelecionar={selecionar}
          dicaBusca="Sigla ou CNPJ"
          iniciarAberta
          nota="Variação real = (1 + variação) ÷ (1 + IPCA) − 1, publicada pelo pipeline. Positiva: a tarifa subiu mais que o IPCA."
        />
      </ContaSobDemanda>

      <div data-nivel="analisar">
        <ContaSobDemanda chaveUrl="ult" rotulo="a última mudança de cada distribuidora" detalhe={`${ultimasLinhas.length} distribuidoras`}>
          <TabelaInterativa
            titulo="Última mudança da tarifa B1 de cada distribuidora do ranking"
            colunas={COLUNAS_ULTIMOS}
            linhas={ultimasLinhas}
            chaveLinha="id"
            colunaRotulo="sigla"
            fonte={fonte}
            versao={dataReferencia}
            nomeArquivo="conta-ultimas-mudancas-b1"
            chaveUrl="ult"
            ordemInicial={{ coluna: "data", direcao: "desc" }}
            selecionado={v.dist[0] && ultimasLinhas.some((l) => l.id === v.dist[0]) ? v.dist[0] : null}
            onSelecionar={selecionar}
            dicaBusca="Sigla ou ato"
            iniciarAberta
            nota="O conjunto não informa se o ato é reajuste, revisão periódica ou extraordinária; o histórico completo de cada distribuidora está no histórico da tarifa B1, na página principal da Conta de luz (modo Analisar)."
          />
        </ContaSobDemanda>
      </div>
    </div>
  );
}
