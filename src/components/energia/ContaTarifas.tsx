"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ContaBuscaMunicipio } from "@/components/energia/ContaBuscaMunicipio";
import { ContaEscolha, ContaLista, type OpcaoConta } from "@/components/energia/ContaControles";
import { ContaReferencias } from "@/components/energia/ContaReferencias";
import { ContaSelecionadas } from "@/components/energia/ContaSelecionadas";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import {
  CAMPO_DIST,
  CAMPO_GRUPO,
  CAMPO_PERFIL,
  CAMPO_UF,
  colunasRanking,
  LIMITE_DIFERENCA_BASE,
  ROTULO_TIPO,
  ROTULO_TIPO_EN,
  destacar,
  destaquesDoPerfil,
  dicaDaRegua,
  expandirFora,
  expandirInfo,
  expandirVigentes,
  filtrarRanking,
  linhasRanking,
  marcaBase,
  referenciasDoPerfil,
  remover,
  reguaDoRanking,
  respostaTarifa,
  resumoDoRanking,
  resumoForaDoRanking,
  rotuloDistribuidora,
  rotuloGrupo,
  textoForaDoRanking,
  textoForaDoRankingLinha,
  textoMunicipioEncontrado,
  textoReguaDoRanking,
  textoResumoDoRanking,
  ufsDoRanking,
  vereditoTarifa,
  type ForaCompacto,
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
 * Quem não sabe o nome da sua distribuidora a acha pelo município (busca com índice estático) ou pela lista, que traz também as que
 * ficaram fora do ranking (sem tarifa vigente na data), com o motivo e o custo pela última tarifa; o ranking traz UF, tipo
 * (concessionária ou permissionária) e UCs, e um grupo de pares (tipo e UF) restringe a lista e a tabela e apaga os outros pontos da
 * figura. As referências da faixa de métricas e da figura seguem sendo as do conjunto inteiro (a linha da mediana diz "das N"); o
 * resumo do grupo vem logo abaixo do filtro.
 *
 * A ordem é a da tarifa de aplicação; a base econômica, a outra régua, aparece na tabela e na dica dos pontos em que as duas diferem
 * em mais de 20% (marcados com †). A tabela recebe as mesmas linhas do gráfico, então o que se exporta é o que se vê, e só abre quando
 * o leitor a pede (em Analisar ela já nasce aberta): escolher uma distribuidora no gráfico não a abre nem desloca a leitura.
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


export type ContaTarifasProps = {
  /** As distribuidoras do ranking em tuplas (`compactarVigentes`). */
  vigentes: VigenteCompacto[];
  resumo: ResumoTarifas;
  dataReferencia: string;
  fonte: string;
  /** UF, tipo e UCs de cada distribuidora, das golds de Território e de Qualidade, em tuplas (`compactarInfo`). */
  info: InfoCompacta;
  /** As distribuidoras do conjunto que ficaram fora do ranking, em tuplas (`compactarFora`): o motivo e o custo pela última tarifa. */
  fora: ForaCompacto[];
  /** Período, universo e unidade do painel, logo depois das figuras. */
  recorte?: ReactNode;
  /** Notas do painel (NotasDoPainel), depois das figuras e antes da tabela. */
  notas?: ReactNode;
};

export function ContaTarifas({ vigentes: compactos, resumo, dataReferencia, fonte, info: infoCompacta, fora: foraCompacto, recorte, notas }: ContaTarifasProps) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const idioma = useIdioma();
  const tx = useTx();
  const OPCOES_PERFIL: OpcaoConta<"100" | "200" | "300">[] = (["100", "200", "300"] as const).map((p) => ({ id: p, rotulo: tx(`${p} kWh/mês`, `${p} kWh/month`) }));
  const OPCOES_LEITURA: OpcaoConta<"perfil" | "tarifa">[] = [
    { id: "perfil", rotulo: tx("Custo do perfil (R$/mês)", "Profile cost (R$/month)") },
    { id: "tarifa", rotulo: tx("Tarifa TE + TUSD (R$/MWh)", "TE + TUSD tariff (R$/MWh)") },
  ];
  const info = useMemo(() => expandirInfo(infoCompacta), [infoCompacta]);
  const vigentes = useMemo(() => expandirVigentes(compactos), [compactos]);
  const fora = useMemo(() => expandirFora(foraCompacto), [foraCompacto]);
  const perfil = Number(v.perfil) as Perfil;
  const todas = useMemo(() => linhasRanking(vigentes, perfil, info, idioma), [vigentes, perfil, info, idioma]);
  const ufs = useMemo(() => ufsDoRanking(todas), [todas]);
  const uf = ufs.some((x) => x.uf === v.uf) ? v.uf : "";
  const grupo = v.grupo as GrupoRanking;
  const linhas = useMemo(() => filtrarRanking(todas, grupo, uf), [todas, grupo, uf]);
  const filtrado = linhas.length !== todas.length;
  const resumoGrupo = useMemo(() => resumoDoRanking(linhas), [linhas]);
  const regua = useMemo(() => reguaDoRanking(todas), [todas]);
  const linhaFora = useMemo(() => textoForaDoRankingLinha(resumoForaDoRanking(fora), idioma), [fora, idioma]);
  const referencias = useMemo(() => referenciasDoPerfil(vigentes, resumo, perfil), [vigentes, resumo, perfil]);
  const destaque = v.dist[0] ?? null;
  const naRanking = destaque !== null && todas.some((l) => l.id === destaque);
  const naLista = destaque !== null && linhas.some((l) => l.id === destaque);
  const foraDoDestaque = destaque !== null && !naRanking ? (fora.find((f) => f.id === destaque) ?? null) : null;
  const destaques = useMemo(() => destaquesDoPerfil(vigentes, resumo, perfil, v.dist), [vigentes, resumo, perfil, v.dist]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState<string | null>(null);
  const nomes = useMemo(() => new Map([...vigentes.map((x) => [x.cnpj, rotuloDistribuidora(x.sigla, x.cnpj)] as const), ...fora.map((f) => [f.id, f.sigla] as const)]), [vigentes, fora]);
  const anoUcs = useMemo(() => Object.values(info).find((i) => i.anoUcs !== null)?.anoUcs ?? null, [info]);
  const rotulo = (id: string) => nomes.get(id) ?? `CNPJ ${id}`;

  const selecionar = (id: string | null) => {
    if (id) {
      // o limite de quatro descarta a escolha mais antiga: o aviso diz qual saiu
      const descartada = !v.dist.includes(id) && v.dist.length >= LIMITE_COMPARACAO ? v.dist[LIMITE_COMPARACAO - 1] : null;
      setAviso(
        descartada
          ? tx(
              `O limite é de ${LIMITE_COMPARACAO} distribuidoras: ${rotulo(descartada)} saiu da seleção para entrar ${rotulo(id)}.`,
              `The limit is ${LIMITE_COMPARACAO} distribution utilities: ${rotulo(descartada)} left the selection so that ${rotulo(id)} could enter.`,
            )
          : null,
      );
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
    setMunicipio(textoMunicipioEncontrado(m, todas, perfil, dataReferencia, idioma));
    if (usados.length) definir({ dist: usados.slice(0, LIMITE_COMPARACAO) });
  };
  const resposta = respostaTarifa(dataReferencia, resumo, vigentes, perfil, idioma);
  const chavePerfil = String(perfil) as "100" | "200" | "300";
  // distribuidoras por ordem alfabética, com a UF: quem procura a sua pelo nome não precisa percorrer o ranking de 81 barras; as que ficaram
  // fora do ranking vêm num grupo à parte, para que quem mora numa delas ache a sua e leia o motivo
  const opcoesDistribuidora = useMemo<OpcaoConta<string>[]>(
    () => [
      { id: "", rotulo: tx("Nenhuma", "None") },
      ...todas
        .map((l) => ({ id: l.id, rotulo: l.uf ? `${l.sigla} (${l.uf})` : l.sigla }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
      ...fora
        .filter((f) => f.situacao !== "incorporada")
        .map((f) => {
          const n = fora.filter((x) => x.situacao !== "incorporada").length;
          return { id: f.id, rotulo: f.sigla, grupo: tx(`Sem tarifa vigente na data (${n})`, `No tariff in force on the date (${n})`) };
        })
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todas, fora, idioma],
  );
  const opcoesGrupo = useMemo<OpcaoConta<GrupoRanking>[]>(() => {
    const n = (g: GrupoRanking) => filtrarRanking(todas, g, "").length;
    const tipos = (["concessionaria", "permissionaria"] as const).filter((g) => n(g) > 0);
    return [
      { id: "todas", rotulo: tx(`Todas (${todas.length})`, `All (${todas.length})`) }, // i18n: dado
      ...tipos.map((g) => ({ id: g, rotulo: tx(`${ROTULO_TIPO[g]}s (${n(g)})`, `${ROTULO_TIPO_EN[g]}s (${n(g)})`) })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todas, idioma]);
  const opcoesUf = useMemo<OpcaoConta<string>[]>(
    () => [{ id: "", rotulo: tx("Todas as UFs", "All states") }, ...ufs.map((x) => ({ id: x.uf, rotulo: `${x.uf} (${x.n})` }))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ufs, idioma],
  );

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

  // † marca, no nome da barra e na dica do ponto, a distribuidora em que a tarifa de aplicação e a base econômica diferem em mais de 20%
  const dadosGrafico = useMemo(() => linhas.map((l) => ({ ...l, rotulo: `${l.uf ? `${l.sigla} · ${l.uf}` : l.sigla}${marcaBase(l) ? " †" : ""}` })), [linhas]);
  const idsDoGrupo = useMemo(() => new Set(linhas.map((l) => l.id)), [linhas]);
  const pontos = useMemo(
    () =>
      todas
        .filter((l) => l.custo !== null)
        .map((l) => ({ id: l.id, valor: l.custo as number, rotulo: l.uf ? `${l.sigla} (${l.uf})` : l.sigla, apagado: filtrado && !idsDoGrupo.has(l.id), dica: dicaDaRegua(l, idioma) })),
    [todas, filtrado, idsDoGrupo, idioma],
  );
  const nomeGrupo = `${linhas.length} ${rotuloGrupo(grupo, uf, idioma)}`;
  // a linha de referência é a mediana das N do ranking, com o filtro ou sem ele; o texto da frase diz "do grupo" quando é a do grupo
  const rotuloMediana = tx(`Mediana das ${resumo.n}${filtrado ? ", todas" : ""}`, `Median of the ${resumo.n}${filtrado ? ", all" : ""}`);

  return (
    <div className="space-y-5">
      <ContaReferencias
        referencias={referencias}
        destaques={destaques}
        pontos={pontos}
        grupo={filtrado ? nomeGrupo : null}
        aoEscolher={selecionar}
        controle={<ContaEscolha emLinha legenda={tx("Perfil de consumo", "Consumption profile")} opcoes={OPCOES_PERFIL} valor={v.perfil} onEscolher={(p) => definir({ perfil: p })} />}
        resposta={
          <RespostaCurta id="p047" vivo veredito={vereditoTarifa(dataReferencia, resumo, vigentes, perfil, idioma)}>
            {resposta}
          </RespostaCurta>
        }
        seletor={
          <div className="min-w-0 space-y-3">
            <p className="max-w-prose2 text-sm text-carvao-muted" data-dica="distribuidora">
              {tx(
                "Não sabe qual é a sua distribuidora? O nome dela está no alto da fatura de luz. Se preferir, busque pelo município.",
                "Don't know your distribution utility? Its name is at the top of your electricity bill. If you prefer, search by municipality.",
              )}
            </p>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <ContaBuscaMunicipio aoEscolher={escolherMunicipio} />
              <ContaLista rotulo={tx("Distribuidora em destaque", "Highlighted distribution utility")} opcoes={opcoesDistribuidora} valor={destaque && (naRanking || foraDoDestaque) ? destaque : ""} onEscolher={(id) => selecionar(id || null)} />
            </div>
            {municipio && (
              <p role="status" className="max-w-prose2 text-sm text-carvao" data-municipio="">
                {municipio}
              </p>
            )}
            {foraDoDestaque && (
              <p role="status" className="max-w-prose2 text-sm text-carvao" data-fora-do-ranking="escolhida">
                {textoForaDoRanking(foraDoDestaque, perfil, dataReferencia, idioma)}
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
        <SecaoDoPainel id="ranking" titulo={tx("Todas as distribuidoras, da mais barata à mais cara", "All distribution utilities, from the cheapest to the most expensive")}>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <ContaEscolha legenda={tx("Leitura do ranking", "Ranking view")} opcoes={OPCOES_LEITURA} valor={v.leitura} onEscolher={(l) => definir({ leitura: l })} />
            <ContaEscolha
              legenda={tx("Tipo de distribuidora", "Type of distribution utility")}
              opcoes={opcoesGrupo}
              valor={
                // i18n: dado
                opcoesGrupo.some((o) => o.id === grupo) ? grupo : "todas"
              }
              onEscolher={(g) => definir({ grupo: g })}
            />
            <ContaLista rotulo={tx("Estado (UF)", "State")} opcoes={opcoesUf} valor={uf} onEscolher={(u) => definir({ uf: u })} />
          </div>
          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-nota="grupos">
            {tx(
              <>
                Concessionária e permissionária são os dois tipos de distribuidora da ANEEL; a UF é a da área de atuação e as UCs são os consumidores atendidos (média de {anoUcs ?? "ano não informado"}). Os
                filtros valem para a lista e a tabela; a faixa de pontos mostra todas e apaga as que ficam de fora.
              </>,
              <>
                Concession holder and permit holder are ANEEL&apos;s two types of distribution utility; the state is that of the service area, and consumer units are the consumers served (average for{" "}
                {anoUcs ?? "year not reported"}). The filters apply to the list and the table; the dot strip shows all of them and dims those left out.
              </>,
            )}
          </p>
          {filtrado && (
            <p className="max-w-prose2 text-sm text-carvao" role="status" data-resumo-grupo="">
              {textoResumoDoRanking(resumoGrupo, perfil, grupo, uf, idioma)}
            </p>
          )}

          <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-nota="ordem-ranking">
            {tx(
              <>A lista começa pela distribuidora mais barata e segue até a mais cara ({linhas.length} no total): use &quot;Mostrar todas&quot; para ver as outras.</>,
              <>The list starts with the cheapest distribution utility and runs to the most expensive ({linhas.length} in total): use &quot;Show all&quot; to see the others.</>,
            )}{" "}
            {textoReguaDoRanking(regua, idioma)}
          </p>

          {!linhas.length ? (
            <p className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted" role="status">
              {tx("Nenhuma distribuidora com tarifa B1 vigente neste grupo.", "No distribution utility with a B1 tariff in force in this group.")}
            </p>
          ) : v.leitura === "perfil" ? (
            <GraficoBarras
              titulo={tx(
                `Custo de ${perfil} kWh/mês pela tarifa B1 residencial, por distribuidora (sem tributos e sem bandeira)`,
                `Cost of ${perfil} kWh/month on the residential B1 tariff, by distribution utility (without taxes and without the tariff flag)`,
              )}
              dados={dadosGrafico}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[
                {
                  id: "custo",
                  rotulo: tx(`Custo de ${perfil} kWh`, `Cost of ${perfil} kWh`),
                  cor: "var(--cor-energia)", // i18n: dado
                },
              ]}
              unidade={tx("R$/mês", "R$/month")}
              casas={2}
              orientacao="horizontal"
              referencias={[
                {
                  valor: resumo.perfis_mediana[chavePerfil] ?? NaN,
                  rotulo: rotuloMediana,
                },
              ].filter((r) => Number.isFinite(r.valor))}
              selecionado={naLista ? destaque : null}
              onSelecionar={selecionar}
              alturaCategoria={44}
              alturaMaxima={520}
              limiteInicial={12}
            />
          ) : (
            <GraficoBarras
              titulo={tx(
                "Tarifa B1 residencial de aplicação por distribuidora: TE e TUSD empilhadas (somam o total)",
                "Applied residential B1 tariff by distribution utility: TE and TUSD stacked (they add up to the total)",
              )}
              dados={dadosGrafico}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[
                { id: "te", rotulo: tx("TE (energia)", "TE (energy)"), cor: "var(--serie-comp-1)" },
                {
                  id: "tusd",
                  rotulo: tx("TUSD (uso da rede)", "TUSD (grid use)"),
                  cor: "var(--serie-solar)",
                },
              ]}
              empilhado
              unidade="R$/MWh"
              casas={2}
              orientacao="horizontal"
              // uma linha só: três tracejados iguais (1º quartil, mediana, 3º quartil) só se distinguem pela ordem da legenda; os quartis estão na faixa de pontos e na tabela
              referencias={[{ valor: resumo.mediana ?? NaN, rotulo: rotuloMediana }].filter((r) => Number.isFinite(r.valor))}
              selecionado={naLista ? destaque : null}
              onSelecionar={selecionar}
              alturaCategoria={44}
              alturaMaxima={520}
              limiteInicial={12}
            />
          )}

          {linhaFora && (
            <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted" data-fora-do-ranking="linha">
              {linhaFora} {tx("A lista, com o motivo de cada uma, está em", "The list, with the reason for each, is in")}{" "}
              <a href="#fora-do-ranking" className="text-energia-dark underline underline-offset-4">
                {tx("Auditar", "Audit")}
              </a>
              {tx("; o seletor de distribuidora acima traz as que têm tarifa anterior.", "; the distribution utility selector above includes those with an earlier tariff.")}
            </p>
          )}
          {destaque && !naRanking && !foraDoDestaque && (
            <p className="text-sm text-carvao-muted" role="status">
              {tx(
                <>
                  A distribuidora escolhida não tem tarifa B1 vigente em {dataBR(dataReferencia, idioma)} e não entra no ranking; o histórico dela aparece no modo Analisar e o motivo, na lista de
                  distribuidoras sem tarifa vigente do modo Auditar.
                </>,
                <>
                  The chosen distribution utility has no B1 tariff in force on {dataBR(dataReferencia, idioma)} and is not in the ranking; its history appears in Analyze mode and the reason, in the
                  list of distribution utilities without a tariff in force in Audit mode.
                </>,
              )}
            </p>
          )}
          {destaque && naRanking && !naLista && (
            <p className="text-sm text-carvao-muted" role="status">
              {tx(
                <>
                  {rotulo(destaque)} está fora do grupo escolhido ({rotuloGrupo(grupo, uf, idioma)}) e não aparece na lista; ela segue em destaque na faixa de pontos. Escolha &quot;Todas&quot; para vê-la na lista.
                </>,
                <>
                  {rotulo(destaque)} is outside the chosen group ({rotuloGrupo(grupo, uf, idioma)}) and does not appear in the list; it stays highlighted in the dot strip. Choose &quot;All&quot; to see it in
                  the list.
                </>,
              )}
            </p>
          )}
        </SecaoDoPainel>
      </div>

      {recorte}
      {notas}

      <ContaSobDemanda
        chaveUrl="tar"
        abreEm="analisar"
        rotulo={tx("a tabela das distribuidoras", "the distribution utility table")}
        detalhe={tx(`${linhas.length} linhas, ordenável e exportável`, `${linhas.length} rows, sortable and exportable`)}
      >
        <TabelaInterativa
          titulo={tx("Tarifas B1 residenciais vigentes e custo por perfil", "Residential B1 tariffs in force and cost by profile")}
          colunas={colunasRanking(idioma)}
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
          dicaBusca={tx("Sigla, razão social, CNPJ ou UF", "Acronym, legal name, CNPJ or state")}
          iniciarAberta
          nota={tx(
            `Tarifa de aplicação homologada sem ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira; a lista segue a posição pela tarifa de aplicação. Base econômica é a tarifa usada no cálculo tarifário, sem os componentes financeiros do processo; as duas colunas ao lado dela dizem a posição pela base e quanto a aplicação fica acima ou abaixo (diferenças acima de ${LIMITE_DIFERENCA_BASE}% marcam o † do ranking). UCs: consumidores de cada distribuidora (média de ${anoUcs ?? "ano não informado"}); UF: estados da área de atuação.`,
            `Ratified applied tariff without ICMS, PIS/Pasep, Cofins, public lighting and the tariff flag; the list follows the position by applied tariff. The economic base is the tariff used in the tariff calculation, without the financial components of the process; the two columns next to it give the position by base and how far the applied tariff is above or below it (differences above ${LIMITE_DIFERENCA_BASE}% mark the † in the ranking). Consumer units: consumers of each distribution utility (average for ${anoUcs ?? "year not reported"}); State: states of the service area.`,
          )}
        />
      </ContaSobDemanda>
    </div>
  );
}
