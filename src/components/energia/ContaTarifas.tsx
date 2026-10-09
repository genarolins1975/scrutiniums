"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ContaBuscaMunicipio } from "@/components/energia/ContaBuscaMunicipio";
import { ContaEscolha, ContaLista, type OpcaoConta } from "@/components/energia/ContaControles";
import { ContaReferencias } from "@/components/energia/ContaReferencias";
import { ContaSelecionadas } from "@/components/energia/ContaSelecionadas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
import {
  CAMPO_DIST,
  CAMPO_GRUPO,
  CAMPO_PERFIL,
  CAMPO_UF,
  COLUNAS_RANKING,
  ROTULO_TIPO,
  destacar,
  destaquesDoPerfil,
  expandirInfo,
  expandirVigentes,
  filtrarRanking,
  linhasRanking,
  referenciasDoPerfil,
  remover,
  respostaTarifa,
  resumoDoRanking,
  rotuloDistribuidora,
  rotuloGrupo,
  textoMunicipioEncontrado,
  textoResumoDoRanking,
  ufsDoRanking,
  vereditoTarifa,
  type GrupoRanking,
  type InfoCompacta,
  type MunicipioEncontrado,
  type Perfil,
  type VigenteCompacto,
} from "@/lib/energia/conta";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { ResumoTarifas } from "@/lib/energia/tipos-conta";

/**
 * P047, "Quanto custa o mesmo consumo?": o mesmo consumo em cada distribuidora, pela tarifa B1 residencial de aplicação vigente.
 * Quatro leituras do MESMO número publicado, todas para o perfil escolhido: as distribuidoras numa faixa de pontos com as referências
 * (menor, mediana e maior, com a faixa do 1º ao 3º quartil), o ranking de todas (custo do perfil em R$/mês ou tarifa TE + TUSD em
 * R$/MWh, empilhada nas duas parcelas), a tabela equivalente e a seleção. Perfil e leitura ficam na URL, e a faixa de métricas da
 * abertura lê o mesmo `?perfil=`; a distribuidora escolhida (?dist=) acende a barra, a linha da tabela, o losango da figura e os
 * outros painéis da página.
 *
 * Quem não sabe o nome da sua distribuidora a acha pelo município (busca com índice estático) ou pela lista; o ranking traz UF, tipo
 * (concessionária ou permissionária) e UCs, e um grupo de pares (tipo e UF) restringe a lista e a tabela e apaga os outros pontos da
 * figura. As referências da faixa de métricas e da figura seguem sendo as do conjunto inteiro; o resumo do grupo vem logo abaixo do
 * filtro. A tabela recebe as mesmas linhas do gráfico, então o que se exporta é o que se vê.
 */

const ESQUEMA = {
  dist: CAMPO_DIST,
  perfil: CAMPO_PERFIL,
  leitura: campo(tiposUrl.opcao(["perfil", "tarifa"] as const), "perfil", {
    param: "leitura",
  }),
  grupo: CAMPO_GRUPO,
  uf: CAMPO_UF,
};

const OPCOES_PERFIL: OpcaoConta<"100" | "200" | "300">[] = (["100", "200", "300"] as const).map((p) => ({ id: p, rotulo: `${p} kWh/mês` }));
const OPCOES_LEITURA: OpcaoConta<"perfil" | "tarifa">[] = [
  { id: "perfil", rotulo: "Custo do perfil (R$/mês)" },
  { id: "tarifa", rotulo: "Tarifa TE + TUSD (R$/MWh)" },
];

export type ContaTarifasProps = {
  /** As distribuidoras do ranking em tuplas (`compactarVigentes`). */
  vigentes: VigenteCompacto[];
  resumo: ResumoTarifas;
  dataReferencia: string;
  fonte: string;
  /** UF, tipo e UCs de cada distribuidora, das golds de Território e de Qualidade, em tuplas (`compactarInfo`). */
  info: InfoCompacta;
  /** Período, universo e unidade do painel, logo depois das figuras. */
  recorte?: ReactNode;
  /** Notas do painel (NotasDoPainel), depois das figuras e antes da tabela. */
  notas?: ReactNode;
};

export function ContaTarifas({ vigentes: compactos, resumo, dataReferencia, fonte, info: infoCompacta, recorte, notas }: ContaTarifasProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const info = useMemo(() => expandirInfo(infoCompacta), [infoCompacta]);
  const vigentes = useMemo(() => expandirVigentes(compactos), [compactos]);
  const perfil = Number(v.perfil) as Perfil;
  const todas = useMemo(() => linhasRanking(vigentes, perfil, info), [vigentes, perfil, info]);
  const ufs = useMemo(() => ufsDoRanking(todas), [todas]);
  const uf = ufs.some((x) => x.uf === v.uf) ? v.uf : "";
  const grupo = v.grupo as GrupoRanking;
  const linhas = useMemo(() => filtrarRanking(todas, grupo, uf), [todas, grupo, uf]);
  const filtrado = linhas.length !== todas.length;
  const resumoGrupo = useMemo(() => resumoDoRanking(linhas), [linhas]);
  const referencias = useMemo(() => referenciasDoPerfil(vigentes, resumo, perfil), [vigentes, resumo, perfil]);
  const destaque = v.dist[0] ?? null;
  const naRanking = destaque !== null && todas.some((l) => l.id === destaque);
  const naLista = destaque !== null && linhas.some((l) => l.id === destaque);
  const destaques = useMemo(() => destaquesDoPerfil(vigentes, resumo, perfil, v.dist), [vigentes, resumo, perfil, v.dist]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState<string | null>(null);
  const nomes = useMemo(() => new Map(vigentes.map((x) => [x.cnpj, rotuloDistribuidora(x.sigla, x.cnpj)])), [vigentes]);
  const anoUcs = useMemo(() => Object.values(info).find((i) => i.anoUcs !== null)?.anoUcs ?? null, [info]);
  const rotulo = (id: string) => nomes.get(id) ?? `CNPJ ${id}`;

  const selecionar = (id: string | null) => {
    if (id) {
      // o limite de quatro descarta a escolha mais antiga: o aviso diz qual saiu
      const descartada = !v.dist.includes(id) && v.dist.length >= LIMITE_COMPARACAO ? v.dist[LIMITE_COMPARACAO - 1] : null;
      setAviso(descartada ? `O limite é de ${LIMITE_COMPARACAO} distribuidoras: ${rotulo(descartada)} saiu da seleção para entrar ${rotulo(id)}.` : null);
      definir({ dist: destacar(v.dist, id) });
    } else if (destaque) {
      setAviso(null);
      definir({ dist: remover(v.dist, destaque) });
    }
  };
  const escolherMunicipio = (m: MunicipioEncontrado) => {
    const validos = m.vinculos.filter((x) => x.estado !== 0);
    const usados = (validos.length ? validos : m.vinculos).map((x) => x.cnpj).filter((c) => nomes.has(c));
    setAviso(null);
    setMunicipio(textoMunicipioEncontrado(m, todas, perfil, dataReferencia));
    if (usados.length) definir({ dist: usados.slice(0, LIMITE_COMPARACAO) });
  };
  const resposta = respostaTarifa(dataReferencia, resumo, vigentes, perfil);
  const chavePerfil = String(perfil) as "100" | "200" | "300";
  // distribuidoras por ordem alfabética, com a UF: quem procura a sua pelo nome não precisa percorrer o ranking de 81 barras
  const opcoesDistribuidora = useMemo<OpcaoConta<string>[]>(
    () => [
      { id: "", rotulo: "Nenhuma" },
      ...todas
        .map((l) => ({ id: l.id, rotulo: l.uf ? `${l.sigla} (${l.uf})` : l.sigla }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    ],
    [todas],
  );
  const opcoesGrupo = useMemo<OpcaoConta<GrupoRanking>[]>(() => {
    const n = (g: GrupoRanking) => filtrarRanking(todas, g, "").length;
    const tipos = (["concessionaria", "permissionaria"] as const).filter((g) => n(g) > 0);
    return [{ id: "todas", rotulo: `Todas (${todas.length})` }, ...tipos.map((g) => ({ id: g, rotulo: `${ROTULO_TIPO[g]}s (${n(g)})` }))];
  }, [todas]);
  const opcoesUf = useMemo<OpcaoConta<string>[]>(() => [{ id: "", rotulo: "Todas as UFs" }, ...ufs.map((x) => ({ id: x.uf, rotulo: `${x.uf} (${x.n})` }))], [ufs]);

  // a lista do ranking mostra só parte das barras (rola dentro da caixa): ao escolher a distribuidora pelo seletor, a barra dela entra
  // na parte visível da lista, sem mover a página
  const ranking = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!naLista || !destaque) return;
    const area = ranking.current?.querySelector<HTMLElement>("[data-rolagem]");
    const barra = area?.querySelector<SVGGElement>(`g[data-id="${destaque}"]`);
    if (!area || !barra) return;
    const a = area.getBoundingClientRect();
    const b = barra.getBoundingClientRect();
    if (b.top < a.top || b.bottom > a.bottom) area.scrollTop += b.top - a.top - (a.height - b.height) / 2;
  }, [destaque, naLista, v.leitura]);

  const dadosGrafico = useMemo(() => linhas.map((l) => ({ ...l, rotulo: l.uf ? `${l.sigla} · ${l.uf}` : l.sigla })), [linhas]);
  const idsDoGrupo = useMemo(() => new Set(linhas.map((l) => l.id)), [linhas]);
  const pontos = useMemo(
    () => todas.filter((l) => l.custo !== null).map((l) => ({ id: l.id, valor: l.custo as number, rotulo: l.uf ? `${l.sigla} (${l.uf})` : l.sigla, apagado: filtrado && !idsDoGrupo.has(l.id) })),
    [todas, filtrado, idsDoGrupo],
  );
  const nomeGrupo = `${linhas.length} ${rotuloGrupo(grupo, uf)}`;

  return (
    <div className="space-y-5">
      <ContaReferencias
        referencias={referencias}
        destaques={destaques}
        pontos={pontos}
        grupo={filtrado ? nomeGrupo : null}
        aoEscolher={selecionar}
        controle={<ContaEscolha emLinha legenda="Perfil de consumo" opcoes={OPCOES_PERFIL} valor={v.perfil} onEscolher={(p) => definir({ perfil: p })} />}
        resposta={
          <RespostaCurta id="p047" vivo veredito={vereditoTarifa(dataReferencia, resumo, vigentes, perfil)}>
            {resposta}
          </RespostaCurta>
        }
        seletor={
          <div className="min-w-0 space-y-3">
            <p className="max-w-prose2 text-sm text-carvao-muted" data-dica="distribuidora">
              Não sabe qual é a sua distribuidora? O nome dela está no alto da fatura de luz. Se preferir, busque pelo município.
            </p>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <ContaBuscaMunicipio aoEscolher={escolherMunicipio} />
              <ContaLista rotulo="Distribuidora em destaque" opcoes={opcoesDistribuidora} valor={naRanking && destaque ? destaque : ""} onEscolher={(id) => selecionar(id || null)} />
            </div>
            {municipio && (
              <p role="status" className="max-w-prose2 text-sm text-carvao" data-municipio="">
                {municipio}
              </p>
            )}
          </div>
        }
        selecionadas={
          <ContaSelecionadas
            ids={v.dist}
            rotulo={rotulo}
            aoTirar={(id) => {
              setAviso(null);
              definir({ dist: remover(v.dist, id) });
            }}
            aoLimpar={() => {
              setAviso(null);
              setMunicipio(null);
              definir({ dist: [] });
            }}
            aviso={aviso}
            limite={LIMITE_COMPARACAO}
          />
        }
      />

      <div ref={ranking}>
        <SecaoDoPainel id="ranking" titulo="Todas as distribuidoras, da mais barata à mais cara">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <ContaEscolha legenda="Leitura do ranking" opcoes={OPCOES_LEITURA} valor={v.leitura} onEscolher={(l) => definir({ leitura: l })} />
            <ContaEscolha legenda="Tipo de distribuidora" opcoes={opcoesGrupo} valor={opcoesGrupo.some((o) => o.id === grupo) ? grupo : "todas"} onEscolher={(g) => definir({ grupo: g })} />
            <ContaLista rotulo="Estado (UF)" opcoes={opcoesUf} valor={uf} onEscolher={(u) => definir({ uf: u })} />
          </div>
          <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="grupos">
            Concessionárias e permissionárias são os dois tipos de distribuidora da ANEEL. A UF é a da área de atuação de cada distribuidora (uma ou mais) e as UCs são os consumidores
            que ela atende (média de {anoUcs ?? "ano não informado"}). Os filtros valem para a lista e a tabela; a faixa de pontos acima mostra todas e apaga as que ficam de fora.
          </p>
          {filtrado && (
            <p className="max-w-prose2 text-sm text-carvao" role="status" data-resumo-grupo="">
              {textoResumoDoRanking(resumoGrupo, perfil, grupo, uf)}
            </p>
          )}

          <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted" data-nota="ordem-ranking">
            A lista começa pela distribuidora mais barata e segue até a mais cara ({linhas.length} no total): as primeiras barras são as menores, e a escala do gráfico vai até a maior de todas. Role a lista ou use
            &quot;Mostrar todas&quot; para ver as mais caras.
          </p>

          {!linhas.length ? (
            <p className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted" role="status">
              Nenhuma distribuidora com tarifa B1 vigente neste grupo.
            </p>
          ) : v.leitura === "perfil" ? (
            <GraficoBarras
              titulo={`Custo de ${perfil} kWh/mês pela tarifa B1 residencial, por distribuidora (sem tributos e sem bandeira)`}
              dados={dadosGrafico}
              chaveCategoria="id"
              chaveRotulo="rotulo"
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
              selecionado={naLista ? destaque : null}
              onSelecionar={selecionar}
              alturaCategoria={44}
              alturaMaxima={520}
            />
          ) : (
            <GraficoBarras
              titulo="Tarifa B1 residencial de aplicação por distribuidora: TE e TUSD empilhadas (somam o total)"
              dados={dadosGrafico}
              chaveCategoria="id"
              chaveRotulo="rotulo"
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
              selecionado={naLista ? destaque : null}
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
          {destaque && naRanking && !naLista && (
            <p className="text-sm text-carvao-muted" role="status">
              {rotulo(destaque)} está fora do grupo escolhido ({rotuloGrupo(grupo, uf)}) e não aparece na lista; ela segue em destaque na faixa de pontos. Escolha &quot;Todas&quot; para vê-la na lista.
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
        selecionado={naLista ? destaque : null}
        onSelecionar={selecionar}
        dicaBusca="Sigla, razão social, CNPJ ou UF"
        nota={`Tarifa de aplicação homologada sem ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira. Base econômica é a tarifa usada no cálculo tarifário, sem os componentes financeiros do processo. UCs: consumidores de cada distribuidora (média de ${anoUcs ?? "ano não informado"}); UF: estados da área de atuação.`}
      />
    </div>
  );
}
