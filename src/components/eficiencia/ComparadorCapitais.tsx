"use client";

import { useMemo, useState } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CABECALHO_CSV_COMPARACAO,
  CABECALHO_CSV_TABELA_COMPARATIVA,
  COLUNAS,
  Indice,
  MEDIDA,
  MEDIDAS,
  ROTULO_STATUS,
  anosDaMedida,
  comparar,
  componente,
  csv,
  dicionarioExportacoes,
  ehDespesa,
  perimetroIntra,
  textoPerimetroIntra,
  formata,
  formataEixo,
  linhasCsvComparacao,
  linhasCsvTabelaComparativa,
  nomeEtapa,
  notasMateriais,
  referenciaExternaDoGrafico,
  regioesDoPainel,
  rotuloPeriodoMedida,
  tabelaComparativa,
  unidade,
  type ColunaId,
  type DadosPainel,
  type Disciplina,
  type Grupo,
  type MedidaId,
  type Moeda,
  type Ordem,
} from "@/lib/eficiencia/consulta";
import { fraseAmplitude, fraseCobertura } from "@/lib/eficiencia/frases";
import type { EtapaId } from "@/lib/eficiencia/tipos";
import { anoValido, etapaEfetiva, temEtapa, universoDaMedida } from "@/lib/eficiencia/visao";
import { DistribuicaoCapitais } from "./DistribuicaoCapitais";
import { ReferenciasDoGrupo } from "./ReferenciasPainel";
import { TabelaComparativa, type VisaoColunas } from "./TabelaComparativa";
import { TabelaSimples } from "./TabelaSimples";
import { Alternancia, Selecao } from "./controles";
import { Siglas } from "./Siglas";
import { ForaDaComparacao, NotasMateriais, Ressalva } from "./estados";
import type { ContextoFicha } from "./FichaConteudo";
import { SobreEsteDado } from "./SobreEsteDado";

/**
 * Comparador: visão de conjunto das 26 capitais, com poucas cidades destacadas sem tirar o contexto do grupo. Gráfico e
 * tabela mostram o mesmo recorte. A ordem por valor é pedido de quem lê e não é classificação de eficiência. A tabela
 * completa conserva população, matrículas, despesa total e razões; as colunas de resultado seguem a etapa escolhida.
 */

const ETAPAS: EtapaId[] = ["total", "creche", "pre_escola", "anos_iniciais", "anos_finais", "ensino_medio", "eja", "profissional"];
const MAX_DESTAQUES = 5;
const GRUPO_MEDIDA: Record<string, string> = { recursos: "Gastos", atendimento: "Atendimento", resultado: "Resultados" };

type Visao = "grafico" | "tabela";

function esquema(ids: string[], regioes: string[]) {
  return {
    cap: campo(tiposUrl.opcao(["", ...ids]), ""),
    reg: campo(tiposUrl.opcao(["", ...regioes]), ""),
    med: campo(tiposUrl.opcao(MEDIDAS), "despesa_hab" as MedidaId),
    ano: campo(tiposUrl.inteiro({ min: 0, max: 2100 }), 0),
    etapa: campo(tiposUrl.opcao(ETAPAS), "anos_iniciais" as EtapaId),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    disc: campo(tiposUrl.opcao(["matematica", "portugues"] as const), "matematica" as Disciplina),
    vis: campo(tiposUrl.opcao(["grafico", "tabela"] as const), "grafico" as Visao),
    ord: campo(tiposUrl.opcao(["alfabetica", "valor", "valor_desc"] as const), "alfabetica" as Ordem),
    dest: campo(tiposUrl.lista(tiposUrl.opcao(ids), { max: MAX_DESTAQUES }), [] as string[]),
    vc: campo(tiposUrl.opcao(["todas", "recursos", "atendimento", "resultado"] as const), "todas" as VisaoColunas),
    ot: campo(tiposUrl.opcao(["alfabetica", ...COLUNAS.map((c) => c.id)] as const), "alfabetica" as ColunaId | "alfabetica"),
    od: campo(tiposUrl.opcao(["asc", "desc"] as const), "asc" as "asc" | "desc"),
  };
}

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ComparadorCapitais({ dados, contextos }: { dados: DadosPainel; contextos: Record<string, ContextoFicha> }) {
  const ix = useMemo(() => new Indice(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const regioes = useMemo(() => regioesDoPainel(dados), [dados]);
  const esq = useMemo(() => esquema(ids, regioes.map((r) => r.id)), [ids, regioes]);
  const [s, definir] = useEstadoUrl(esq);
  const [aviso, setAviso] = useState("");

  const medida = s.med;
  const md = MEDIDA[medida];
  const etapa = etapaEfetiva(medida, s.etapa, "anos_iniciais");
  const anos = anosDaMedida(dados, medida);
  const ano = s.ano ? anoValido(dados, medida, s.ano) : anos[anos.length - 1];
  // a capital escolhida em outra visão (?cap=) entra como destaque inicial; escolher destaques aqui prevalece
  const destacadas = s.dest.length ? s.dest.filter((id) => ids.includes(id)) : s.cap && ids.includes(s.cap) ? [s.cap] : [];
  // grupo de comparação: todas as capitais ou as de uma região; a mediana, a média e os extremos seguem o grupo
  const grupo: Grupo = s.reg ? "regiao" : "todas";
  const capGrupo = (s.reg && dados.capitais.find((c) => c.regiao === s.reg)) || dados.capitais[0];
  const comp = comparar(ix, medida, ano, etapa, s.moeda, s.disc, grupo, capGrupo, s.ord);
  const itensFora = comp.excluidas.map((x) => ({ nome: x.cap.nome, uf: x.cap.uf, status: x.comValor ? "Fora da comparação" : ROTULO_STATUS[x.status], motivo: x.motivo }));
  const linhasForaDoGrafico = comp.excluidas.map((x) => ({
    chave: x.cap.id,
    rotulo: `${x.cap.nome} (${x.cap.uf})`,
    valor: x.comValor ? x.ponto.valor : null,
    texto: x.comValor ? "fora da comparação (motivo abaixo)" : `${ROTULO_STATUS[x.status].toLowerCase()} (motivo abaixo)`,
    destacada: destacadas.includes(x.cap.id),
  }));
  const k = componente(medida, s.moeda, s.disc);
  const externa = referenciaExternaDoGrafico(dados, medida, ano, etapa, k);
  const notas = notasMateriais(comp);
  const fmt = (v: number) => formata(medida, v);
  const periodo = rotuloPeriodoMedida(medida, ano);
  const titulo = fraseAmplitude(
    comp.incluidas.map((i) => ({ nome: i.cap.nome, uf: i.cap.uf, valor: i.valor })),
    { medida, ano, etapa, disciplina: s.disc === "matematica" ? "Matemática" : "Língua Portuguesa" },
  );
  const subtitulo = [md.rotulo, unidade(medida, s.moeda), md.etapas ? nomeEtapa(dados, etapa) : null, medida === "saeb" ? (s.disc === "matematica" ? "Matemática" : "Língua Portuguesa") : null, periodo, `capitais estaduais${s.reg ? `, região ${dados.regioes[s.reg]}` : ""}, ${universoDaMedida(medida)}`].filter(Boolean).join(" · ");

  const alternarDestaque = (id: string) => {
    const novo = destacadas.includes(id) ? destacadas.filter((x) => x !== id) : [...destacadas, id].slice(-MAX_DESTAQUES);
    definir({ dest: novo });
  };
  const linhasTabela = [
    ...comp.incluidas.map((i) => [`${i.cap.nome} (${i.cap.uf})`, fmt(i.valor), i.ponto.nota ? "Incluída, com nota" : "Incluída"]),
    ...comp.excluidas.map((x) => [`${x.cap.nome} (${x.cap.uf})`, x.comValor && x.ponto.valor !== null ? fmt(x.ponto.valor) : "", x.comValor ? "Fora da comparação" : ROTULO_STATUS[x.status]]),
  ];
  const textoRazao =
    comp.ref && comp.ref.razaoAgregada !== null && (medida === "despesa_hab" || medida === "despesa_mat") ? (
      <>
        <span className="font-semibold">Razão agregada {formata(medida, comp.ref.razaoAgregada)}:</span> soma da despesa das {comp.ref.n} capitais ÷ soma {medida === "despesa_hab" ? "dos habitantes" : "das matrículas"} das mesmas {comp.ref.n}. É outra conta que a média simples.
      </>
    ) : undefined;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAviso("Link deste recorte copiado.");
    } catch {
      setAviso("Não foi possível copiar automaticamente. O endereço na barra do navegador reproduz este recorte.");
    }
  };

  return (
    <div>
      <header>
        <p className="rotulo text-obee-dark">Educação nas capitais</p>
        <h1 className="mt-3 font-serif text-[2.2rem] leading-[1.1] text-obee-tinta md:text-[3rem]">Comparar capitais</h1>
        <p className="mt-3 max-w-[38rem] text-lg leading-relaxed text-obee-tinta">As 26 capitais numa escala comum. Destaque até {MAX_DESTAQUES} sem perder o conjunto; ordene por valor se quiser.</p>
      </header>

      <section aria-labelledby="comparar-titulo" className="mt-10 border-t border-linha pt-10 md:mt-12">
        <p className="rotulo text-obee-dark">Comparação descritiva</p>
        <h2 id="comparar-titulo" className="mt-3 max-w-[42rem] font-serif text-[1.55rem] leading-[1.2] text-obee-tinta md:text-[2rem]">
          {titulo}
        </h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {subtitulo}. {fraseCobertura(comp.incluidas.length, comp.universo.length)}
        </p>
        {ehDespesa(medida) && (
          <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-obee-tinta" role="note">
            <span className="font-semibold">Perímetro.</span> <Siglas texto={textoPerimetroIntra(perimetroIntra(dados, ano), ano, medida)} />
          </p>
        )}

        <div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Selecao
            id="c-med"
            rotulo="Medida"
            ajuda="Qualquer indicador do painel."
            valor={medida}
            opcoes={MEDIDAS.map((m) => ({ v: m, t: MEDIDA[m].rotulo, grupo: GRUPO_MEDIDA[MEDIDA[m].familia] }))}
            aoMudar={(v) => definir({ med: v as MedidaId })}
          />
          <Selecao
            id="c-ano"
            rotulo={md.anos === "ideb" ? "Edição" : "Ano"}
            ajuda={md.anos === "financeiros" ? "Exercício financeiro." : md.anos === "ideb" ? "Edição bienal." : "Ano do Censo Escolar ou ano letivo."}
            valor={String(ano)}
            opcoes={[...anos].reverse().map((a) => ({ v: String(a), t: String(a) }))}
            aoMudar={(v) => definir({ ano: Number(v) })}
          />
          {temEtapa(medida) && (
            <Selecao
              id="c-etapa"
              rotulo="Etapa de ensino"
              ajuda="Só as etapas em que a medida existe."
              valor={etapa}
              opcoes={dados.etapas.filter((x) => md.etapas?.includes(x.id)).map((x) => ({ v: x.id, t: x.nome }))}
              aoMudar={(v) => definir({ etapa: v as EtapaId })}
            />
          )}
          <Selecao
            id="c-grupo"
            rotulo="Grupo de comparação"
            ajuda="Define a mediana, a média e os extremos do recorte."
            valor={s.reg}
            opcoes={[{ v: "", t: `Todas as capitais estaduais (${dados.capitais.length})` }, ...regioes.map((r) => ({ v: r.id, t: `Capitais da região ${r.nome} (${r.n})` }))]}
            aoMudar={(v) => definir({ reg: v })}
          />
          {ehDespesa(medida) && (
            <Alternancia
              rotulo="Valores"
              valor={s.moeda}
              opcoes={[
                { v: "nominal", t: "Nominais" },
                { v: "real", t: "Reais de 2025" },
              ]}
              aoMudar={(v) => definir({ moeda: v })}
            />
          )}
          {medida === "saeb" && (
            <Alternancia
              rotulo="Disciplina"
              valor={s.disc}
              opcoes={[
                { v: "matematica", t: "Matemática" },
                { v: "portugues", t: "Língua Portuguesa" },
              ]}
              aoMudar={(v) => definir({ disc: v })}
            />
          )}
        </div>

        <details className="mt-5 border-y border-linha">
          <summary className="flex min-h-[44px] cursor-pointer items-center gap-3 text-[0.95rem] text-obee-tinta">
            <span className="font-semibold">Destacar capitais</span>
            <span className="text-carvao-muted">{destacadas.length ? `${destacadas.length} de ${MAX_DESTAQUES}` : `até ${MAX_DESTAQUES}; clique para escolher`}</span>
          </summary>
          <fieldset className="pb-4">
            <legend className="sr-only">Escolha até {MAX_DESTAQUES} capitais para destacar</legend>
            <div className="mt-1 grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
              {dados.capitais.map((c) => {
                const marcada = destacadas.includes(c.id);
                return (
                  <label key={c.id} className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 px-1 text-sm text-obee-tinta focus-within:outline focus-within:outline-2 focus-within:outline-obee ${marcada ? "font-semibold" : ""}`}>
                    <input type="checkbox" checked={marcada} onChange={() => alternarDestaque(c.id)} className="h-4 w-4 accent-[var(--cor-obee)]" />
                    {c.nome} ({c.uf})
                  </label>
                );
              })}
            </div>
            {destacadas.length > 0 && (
              <button type="button" onClick={() => definir({ dest: [] })} className="rotulo mt-2 inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
                Limpar destaques
              </button>
            )}
            <p className="mt-1 text-xs text-carvao-muted">Ao marcar a sexta, a mais antiga sai do destaque. O destaque não retira nenhuma capital da comparação.</p>
          </fieldset>
        </details>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Alternancia
            rotulo="Forma de ver"
            rotuloVisivel={false}
            valor={s.vis}
            opcoes={[
              { v: "grafico", t: "Gráfico" },
              { v: "tabela", t: "Tabela completa" },
            ]}
            aoMudar={(v) => definir({ vis: v })}
          />
          {s.vis === "grafico" && (
            <Alternancia
              rotulo="Ordem das capitais"
              valor={s.ord}
              opcoes={[
                { v: "alfabetica", t: "Alfabética" },
                { v: "valor", t: "Crescente" },
                { v: "valor_desc", t: "Decrescente" },
              ]}
              aoMudar={(v) => definir({ ord: v })}
            />
          )}
          <button type="button" onClick={copiar} className="rotulo inline-flex min-h-[44px] items-center text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta">
            Copiar link deste recorte
          </button>
            <button type="button" onClick={() => baixar("obee_dicionario_das_colunas.csv", csv(["arquivo", "coluna", "descricao"], dicionarioExportacoes()))} className="rotulo inline-flex min-h-[44px] items-center text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta">
              Dicionário das colunas (CSV)
            </button>
        </div>
        <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm text-obee-dark">
          {aviso}
        </p>

        <div className="mt-4">
          {s.vis === "grafico" ? (
            comp.incluidas.length === 0 ? (
              <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">
                Nenhuma capital tem dado comparável para esta medida neste recorte. O motivo de cada capital está abaixo.
              </p>
            ) : (
              <>
                <DistribuicaoCapitais
                  titulo={`${md.rotulo}, ${periodo}`}
                  linhas={comp.incluidas.map((i) => ({ chave: i.cap.id, rotulo: `${i.cap.nome} (${i.cap.uf})`, valor: i.valor, destacada: destacadas.includes(i.cap.id) }))}
                  referencias={{
                    mediana: comp.ref?.mediana ?? null,
                    media: comp.ref?.media ?? null,
                    faixa: comp.ref && comp.ref.quartisExibicao && comp.ref.q1 !== null && comp.ref.q3 !== null ? { q1: comp.ref.q1, q3: comp.ref.q3 } : null,
                    externa,
                  }}
                  formata={fmt}
                  formataEixo={(v) => formataEixo(medida, v)}
                  zero={ehDespesa(medida) || medida === "matriculas" || medida === "conveniadas" || medida === "atu"}
                  rotuloGrupo={s.reg ? `capitais da região ${dados.regioes[s.reg]}` : "capitais na comparação"}
                  fora={linhasForaDoGrafico}
                />
                {comp.excluidas.length > 0 && (
                  <div className="mt-4">
                    <ForaDaComparacao itens={itensFora} />
                  </div>
                )}
                {comp.ref && (
                  <div className="mt-8">
                    <ReferenciasDoGrupo r={comp.ref} m={medida} textoRazao={textoRazao} />
                  </div>
                )}
              </>
            )
          ) : (
            <TabelaComparativa
              ix={ix}
              dados={dados}
              ano={ano}
              etapa={etapa}
              moeda={s.moeda}
              disc={s.disc}
              destacadas={destacadas}
              grupo={grupo}
              capGrupo={capGrupo}
              medida={medida}
              ordem={s.ot}
              decrescente={s.od === "desc"}
              visao={s.vc}
              aoOrdenar={(c) => definir(s.ot === c ? { od: s.od === "asc" ? "desc" : "asc" } : { ot: c, od: "asc" })}
              aoVisao={(v) => definir({ vc: v })}
              aoSelecionar={alternarDestaque}
              aoBaixar={() =>
                baixar(
                  `obee_tabela_comparativa_${ano}_${etapa}${s.moeda === "real" ? "_real" : "_nominal"}${s.disc === "portugues" ? "_portugues" : ""}${s.reg ? `_regiao_${s.reg}` : ""}.csv`,
                  csv(CABECALHO_CSV_TABELA_COMPARATIVA, linhasCsvTabelaComparativa(dados, tabelaComparativa(ix, ano, etapa, s.moeda, s.disc, grupo, capGrupo, medida), ano, etapa, s.moeda, grupo, capGrupo, medida, ix, s.disc)),
                )
              }
            />
          )}
        </div>
        {s.vis === "grafico" && comp.incluidas.length > 0 && (
          <div className="mt-6 space-y-3">
            <NotasMateriais notas={notas} n={comp.incluidas.length} />
            {comp.incluidas
              .filter((i) => destacadas.includes(i.cap.id))
              .map((i) => (
                <div key={i.cap.id}>
                  <p className="text-sm font-semibold text-obee-tinta">{i.cap.nome} ({i.cap.uf})</p>
                  <Ressalva ponto={i.ponto} />
                </div>
              ))}
          </div>
        )}
        {s.vis === "grafico" && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
            <SobreEsteDado f={dados.fichas.find((f) => f.id === md.indicador)!} ctx={contextos[md.indicador]} />
            <button
              type="button"
              onClick={() =>
                baixar(
                  `obee_comparacao_${medida}_${ano}${md.etapas ? `_${etapa}` : ""}${ehDespesa(medida) ? `_${s.moeda}` : ""}${medida === "saeb" ? `_${s.disc}` : ""}${s.reg ? `_regiao_${s.reg}` : ""}.csv`,
                  csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(dados, comp, medida, ano, etapa, s.moeda, s.disc)),
                )
              }
              className="rotulo inline-flex min-h-[44px] items-center text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta"
            >
              Baixar estes valores (CSV)
            </button>
          </div>
        )}
        {s.vis === "grafico" && (
          <details className="mt-4 text-sm">
            <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver os mesmos valores em tabela</summary>
            <TabelaSimples legenda={`${md.rotulo}, ${periodo}`} cabecalho={["Capital", unidade(medida, s.moeda), "Situação"]} linhas={linhasTabela} />
          </details>
        )}
      </section>
      <p className="mt-10 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
        Ordem por valor é escolha de quem lê e não é classificação de eficiência. Média e mediana descrevem o grupo e não são meta; menor gasto não demonstra eficiência e gasto maior não demonstra qualidade.
      </p>
    </div>
  );
}
