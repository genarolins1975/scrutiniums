"use client";

import { useMemo, useState } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CABECALHO_CSV_COMPARACAO,
  CABECALHO_CSV_SERIE,
  linhasCsvSerie,
  dicionarioExportacoes,
  Indice,
  MEDIDA,
  ROTULO_STATUS,
  anosDaMedida,
  comparar,
  componente,
  csv,
  ehDespesa,
  notasMateriais,
  perimetroIntra,
  referenciaExternaDoGrafico,
  regioesDoPainel,
  serieDaMediana,
  textoPerimetroIntra,
  etapaDaMedida,
  formata,
  formataEixo,
  internacionaisDa,
  linhasCsvComparacao,
  nacionalCalculada,
  nomeEtapa,
  referenciasExternas,
  rotuloPeriodoMedida,
  serie,
  unidade,
  type DadosPainel,
  type Disciplina,
  type Grupo,
  type MedidaId,
  type Moeda,
  type Ordem,
  type Ponto,
} from "@/lib/eficiencia/consulta";
import { fraseAmplitude, fraseCapital, fraseCobertura, fraseEvolucao } from "@/lib/eficiencia/frases";
import { inteiro } from "@/lib/eficiencia/formato";
import type { EtapaId, IndicadorId } from "@/lib/eficiencia/tipos";
import { avisoDoGrupo, NAO_MOSTRA, DEFINICAO_CURTA, DEFINICAO_TEMA, SEM_NACIONAL, universoDaMedida, anoValido, etapaEfetiva, temEtapa, type Tema } from "@/lib/eficiencia/visao";
import { ComposicaoDespesa, MatriculasPorEtapa, PonteDaRazao } from "./DetalhesMedida";
import { DistribuicaoCapitais } from "./DistribuicaoCapitais";
import type { ContextoFicha } from "./FichaConteudo";
import { ContextoInternacionalBloco, ReferenciaNacionalCalculadaBloco, ReferenciasDoGrupo, ReferenciasNacionais, SemReferencia } from "./ReferenciasPainel";
import { Siglas } from "./Siglas";
import { SobreEsteDado } from "./SobreEsteDado";
import { TabelaSimples } from "./TabelaSimples";
import { Alternancia, Selecao } from "./controles";
import { ForaDaComparacao, NotasMateriais, ForaDoEscopo, Ressalva, SemValor } from "./estados";
import { MiniSerie, type Anotacao } from "./graficos";

/**
 * Exploração de um tema (gastos, atendimento ou resultados): uma pergunta e uma visualização predominante por vez. A
 * família de medidas do tema fica lado a lado e legível; o gráfico, a tabela, a evolução e o detalhe mostram o mesmo
 * conjunto de dados, a escolha da pessoa. Controles só aparecem onde alteram o indicador. Tudo vive na URL.
 */

const ETAPAS: EtapaId[] = ["total", "creche", "pre_escola", "anos_iniciais", "anos_finais", "ensino_medio", "eja", "profissional"];
const PANDEMIA_IDEB: Anotacao = { ano: 2021, texto: "edição afetada pela pandemia de covid-19 (nota informativa do INEP sobre o Ideb 2021)." };
const PANDEMIA_APROVACAO: Anotacao = { ano: 2021, texto: "ano letivo afetado pela pandemia de covid-19, com regras excepcionais de avaliação em muitas redes." };

type Visao = "grafico" | "tabela" | "evolucao" | "detalhe";

function esquema(ids: string[], tema: Tema) {
  const def = DEFINICAO_TEMA[tema];
  return {
    cap: campo(tiposUrl.opcao(["", ...ids]), ""),
    med: campo(tiposUrl.opcao(def.medidas), def.medidaInicial),
    ano: campo(tiposUrl.inteiro({ min: 0, max: 2100 }), 0),
    etapa: campo(tiposUrl.opcao(ETAPAS), def.etapaInicial),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    disc: campo(tiposUrl.opcao(["matematica", "portugues"] as const), "matematica" as Disciplina),
    vis: campo(tiposUrl.opcao(["grafico", "tabela", "evolucao", "detalhe"] as const), "grafico" as Visao),
    ord: campo(tiposUrl.opcao(["alfabetica", "valor", "valor_desc"] as const), "alfabetica" as Ordem),
    eixo: campo(tiposUrl.opcao(["linear", "log"] as const), "linear" as "linear" | "log"),
    grp: campo(tiposUrl.opcao(["todas", "regiao"] as const), "todas" as Grupo),
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

const pontoVazio = (): Ponto => ({ valor: null, status: "AUSENTE_NA_COLETA", nota: null, notaMaterial: false, participacao: null, elegivel: false, situacao: null, motivo: null, quebraSerie: false });

const NOME_DETALHE: Partial<Record<MedidaId, string>> = { despesa: "Composição", despesa_mat: "Do total ao numerador", matriculas: "Por etapa" };

export function ExploradorTema({ tema, dados, contextos }: { tema: Tema; dados: DadosPainel; contextos: Record<string, ContextoFicha> }) {
  const def = DEFINICAO_TEMA[tema];
  const ix = useMemo(() => new Indice(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const esq = useMemo(() => esquema(ids, tema), [ids, tema]);
  const [s, definir] = useEstadoUrl(esq);
  const [aviso, setAviso] = useState("");
  const cap = dados.capitais.find((c) => c.id === s.cap) ?? null;
  const ficha = (id: IndicadorId) => dados.fichas.find((f) => f.id === id)!;

  const medida = s.med;
  const md = MEDIDA[medida];
  const etapa = etapaEfetiva(medida, s.etapa, def.etapaInicial);
  const anos = anosDaMedida(dados, medida);
  const ano = s.ano ? anoValido(dados, medida, s.ano) : anos[anos.length - 1];
  // o grupo regional é o da capital escolhida; sem capital, o grupo é sempre o das capitais estaduais
  const grupo: Grupo = cap && s.grp === "regiao" ? "regiao" : "todas";
  const grupoRef = grupo === "regiao" && cap ? cap.regiao : "todas";
  const nomeGrupo = grupo === "regiao" && cap ? `capitais da região ${dados.regioes[cap.regiao]}` : "capitais na comparação";
  const comp = comparar(ix, medida, ano, etapa, s.moeda, s.disc, grupo, cap ?? dados.capitais[0], s.ord);
  const itensFora = comp.excluidas.map((x) => ({ nome: x.cap.nome, uf: x.cap.uf, status: x.comValor ? "Fora da comparação" : ROTULO_STATUS[x.status], motivo: x.motivo }));
  const linhasForaDoGrafico = comp.excluidas.map((x) => ({
    chave: x.cap.id,
    rotulo: `${x.cap.nome} (${x.cap.uf})`,
    valor: x.comValor ? x.ponto.valor : null,
    texto: x.comValor ? "fora da comparação (motivo abaixo)" : `${ROTULO_STATUS[x.status].toLowerCase()} (motivo abaixo)`,
    destacada: x.cap.id === cap?.id,
  }));
  const k = componente(medida, s.moeda, s.disc);
  const e = etapaDaMedida(medida, etapa);
  const ptCap = cap ? ix.ponto(md.indicador, cap.cod, ano, e, k) : null;
  const incluidaCap = cap ? comp.incluidas.find((i) => i.cap.id === cap.id) : undefined;
  const fmt = (v: number) => formata(medida, v);
  const fmtEixo = (v: number) => formataEixo(medida, v);
  const nomeCap = cap ? `${cap.nome} (${cap.uf})` : "";

  const opcoesDetalhe = NOME_DETALHE[medida] ?? null;
  const visao: Visao = s.vis === "detalhe" && !opcoesDetalhe ? "grafico" : s.vis;

  // título comunicativo e subtítulo técnico, do recorte e só dos dados elegíveis
  const itensFrase = comp.incluidas.map((i) => ({ nome: i.cap.nome, uf: i.cap.uf, valor: i.valor }));
  const periodo = rotuloPeriodoMedida(medida, ano);
  const subtitulo = [
    md.rotulo,
    unidade(medida, s.moeda),
    md.etapas ? nomeEtapa(dados, etapa) : null,
    medida === "saeb" ? (s.disc === "matematica" ? "Matemática" : "Língua Portuguesa") : null,
    visao === "evolucao" ? `série de ${anos[0]} a ${anos[anos.length - 1]}` : periodo,
    `capitais estaduais${grupo === "regiao" && cap ? `, região ${dados.regioes[cap.regiao]}` : ""}, ${universoDaMedida(medida)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const titulo = fraseAmplitude(itensFrase, { medida, ano, etapa, disciplina: s.disc === "matematica" ? "Matemática" : "Língua Portuguesa" });
  const fraseCap = cap
    ? fraseCapital(cap.nome, cap.uf, ptCap?.valor ?? null, comp.ref?.mediana ?? null, comp.ref?.n ?? 0, medida, !!ptCap && ptCap.valor !== null && !incluidaCap)
    : null;

  // referências externas válidas
  const extComp = referenciasExternas(dados, medida, ano, etapa, k);
  const nacCalc = nacionalCalculada(dados, medida, ano);
  const intl = internacionaisDa(dados, medida, etapa);
  const externaGrafico = referenciaExternaDoGrafico(dados, medida, ano, etapa, k);
  const notas = notasMateriais(comp);

  const textoRazao = (() => {
    const r = comp.ref;
    if (!r || r.razaoAgregada === null || (medida !== "despesa_hab" && medida !== "despesa_mat")) return undefined;
    const den = medida === "despesa_hab" ? "dos habitantes" : "das matrículas";
    return (
      <>
        <span className="font-semibold">Razão agregada {formata(medida, r.razaoAgregada)}:</span> soma da despesa de {r.n} capitais ÷ soma {den} das mesmas {r.n} ({inteiro(r.somaDenominador ?? 0)}). Pesa cada capital pelo seu denominador; é outra conta
        que a média simples, que dá o mesmo peso a cada capital.
      </>
    );
  })();

  // evolução: a capital, quando escolhida; senão a mediana das capitais, ano a ano
  const medianaPorAno = serieDaMediana(ix, medida, etapa, s.moeda, s.disc, grupo === "regiao" && cap ? cap.regiao : null);
  const pontosSerie = cap
    ? serie(ix, medida, cap.cod, etapa, s.moeda, s.disc)
    : medianaPorAno.map((m) => ({ ano: m.ano, ...(m.valor === null ? pontoVazio() : { ...pontoVazio(), valor: m.valor, status: "OBSERVADO" as const, elegivel: true, quebraSerie: m.quebraSerie }) }));
  const anotacoes = medida === "aprovacao" ? [PANDEMIA_APROVACAO] : medida === "ideb" || medida === "saeb" ? [PANDEMIA_IDEB] : [];
  const fraseSerieBase = fraseEvolucao(
    pontosSerie.map((p) => ({ ano: p.ano, valor: p.valor, elegivel: p.elegivel, quebraSerie: p.quebraSerie })),
    medida,
    medida === "despesa_hab" ? "a população de referência muda de base (estimativa, Censo ou relação do DOU)" : "a base do dado mudou",
    cap ? `Em ${nomeCap}` : "Na mediana das capitais",
    anotacoes,
  );
  // mediana sem capital: o conjunto de capitais com valor muda de um ano para outro, e a frase precisa dizer isso
  const comValorNaSerie = medianaPorAno.filter((m) => m.valor !== null);
  const conjuntoVaria = !cap && comValorNaSerie.length > 1 && new Set(comValorNaSerie.map((m) => m.n)).size > 1;
  const fraseSerie =
    conjuntoVaria && !fraseSerieBase.startsWith("Entre ")
      ? `${fraseSerieBase} Cada mediana usa as capitais com valor comparável no ano (${comValorNaSerie.map((m) => `${m.n} em ${m.ano}`).join(", ")}): o conjunto muda, então a variação não é a de um grupo constante.`
      : fraseSerieBase;

  const linhasTabela = [
    ...comp.incluidas.map((i) => [`${i.cap.nome} (${i.cap.uf})`, fmt(i.valor), i.ponto.nota ? "Incluída, com nota" : "Incluída"]),
    ...comp.excluidas.map((x) => [`${x.cap.nome} (${x.cap.uf})`, x.comValor && x.ponto.valor !== null ? fmt(x.ponto.valor) : "", x.comValor ? "Fora da comparação" : ROTULO_STATUS[x.status]]),
  ];

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAviso("Link deste recorte copiado.");
    } catch {
      setAviso("Não foi possível copiar automaticamente. O endereço na barra do navegador reproduz este recorte.");
    }
  };
  const baixarCsvSerie = () =>
    baixar(`obee_${tema}_${medida}_serie_${cap ? cap.id : "mediana"}${md.etapas ? `_${etapa}` : ""}${ehDespesa(medida) ? `_${s.moeda}` : ""}${medida === "saeb" ? `_${s.disc}` : ""}.csv`, csv(CABECALHO_CSV_SERIE, linhasCsvSerie(dados, medida, etapa, s.moeda, s.disc, cap ?? null, pontosSerie, medianaPorAno)));
  const baixarCsv = () =>
    baixar(`obee_${tema}_${medida}_${ano}${md.etapas ? `_${etapa}` : ""}${ehDespesa(medida) ? `_${s.moeda}` : ""}${medida === "saeb" ? `_${s.disc}` : ""}${grupo === "regiao" && cap ? `_regiao_${cap.regiao}` : ""}.csv`, csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(dados, comp, medida, ano, etapa, s.moeda, s.disc)));

  const opcoesVisao: { v: Visao; t: string }[] = [
    { v: "grafico", t: "Gráfico" },
    { v: "tabela", t: "Tabela" },
    { v: "evolucao", t: "Evolução" },
    ...(opcoesDetalhe ? [{ v: "detalhe" as Visao, t: opcoesDetalhe }] : []),
  ];

  /* ---------- família de medidas do tema ---------- */
  const familia = def.medidas.map((m) => {
    const mm = MEDIDA[m];
    const et = etapaEfetiva(m, s.etapa, def.etapaInicial);
    const an = s.ano ? anoValido(dados, m, s.ano) : (() => { const a = anosDaMedida(dados, m); return a[a.length - 1]; })();
    const kk = componente(m, s.moeda, s.disc);
    const ee = etapaDaMedida(m, et);
    const r = ix.referencia(mm.indicador, kk, ee, an, grupoRef);
    const p = cap ? ix.ponto(mm.indicador, cap.cod, an, ee, kk) : null;
    return { m, mm, an, et, r, p };
  });

  return (
    <div>
      {/* abertura do tema */}
      <header>
        <p className="rotulo text-obee-dark">Educação nas capitais</p>
        <h1 className="mt-3 font-serif text-[2.2rem] leading-[1.1] text-obee-tinta md:text-[3rem]">{def.rotulo}</h1>
        <p className="mt-3 max-w-[38rem] text-lg leading-relaxed text-obee-tinta">{def.abertura}</p>
        <div className="mt-5 max-w-sm">
          <Selecao
            id="cap"
            rotulo="Capital"
            ajuda="Opcional. Mostra o valor da capital ao lado do conjunto e a destaca nos gráficos."
            valor={cap?.id ?? ""}
            opcoes={[{ v: "", t: "Nenhuma: ver o conjunto" }, ...dados.capitais.map((c) => ({ v: c.id, t: `${c.nome} (${c.uf})` }))]}
            aoMudar={(v) => definir({ cap: v })}
          />
        </div>
      </header>

      {/* família de medidas, lado a lado */}
      <section aria-labelledby="familia-titulo" className="mt-10 md:mt-12">
        <h2 id="familia-titulo" className="rotulo text-mineral">
          {tema === "gastos" ? "Três escalas do gasto" : tema === "atendimento" ? "Três medidas do atendimento" : "Três medidas de resultado"}
          {cap ? ` · ${nomeCap}` : " · mediana das capitais"}
        </h2>
        <fieldset className="mt-3 min-w-0">
          <legend className="sr-only">Escolha a medida que o gráfico mostra</legend>
          <div className="grid gap-px border border-linha bg-linha md:grid-cols-3">
            {familia.map((f) => {
              const ativa = f.m === medida;
              const valor = cap ? f.p : null;
              return (
                <label
                  key={f.m}
                  className={`relative flex min-h-[44px] cursor-pointer flex-col px-4 py-4 focus-within:outline focus-within:outline-2 focus-within:outline-obee ${ativa ? "bg-obee-fundo" : "bg-superficie hover:bg-papel"}`}
                >
                  <input type="radio" className="sr-only" name="medida-do-tema" value={f.m} checked={ativa} onChange={() => definir({ med: f.m, vis: "grafico" })} />
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`text-sm ${ativa ? "font-semibold" : ""} text-obee-tinta`}>
                      <span aria-hidden="true">{ativa ? "● " : "○ "}</span>
                      {DEFINICAO_CURTA[f.m].titulo}
                    </span>
                    <span className="rotulo !text-[0.66rem] text-carvao-muted">{f.mm.anos === "ideb" ? `edição ${f.an}` : f.an}</span>
                  </span>
                  <span className="mt-2 font-serif text-2xl tabular-nums text-obee-tinta">
                    {valor ? (valor.valor !== null ? formata(f.m, valor.valor) : "sem valor") : f.r?.mediana != null ? formata(f.m, f.r.mediana) : "sem valor"}
                  </span>
                  <span className="mt-0.5 text-xs leading-snug text-carvao-muted">
                    {valor
                      ? valor.valor === null
                        ? ROTULO_STATUS[valor.status]
                        : `${!valor.elegivel ? "Fora da comparação. " : ""}Mediana das capitais: ${f.r?.mediana != null ? formata(f.m, f.r.mediana) : "sem valor"}`
                      : f.r && f.r.minimo !== null && f.r.maximo !== null
                        ? `Mediana de ${f.r.n} capitais · de ${formata(f.m, f.r.minimo)} a ${formata(f.m, f.r.maximo)}`
                        : "Nenhuma capital com dado comparável"}
                  </span>
                  <span className="mt-2 text-xs leading-snug text-obee-tinta">{DEFINICAO_CURTA[f.m].texto}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* visualização principal */}
      <section aria-labelledby="visao-titulo" className="mt-14 border-t border-linha pt-10 md:mt-16 md:pt-12" id="visao">
        <p className="rotulo text-obee-dark">{def.pergunta}</p>
        <h2 id="visao-titulo" className="mt-3 max-w-[42rem] font-serif text-[1.55rem] leading-[1.2] text-obee-tinta md:text-[2rem]">
          {visao === "evolucao" ? fraseSerie : visao === "detalhe" ? `${DEFINICAO_CURTA[medida].titulo}: ${opcoesDetalhe?.toLowerCase()}${cap ? `, ${nomeCap}` : ""}` : titulo}
        </h2>
        <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {subtitulo}.{visao === "evolucao" ? "" : ` ${fraseCobertura(comp.incluidas.length, comp.universo.length)}`}
        </p>
        {ehDespesa(medida) && (
          <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-obee-tinta" role="note">
            <span className="font-semibold">Perímetro.</span> <Siglas texto={`${textoPerimetroIntra(perimetroIntra(dados, ano), ano, medida)} A parcela de cada capital está na tabela completa de Comparar capitais e no CSV.`} />
          </p>
        )}
        {fraseCap && visao !== "evolucao" && visao !== "detalhe" && <p className="mt-3 max-w-prose2 text-[0.95rem] leading-relaxed text-obee-tinta">{fraseCap}</p>}

        {/* controles locais, junto do gráfico */}
        <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className={`w-full min-w-0 sm:w-44 ${visao === "evolucao" ? "hidden" : ""}`}>
            <Selecao
              id="f-ano"
              rotulo={md.anos === "ideb" ? "Edição" : "Ano"}
              ajuda={md.anos === "financeiros" ? "Exercício financeiro." : md.anos === "ideb" ? "Edição bienal." : medida === "aprovacao" ? "Ano letivo." : "Ano do Censo Escolar."}
              valor={String(ano)}
              opcoes={[...anos].reverse().map((a) => ({ v: String(a), t: String(a) }))}
              aoMudar={(v) => definir({ ano: Number(v) })}
            />
          </div>
          <div className="w-full min-w-0 sm:w-72">
            <Selecao
              id="f-grupo"
              rotulo="Grupo de comparação"
              ajuda="Define a mediana, a média e os extremos do recorte."
              valor={grupo}
              opcoes={[
                { v: "todas", t: `Todas as capitais estaduais (${dados.capitais.length})` },
                {
                  v: "regiao",
                  t: cap ? `Capitais da região ${dados.regioes[cap.regiao]} (${regioesDoPainel(dados).find((r) => r.id === cap.regiao)?.n ?? 0})` : "Região da capital escolhida (escolha uma capital)",
                  desab: !cap,
                },
              ]}
              aoMudar={(v) => definir({ grp: v as Grupo })}
            />
          </div>
          {temEtapa(medida) && visao !== "detalhe" && (
            <div className="w-full min-w-0 sm:w-72">
              <Selecao
                id="f-etapa"
                rotulo="Etapa de ensino"
                ajuda="Só as etapas em que esta medida existe."
                valor={etapa}
                opcoes={dados.etapas.filter((x) => md.etapas?.includes(x.id)).map((x) => ({ v: x.id, t: x.nome }))}
                aoMudar={(v) => definir({ etapa: v as EtapaId })}
              />
            </div>
          )}
          {ehDespesa(medida) && visao !== "detalhe" && (
            <Alternancia
              rotulo="Valores"
              valor={s.moeda}
              opcoes={[
                { v: "nominal", t: "Nominais" },
                { v: "real", t: "Reais de 2025 (IPCA)" },
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
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Alternancia rotulo="Forma de ver" rotuloVisivel={false} valor={visao} opcoes={opcoesVisao} aoMudar={(v) => definir({ vis: v })} />
          {visao === "grafico" && (
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
          {visao === "grafico" && s.ord !== "alfabetica" && <p className="max-w-xs text-xs leading-snug text-carvao-muted">A ordem por valor organiza a leitura; não classifica as capitais.</p>}
          {visao === "grafico" && medida === "despesa" && (
            <Alternancia
              rotulo="Escala do eixo"
              rotuloVisivel={false}
              valor={s.eixo}
              opcoes={[
                { v: "linear", t: "Escala linear" },
                { v: "log", t: "Escala logarítmica" },
              ]}
              aoMudar={(v) => definir({ eixo: v })}
            />
          )}
        </div>

        <div className="mt-6" aria-live="polite">
          {visao === "grafico" &&
            (comp.incluidas.length === 0 ? (
              <ForaDoEscopo texto={`Nenhuma capital tem dado comparável para ${md.rotulo.toLowerCase()} neste recorte. O motivo de cada capital está abaixo.`} />
            ) : (
              <DistribuicaoCapitais
                titulo={`${md.rotulo}, ${periodo}`}
                linhas={comp.incluidas.map((i) => ({ chave: i.cap.id, rotulo: `${i.cap.nome} (${i.cap.uf})`, valor: i.valor, destacada: i.cap.id === cap?.id }))}
                referencias={{
                  mediana: comp.ref?.mediana ?? null,
                  media: comp.ref?.media ?? null,
                  faixa: comp.ref && comp.ref.quartisExibicao && comp.ref.q1 !== null && comp.ref.q3 !== null ? { q1: comp.ref.q1, q3: comp.ref.q3 } : null,
                  externa: externaGrafico,
                }}
                formata={fmt}
                formataEixo={fmtEixo}
                zero={ehDespesa(medida) || medida === "matriculas" || medida === "conveniadas" || medida === "atu"}
                escala={medida === "despesa" ? s.eixo : "linear"}
                rotuloGrupo={nomeGrupo}
                fora={linhasForaDoGrafico}
              />
            ))}
          {visao === "grafico" && comp.excluidas.length > 0 && (
            <div className="mt-4">
              <ForaDaComparacao itens={itensFora} />
            </div>
          )}
          {visao === "grafico" && comp.incluidas.length > 0 && notas.length > 0 && (
            <div className="mt-4">
              <NotasMateriais notas={notas} n={comp.incluidas.length} />
            </div>
          )}
          {visao === "tabela" &&
            (linhasTabela.length === 0 ? null : (
              <TabelaSimples legenda={`${md.rotulo}, ${periodo}: valor de cada capital e situação na comparação`} cabecalho={["Capital", unidade(medida, s.moeda), "Situação"]} linhas={linhasTabela} />
            ))}
          {visao === "evolucao" && (
            <div className="max-w-3xl">
              <MiniSerie
                titulo={`${md.rotulo}${cap ? `, ${nomeCap}` : ", mediana das capitais"}`}
                pontos={pontosSerie}
                formata={fmt}
                formataEixo={fmtEixo}
                zero={ehDespesa(medida) || medida === "matriculas" || medida === "conveniadas" || medida === "atu"}
                anotacoes={anotacoes}
                referencia={cap ? medianaPorAno : undefined}
                rotuloReferencia="Mediana das capitais"
                altura={260}
              />
              {ehDespesa(medida) && s.moeda === "nominal" && (
                <p className="mt-3 max-w-prose2 text-xs leading-snug text-carvao-muted" role="note">
                  Valores em reais correntes: cada ano a preços do próprio ano, o que inclui o efeito da inflação. Para ler a mudança em termos reais, escolha “Reais de 2025 (IPCA)” em Valores.
                </p>
              )}
              {!cap && <p className="mt-3 text-xs leading-snug text-carvao-muted">Sem capital escolhida, a linha é a mediana das capitais em cada ano; o número de capitais na comparação pode mudar de um ano para outro.</p>}
              <details className="mt-2 text-sm">
                <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
                <TabelaSimples
                  legenda={`${md.rotulo}${cap ? `, ${nomeCap}` : ", mediana das capitais"}`}
                  cabecalho={["Ano", "Valor", "Estado do dado"]}
                  linhas={pontosSerie.map((p) => [String(p.ano), p.valor !== null ? fmt(p.valor) : "", ROTULO_STATUS[p.status]])}
                />
              </details>
            </div>
          )}
          {visao === "detalhe" &&
            (!cap ? (
              <p className="max-w-prose2 text-[0.95rem] leading-relaxed text-obee-tinta">Escolha uma capital no campo “Capital”, no alto da página, para ver este detalhe.</p>
            ) : medida === "despesa" ? (
              <ComposicaoDespesa ix={ix} cap={cap} ano={ano} ficha={ficha("edu.despesa.subfuncao")} ctx={contextos["edu.despesa.subfuncao"]} />
            ) : medida === "despesa_mat" ? (
              <PonteDaRazao ix={ix} cap={cap} ano={ano} razao={ptCap ?? pontoVazio()} ficha={ficha("edu.despesa.ponte_matricula")} ctx={contextos["edu.despesa.ponte_matricula"]} />
            ) : (
              <MatriculasPorEtapa ix={ix} cap={cap} ano={ano} ficha={ficha("edu.matriculas.rede_municipal")} ctx={contextos["edu.matriculas.rede_municipal"]} />
            ))}
        </div>

        {/* ressalva da capital escolhida, junto do dado */}
        {ptCap && ptCap.valor !== null && visao !== "detalhe" && <Ressalva ponto={ptCap} />}
        {cap && ptCap && ptCap.valor === null && visao !== "detalhe" && <SemValor ponto={ptCap} />}

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1">
          <SobreEsteDado f={ficha(md.indicador)} ctx={contextos[md.indicador]} />
          <button type="button" onClick={copiar} className="rotulo inline-flex min-h-[44px] items-center text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta">
            Copiar link deste recorte
          </button>
          {visao === "grafico" || visao === "tabela" ? (
            <button type="button" onClick={baixarCsv} className="rotulo inline-flex min-h-[44px] items-center text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta">
              Baixar estes valores (CSV)
            </button>
          ) : null}
          {visao === "evolucao" ? (
            <button type="button" onClick={baixarCsvSerie} className="rotulo inline-flex min-h-[44px] items-center text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta">
              Baixar esta série (CSV)
            </button>
          ) : null}
          {visao === "grafico" || visao === "tabela" || visao === "evolucao" ? (<button type="button" onClick={() => baixar("obee_dicionario_das_colunas.csv", csv(["arquivo", "coluna", "descricao"], dicionarioExportacoes()))} className="rotulo inline-flex min-h-[44px] items-center text-obee-dark underline decoration-obee/40 underline-offset-4 hover:text-obee-tinta">
              Dicionário das colunas (CSV)
            </button>
          ) : null}
        </div>
        <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm text-obee-dark">
          {aviso}
        </p>

        {comp.excluidas.length > 0 && visao !== "detalhe" && visao !== "grafico" && (
          <div className="mt-4">
            <ForaDaComparacao itens={itensFora} />
          </div>
        )}
      </section>

      {/* referências do grupo, nacionais e internacionais */}
      <section aria-labelledby="refs-titulo" className="mt-14 border-t border-linha pt-10 md:mt-16 md:pt-12">
        <h2 id="refs-titulo" className="font-serif text-2xl text-obee-tinta md:text-[1.75rem]">
          Referências para ler o número
        </h2>
        <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          {visao === "evolucao" ? `As referências valem para ${periodo}. ` : ""}
          {avisoDoGrupo(medida)}
        </p>
        <div className="mt-6">
          {comp.ref ? <ReferenciasDoGrupo r={comp.ref} m={medida} textoRazao={textoRazao} /> : <SemReferencia medida={medida} motivo="Escolha uma etapa e um ano em que a medida exista para ver as referências do grupo." />}
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-obee-tinta">Referência nacional</h3>
            <div className="mt-3 space-y-4">
              {extComp.length > 0 && <ReferenciasNacionais externas={extComp} valor={incluidaCap?.valor ?? null} m={medida} nomeCapital={nomeCap || "A capital"} />}
              {nacCalc && <ReferenciaNacionalCalculadaBloco referencia={nacCalc} valor={incluidaCap?.valor ?? null} elegivel={!!incluidaCap} nomeCapital={nomeCap || "A capital"} completo />}
              {extComp.length === 0 && !nacCalc && <SemReferencia medida={medida} motivo={SEM_NACIONAL[medida]} />}
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-obee-tinta">Contexto internacional (outro universo, sem comparação direta)</h3>
            <div className="mt-3">
              {intl.length ? (
                <ContextoInternacionalBloco grupos={intl} anoPainel={ano} />
              ) : (
                <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">Não há contexto internacional comparável para esta medida: país e município são escalas diferentes e os conceitos não coincidem.</p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-10 max-w-prose2 border-t border-linha pt-5" role="note">
          <h3 className="font-semibold text-obee-tinta">O que este painel não mostra</h3>
          <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{NAO_MOSTRA[tema]}</p>
        </div>
      </section>
    </div>
  );
}
