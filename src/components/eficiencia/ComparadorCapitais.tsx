"use client";

import { useMemo, useState } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { Controles, FiguraAnalitica } from "@/components/painel";
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
import { provenienciaDaFicha, type FonteFicha } from "@/lib/eficiencia/proveniencia";
import type { EtapaId } from "@/lib/eficiencia/tipos";
import { anoValido, DEFINICAO_CURTA, etapaEfetiva, temEtapa, universoDaMedida } from "@/lib/eficiencia/visao";
import { DistribuicaoCapitais } from "./DistribuicaoCapitais";
import { useBaseEducacao } from "./ExploradorTema";
import { ReferenciasDoGrupo } from "./ReferenciasPainel";
import { TabelaComparativa, type VisaoColunas } from "./TabelaComparativa";
import { Alternancia, Selecao } from "./controles";
import { Siglas } from "./Siglas";
import { ForaDaComparacao, NotasMateriais, Ressalva } from "./estados";
import type { ContextoFicha } from "./FichaConteudo";
import { SobreEsteDado } from "./SobreEsteDado";

/**
 * Comparador: visão de conjunto das 26 capitais, com poucas cidades destacadas sem tirar o contexto do grupo. Gráfico e
 * tabela mostram o mesmo recorte. A ordem por valor é pedido de quem lê e não é classificação de eficiência. A tabela
 * completa conserva população, matrículas, despesa total e razões; as colunas de resultado seguem a etapa escolhida.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026) são duas ilhas de cliente que leem o mesmo recorte da URL e a mesma
 * base (ProvedorEducacao): a figura da comparação (ComparadorCapitais, na fatia de figuras) e a tabela completa (TabelaComparativaPainel, na
 * fatia de tabelas). Antes, uma alternância "Forma de ver" mostrava uma ou outra; agora as duas ficam na página, e o parâmetro ?vis= dos
 * links antigos continua aceito e é ignorado.
 */

const ETAPAS: EtapaId[] = ["total", "creche", "pre_escola", "anos_iniciais", "anos_finais", "ensino_medio", "eja", "profissional"];
const MAX_DESTAQUES = 5;
const GRUPO_MEDIDA: Record<string, string> = { recursos: "Gastos", atendimento: "Atendimento", resultado: "Resultados" };

function esquema(ids: string[], regioes: string[]) {
  return {
    cap: campo(tiposUrl.opcao(["", ...ids]), ""),
    reg: campo(tiposUrl.opcao(["", ...regioes]), ""),
    med: campo(tiposUrl.opcao(MEDIDAS), "despesa_hab" as MedidaId),
    ano: campo(tiposUrl.inteiro({ min: 0, max: 2100 }), 0),
    etapa: campo(tiposUrl.opcao(ETAPAS), "anos_iniciais" as EtapaId),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    disc: campo(tiposUrl.opcao(["matematica", "portugues"] as const), "matematica" as Disciplina),
    vis: campo(tiposUrl.opcao(["grafico", "tabela"] as const), "grafico" as "grafico" | "tabela"),
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

/** O recorte em vigor (na URL) e o que dele se calcula: o mesmo para a figura e para a tabela comparativa, que são ilhas separadas. */
function useRecorteComparar(dados: DadosPainel) {
  const ix = useMemo(() => new Indice(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const regioes = useMemo(() => regioesDoPainel(dados), [dados]);
  const esq = useMemo(() => esquema(ids, regioes.map((r) => r.id)), [ids, regioes]);
  const [s, definir] = useEstadoUrl(esq);
  const medida = s.med;
  const etapa = etapaEfetiva(medida, s.etapa, "anos_iniciais");
  const anos = anosDaMedida(dados, medida);
  const ano = s.ano ? anoValido(dados, medida, s.ano) : anos[anos.length - 1];
  // a capital escolhida em outra visão (?cap=) entra como destaque inicial; escolher destaques aqui prevalece
  const destacadas = s.dest.length ? s.dest.filter((id) => ids.includes(id)) : s.cap && ids.includes(s.cap) ? [s.cap] : [];
  // grupo de comparação: todas as capitais ou as de uma região; a mediana, a média e os extremos seguem o grupo
  const grupo: Grupo = s.reg ? "regiao" : "todas";
  const capGrupo = (s.reg && dados.capitais.find((c) => c.regiao === s.reg)) || dados.capitais[0];
  const alternarDestaque = (id: string) => {
    const novo = destacadas.includes(id) ? destacadas.filter((x) => x !== id) : [...destacadas, id].slice(-MAX_DESTAQUES);
    definir({ dest: novo });
  };
  return { ix, regioes, s, definir, medida, etapa, anos, ano, destacadas, grupo, capGrupo, alternarDestaque };
}

const botao = "rotulo inline-flex min-h-[44px] items-center text-obee-dark underline decoration-linha underline-offset-4 hover:text-obee-tinta";

/**
 * A comparação das capitais: os controles do recorte (medida, ano, etapa, grupo, valores, disciplina, ordem e destaques) logo antes da
 * figura, e a distribuição das 26 capitais numa FiguraAnalitica, com a tabela dos mesmos valores como tabela equivalente, as capitais fora
 * da comparação, as referências do grupo, as ressalvas das destacadas, a ficha, o link do recorte e os arquivos.
 */
export function ComparadorCapitais({ dados: dadosProp, contextos }: { dados?: DadosPainel; contextos: Record<string, ContextoFicha> }) {
  const dados = useBaseEducacao(dadosProp);
  const { ix, regioes, s, definir, medida, etapa, anos, ano, destacadas, grupo, capGrupo, alternarDestaque } = useRecorteComparar(dados);
  const [aviso, setAviso] = useState("");
  const md = MEDIDA[medida];
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
  const linhasTabela = [
    ...comp.incluidas.map((i) => [`${i.cap.nome} (${i.cap.uf})`, fmt(i.valor), i.ponto.nota ? "Incluída, com nota" : "Incluída"]),
    ...comp.excluidas.map((x) => [`${x.cap.nome} (${x.cap.uf})`, x.comValor && x.ponto.valor !== null ? fmt(x.ponto.valor) : null, x.comValor ? "Fora da comparação" : ROTULO_STATUS[x.status]]),
  ];
  const textoRazao =
    comp.ref && comp.ref.razaoAgregada !== null && (medida === "despesa_hab" || medida === "despesa_mat") ? (
      <>
        <span className="font-semibold">Razão agregada {formata(medida, comp.ref.razaoAgregada)}:</span> soma da despesa das {comp.ref.n} capitais ÷ soma {medida === "despesa_hab" ? "dos habitantes" : "das matrículas"} das mesmas {comp.ref.n}. É outra conta que a média simples.
      </>
    ) : undefined;
  const fontes: Record<string, FonteFicha> = useMemo(
    () => Object.fromEntries(Object.entries(dados.fontes).map(([id, f]) => [id, { nome: `${f.instituicao}, ${f.conjunto}`, orgao: f.instituicao, conjunto: f.conjunto, url: f.pagina, capturado_em: f.capturado_em }])),
    [dados],
  );
  const ficha = dados.fichas.find((f) => f.id === md.indicador)!;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAviso("Link deste recorte copiado.");
    } catch {
      setAviso("Não foi possível copiar automaticamente. O endereço na barra do navegador reproduz este recorte.");
    }
  };
  const resumo = [
    md.rotulo,
    md.etapas ? nomeEtapa(dados, etapa) : null,
    medida === "saeb" ? (s.disc === "matematica" ? "Matemática" : "Língua Portuguesa") : null,
    periodo,
    ehDespesa(medida) ? (s.moeda === "real" ? "reais de 2025" : "valores nominais") : null,
    s.reg ? `região ${dados.regioes[s.reg]}` : null,
    destacadas.length ? `${destacadas.length} ${destacadas.length === 1 ? "capital destacada" : "capitais destacadas"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Controles rotulo="Recorte da comparação" resumo={`Mostrando: ${resumo}.`} idioma="pt">
        <div className="grid w-full gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>
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
        <details className="w-full border-y border-linha">
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
      </Controles>

      <FiguraAnalitica
        id="comparacao"
        idioma="pt"
        pergunta={titulo}
        subtitulo={`${subtitulo}. ${fraseCobertura(comp.incluidas.length, comp.universo.length)}`}
        natureza={ficha.natureza}
        proveniencia={provenienciaDaFicha(ficha, fontes, { inicio: String(anos[0]), fim: String(ano) })}
        ressalva={ehDespesa(medida) ? <Siglas texto={textoPerimetroIntra(perimetroIntra(dados, ano), ano, medida)} /> : undefined}
        tabela={{ colunas: ["Capital", unidade(medida, s.moeda), "Situação"], linhas: linhasTabela, titulo: `${md.rotulo}, ${periodo}`, limite: linhasTabela.length }}
        comoInterpretar={<Siglas texto={DEFINICAO_CURTA[medida].texto} />}
        naoConcluir="Ordem por valor é escolha de quem lê e não é classificação de eficiência. Média e mediana descrevem o grupo e não são meta; menor gasto não demonstra eficiência e gasto maior não demonstra qualidade."
        complemento={
          <>
            {comp.excluidas.length > 0 && <ForaDaComparacao itens={itensFora} />}
            {comp.ref && <ReferenciasDoGrupo r={comp.ref} m={medida} textoRazao={textoRazao} />}
            {comp.incluidas.length > 0 && <NotasMateriais notas={notas} n={comp.incluidas.length} />}
            {comp.incluidas
              .filter((i) => destacadas.includes(i.cap.id))
              .map((i) => (
                <div key={i.cap.id}>
                  <p className="text-sm font-semibold text-obee-tinta">
                    {i.cap.nome} ({i.cap.uf})
                  </p>
                  <Ressalva ponto={i.ponto} />
                </div>
              ))}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <SobreEsteDado f={ficha} ctx={contextos[md.indicador]} />
              <button type="button" onClick={copiar} className={botao}>
                Copiar link deste recorte
              </button>
              <button
                type="button"
                onClick={() =>
                  baixar(
                    `obee_comparacao_${medida}_${ano}${md.etapas ? `_${etapa}` : ""}${ehDespesa(medida) ? `_${s.moeda}` : ""}${medida === "saeb" ? `_${s.disc}` : ""}${s.reg ? `_regiao_${s.reg}` : ""}.csv`,
                    csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(dados, comp, medida, ano, etapa, s.moeda, s.disc)),
                  )
                }
                className={botao}
              >
                Baixar estes valores (CSV)
              </button>
              <button type="button" onClick={() => baixar("obee_dicionario_das_colunas.csv", csv(["arquivo", "coluna", "descricao"], dicionarioExportacoes()))} className={botao}>
                Dicionário das colunas (CSV)
              </button>
            </div>
            <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm text-obee-dark">
              {aviso}
            </p>
          </>
        }
      >
        {comp.incluidas.length === 0 ? (
          <p data-grafico="sem-comparacao" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">
            Nenhuma capital tem dado comparável para esta medida neste recorte. O motivo de cada capital está abaixo.
          </p>
        ) : (
          // a distribuição tem mediana, média, faixa central e referência externa, formas que o kit não tem: fica a de domínio, marcada como legada
          <div data-figura-legado="distribuicao-capitais">
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
          </div>
        )}
      </FiguraAnalitica>
    </>
  );
}

/** A tabela completa das capitais, na fatia de tabelas, com o mesmo recorte da figura (medida, ano, etapa, valores, disciplina, grupo e destaques). */
export function TabelaComparativaPainel({ dados: dadosProp }: { dados?: DadosPainel }) {
  const dados = useBaseEducacao(dadosProp);
  const { ix, s, definir, medida, etapa, ano, destacadas, grupo, capGrupo, alternarDestaque } = useRecorteComparar(dados);
  return (
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
      aoOrdenar={(c, desc) => definir({ ot: c, od: desc ? "desc" : "asc" })}
      aoVisao={(v) => definir({ vc: v })}
      aoSelecionar={alternarDestaque}
      aoBaixar={() =>
        baixar(
          `obee_tabela_comparativa_${ano}_${etapa}${s.moeda === "real" ? "_real" : "_nominal"}${s.disc === "portugues" ? "_portugues" : ""}${s.reg ? `_regiao_${s.reg}` : ""}.csv`,
          csv(CABECALHO_CSV_TABELA_COMPARATIVA, linhasCsvTabelaComparativa(dados, tabelaComparativa(ix, ano, etapa, s.moeda, s.disc, grupo, capGrupo, medida), ano, etapa, s.moeda, grupo, capGrupo, medida, ix, s.disc)),
        )
      }
    />
  );
}
