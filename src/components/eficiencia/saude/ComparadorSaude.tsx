"use client";

import { useEffect, useMemo, type ReactElement } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { Controles, FaixaNumeros, FiguraAnalitica, LeituraGuiada, NumeroIndicador, TabelaDados, type NumeroProps } from "@/components/painel";
import { CABECALHO_CSV_COMPARACAO, denominadoresIcsapIguais, IndiceSaude, RESSALVA_CSV, ROTULO_ESTADO, anosDaMedida, avisoDoPeriodo, comparar, componenteDe, csv, linhasCsvComparacao, metaCsv, serie, type Ponto } from "@/lib/eficiencia/saude/consulta";
import { fraseDiferenca, posicaoNaMediana, resumoDoRecorte } from "@/lib/eficiencia/saude/frases";
import type { DadosSaude } from "@/lib/eficiencia/saude/payload";
import { MEDIDAS_ORDEM, MEDIDAS_SAUDE, ROTULO_PERIODO, TEMAS_SAUDE, periodoCurto, type MedidaSaudeId, type Moeda } from "@/lib/eficiencia/saude/medidas";
import { CAMINHO_METODOS, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import { provenienciaDaFicha } from "@/lib/eficiencia/proveniencia";
import type { ContextoFicha } from "../FichaConteudo";
import { DistribuicaoCapitais } from "../DistribuicaoCapitais";
import { SobreDadoSaude as SobreEsteDado } from "./SobreDadoSaude";
import { Alternancia, Selecao } from "../controles";
import { Ressalva } from "../estados";
import { Siglas } from "../Siglas";
import { AjudaDenominador, AjudaMoeda, AvisoDoPeriodo, EtiquetaDePerimetro, ForaDaComparacaoSaude, PERIMETRO_DO_TEMA } from "./AvisosSaude";
import { useBaseSaude } from "./ExploradorSaude";
import { MiniSerie } from "../graficos";

/**
 * Comparar capitais: a mesma medida e o mesmo período para duas capitais lado a lado, a distribuição das 26 e a tabela completa com todas as medidas do
 * mesmo ano. Nada muda de competência entre uma capital e outra; a diferença é descritiva, sem classificação.
 *
 * No molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026) a página é feita de três ilhas de cliente que leem o mesmo recorte da URL e a
 * mesma base (ProvedorSaude): a faixa de números (a mediana e as capitais A e B, antes cartões), as figuras (os controles do recorte logo antes da
 * distribuição das capitais e a evolução das escolhidas) e a tabela completa (TabelaCompletaSaude), com a ordem nos controles do kit (?ord= e ?dir=,
 * como antes) em vez dos botões no título de cada coluna.
 */

type Colunas = MedidaSaudeId | "alfabetica";

function esquema(ids: string[]) {
  return {
    cap: campo(tiposUrl.opcao(["", ...ids]), ""),
    vs: campo(tiposUrl.opcao(["", ...ids]), ""),
    med: campo(tiposUrl.opcao(MEDIDAS_ORDEM), "despesa_hab" as MedidaSaudeId),
    ano: campo(tiposUrl.inteiro({ min: 0, max: 2100 }), 0),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    den: campo(tiposUrl.opcao(["ripsa", "obee"] as const), "ripsa" as "ripsa" | "obee"),
    ord: campo(tiposUrl.opcao(["alfabetica", ...MEDIDAS_ORDEM] as const), "alfabetica" as Colunas),
    dir: campo(tiposUrl.opcao(["cres", "desc"] as const), "cres" as "cres" | "desc"),
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

const GRUPO_MEDIDA: Record<string, string> = { gastos: "Gastos", rede: "Rede e atenção primária", resultados: "Atendimento e resultados" };
const TEMAS_ORDEM = ["gastos", "rede", "resultados"] as const;
const botao = "rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-obee-dark hover:border-obee";

/** O recorte em vigor e o que dele se calcula: a mesma regra para a faixa, as figuras, a tabela e os CSV. */
function useRecorteComparar(dados: DadosSaude) {
  const ix = useMemo(() => new IndiceSaude(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const esq = useMemo(() => esquema(ids), [ids]);
  const [s, definir] = useEstadoUrl(esq);
  const m = MEDIDAS_SAUDE[s.med];
  const o = { moeda: s.moeda, denominador: s.den };
  const comp = componenteDe(m, o);
  const anos = anosDaMedida(ix, m, o);
  const ano = s.ano && anos.includes(s.ano) ? s.ano : anos[anos.length - 1];
  const A = dados.capitais.find((c) => c.id === s.cap) ?? null;
  const B = dados.capitais.find((c) => c.id === s.vs) ?? null;
  const c = comparar(ix, m, ano, o, "todas", A, "alfabetica");
  const periodo = ROTULO_PERIODO[m.periodo](ano);
  const ficha = dados.fichas.find((f) => f.id === m.indicador)!;
  const pa = A ? ix.ponto(m.indicador, A.cod, ano, comp) : null;
  const pb = B ? ix.ponto(m.indicador, B.cod, ano, comp) : null;
  return { ix, s, definir, m, o, anos, ano, A, B, c, periodo, ficha, pa, pb };
}

const naComparacao = (p: Ponto | null) => !!p && p.status === "OBSERVADO" && p.valor !== null && p.elegivel;
const formatoDe = (unidade: string): "reais" | "percentual" | "decimal" => (unidade.startsWith("R$") ? "reais" : unidade.startsWith("%") ? "percentual" : "decimal");

/** A faixa de números: a mediana das capitais e, quando escolhidas, as capitais A e B (antes cartões ao lado do gráfico). */
export function FaixaCompararSaude({ dados: dadosProp }: { dados?: DadosSaude }) {
  const dados = useBaseSaude(dadosProp);
  const { m, s, c, A, B, pa, pb, periodo, ficha } = useRecorteComparar(dados);
  const unidade = m.unidade(s.moeda);
  const formato = formatoDe(unidade);
  const fonte = dados.fontes[ficha.fontes[0]]?.nome ?? ficha.fontes[0];
  const mediana = c.ref?.mediana ?? null;
  const capital = (cap: NonNullable<typeof A>, p: Ponto | null): NumeroProps => {
    const rotulo = `${cap.nome} (${cap.uf})`;
    // sem valor: o estado e o motivo do dado (antes, o aviso SemValor no cartão), nunca zero
    if (!p || p.valor === null) return { rotulo, valor: null, motivoAusencia: `${ROTULO_ESTADO[p?.status ?? "AUSENTE_NA_COLETA"]}. ${p?.nota ?? "Sem valor para este recorte."}`, unidade, periodo, fonte, natureza: ficha.natureza };
    const dentro = naComparacao(p);
    return {
      rotulo,
      valor: p.valor,
      valorTexto: m.formata(p.valor),
      formato,
      unidade,
      periodo,
      fonte,
      natureza: ficha.natureza,
      nota: (
        <>
          <p>{dentro && mediana !== null ? posicaoNaMediana(p.valor, mediana, m) : "valor oficial fora da comparação"}</p>
          <Ressalva ponto={p} />
        </>
      ),
    };
  };
  const numeros: NumeroProps[] = [
    mediana !== null && c.ref
      ? { rotulo: `${m.rotulo}: mediana`, valor: mediana, valorTexto: m.formata(mediana), formato, unidade, periodo, recorte: "capitais na comparação", fonte, natureza: "CALCULADO", nota: `${c.ref.n} de ${c.noGrupo} capitais na comparação.` }
      : { rotulo: `${m.rotulo}: mediana`, valor: null, motivoAusencia: "Nenhuma capital tem valor comparável para este recorte.", unidade, periodo, recorte: "capitais na comparação", fonte, natureza: "CALCULADO" },
    ...(A ? [capital(A, pa)] : []),
    ...(B ? [capital(B, pb)] : []),
    ...(!A && !B ? [{ rotulo: "Capitais na comparação", valor: c.incluidas.length, formato: "inteiro" as const, unidade: `de ${c.noGrupo} capitais`, periodo, fonte, natureza: "CALCULADO" as const, nota: c.excluidas.length ? `${c.excluidas.length} fora da comparação neste recorte.` : undefined }] : []),
  ];
  return (
    <FaixaNumeros nota={A || B ? "Os números seguem o recorte escolhido logo abaixo: medida, período e as duas capitais." : "Escolha a capital A, e se quiser a capital B, para ver os valores lado a lado. A distribuição das capitais aparece de qualquer modo."} idioma="pt">
      {numeros.map((n, i) => (
        <NumeroIndicador key={`${n.rotulo}-${i}`} {...n} tamanho={i === 0 ? "g" : "m"} idioma="pt" />
      ))}
    </FaixaNumeros>
  );
}

export function ComparadorSaude({ dados: dadosProp, contextos }: { dados?: DadosSaude; contextos: Record<string, ContextoFicha> }) {
  const dados = useBaseSaude(dadosProp);
  const { ix, s, definir, m, o, anos, ano, A, B, c, periodo, ficha, pa, pb } = useRecorteComparar(dados);
  useEffect(() => {
    if (s.ano && !anos.includes(s.ano)) definir({ ano: 0 });
  }, [s.ano, anos, definir]);
  const diferenca =
    A && B && naComparacao(pa) && naComparacao(pb) && pa!.valor !== null && pb!.valor !== null
      ? `${fraseDiferenca({ nome: A.nome, valor: pa!.valor! }, { nome: B.nome, valor: pb!.valor! }, m, ano)} É diferença descritiva: não classifica as capitais nem explica a causa.`
      : A && B
        ? "Pelo menos uma das duas capitais tem o valor fora da comparação ou sem valor neste recorte; os motivos estão em cada número."
        : null;
  const aviso = avisoDoPeriodo(m, ano, o, dados);
  const exportarMedida = () => baixar(`saude_${m.id}_${ano}.csv`, csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(ix, m, ano, o, c, periodo)));
  const opcoesMedida = TEMAS_ORDEM.flatMap((t) => TEMAS_SAUDE[t].medidas.map((id) => ({ v: id, t: MEDIDAS_SAUDE[id].rotulo, grupo: GRUPO_MEDIDA[t] })));
  const opcoesCapital = (vazio: string) => [{ v: "", t: vazio }, ...dados.capitais.map((x) => ({ v: x.id, t: `${x.nome} (${x.uf})` }))];
  const resumo = resumoDoRecorte({
    medida: m.id,
    periodo: m.periodo === "dezembro" ? `dez. ${ano}` : String(ano),
    real: m.moeda && s.moeda === "real",
    denominadorIbge: m.denominador && s.den === "obee",
    capital: A ? `${A.nome} (${A.uf})${B ? ` × ${B.nome} (${B.uf})` : ""}` : null,
    regiao: null,
    semCapital: "nenhuma capital escolhida",
  });
  const tabelaLinhas = [
    ...c.incluidas.map((i) => [`${i.cap.nome} (${i.cap.uf})`, m.formata(i.valor), "Na comparação"]),
    ...c.excluidas.map((x) => [`${x.cap.nome} (${x.cap.uf})`, x.comValor && x.ponto.valor !== null ? m.formata(x.ponto.valor) : "sem valor", x.comValor ? "Valor oficial, fora da comparação" : ROTULO_ESTADO[x.status]]),
  ];
  const proveniencia = provenienciaDaFicha(ficha, dados.fontes, { inicio: String(anos[0]), fim: String(ano) });
  const escolhidas = [A, B].filter((x): x is NonNullable<typeof A> => !!x);
  const series = escolhidas.map((cap) => ({ cap, pontos: serie(ix, m, cap.cod, o) }));
  const anosSerie = Array.from(new Set(series.flatMap((x) => x.pontos.map((p) => p.ano)))).sort((a, b) => a - b);

  return (
    <>
      <Controles rotulo="Recorte da comparação" resumo={resumo} idioma="pt">
        <div className="grid w-full gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Selecao id="cmp-med" rotulo="Medida" ajuda="Vale para as duas capitais e para a distribuição." ajudaNoCelular={false} valor={s.med} opcoes={opcoesMedida} aoMudar={(v) => definir({ med: v as MedidaSaudeId, ano: anosDaMedida(ix, MEDIDAS_SAUDE[v as MedidaSaudeId], o).includes(ano) ? ano : 0 })} />
          <Selecao id="cmp-ano" rotulo={m.periodo === "dezembro" ? "Competência" : m.periodo === "processamento" ? "Ano de processamento" : "Exercício"} ajuda="O mesmo período para as duas capitais." ajudaNoCelular={false} valor={String(ano)} opcoes={anos.map((a) => ({ v: String(a), t: m.periodo === "dezembro" ? `dez. ${a}` : String(a) }))} aoMudar={(v) => definir({ ano: Number(v) })} />
          <Selecao id="cmp-a" rotulo="Capital A" ajuda="A capital que aparece primeiro." ajudaNoCelular={false} valor={s.cap} opcoes={opcoesCapital("Nenhuma")} aoMudar={(v) => definir({ cap: v })} />
          <Selecao id="cmp-b" rotulo="Capital B" ajuda="Opcional: a capital de comparação." ajudaNoCelular={false} valor={s.vs} opcoes={opcoesCapital("Nenhuma")} aoMudar={(v) => definir({ vs: v })} />
        </div>
        {m.moeda && (
          <div>
            <Alternancia rotulo="Valores" valor={s.moeda} opcoes={[{ v: "nominal", t: "Nominais" }, { v: "real", t: "Reais de 2025" }]} aoMudar={(v) => definir({ moeda: v })} />
            <AjudaMoeda />
          </div>
        )}
        {m.denominador && (
          <div>
            <Alternancia rotulo="População do denominador" valor={s.den} opcoes={[{ v: "ripsa", t: "Ministério da Saúde" }, { v: "obee", t: "IBGE do exercício" }]} aoMudar={(v) => definir({ den: v })} />
            <AjudaDenominador iguais={m.id === "icsap_taxa" ? denominadoresIcsapIguais(ix, ano).iguais : 0} total={m.id === "icsap_taxa" ? denominadoresIcsapIguais(ix, ano).total : 0} ano={ano} />
          </div>
        )}
      </Controles>

      <FiguraAnalitica
        id="distribuicao"
        idioma="pt"
        pergunta={`${m.rotulo}, ${periodo.toLowerCase()}`}
        subtitulo={`${m.unidade(s.moeda)} · ${c.ref ? `${c.ref.n} de ${c.noGrupo} capitais na comparação` : "sem capital na comparação"} · ${m.universo}`}
        natureza={ficha.natureza}
        proveniencia={proveniencia}
        leitura={diferenca ? <LeituraGuiada>{diferenca}</LeituraGuiada> : undefined}
        tabela={{ colunas: ["Capital", "Valor", "Situação"], linhas: tabelaLinhas, titulo: `${m.rotulo}, ${periodo}`, limite: tabelaLinhas.length }}
        comoInterpretar={<Siglas texto={m.definicao} />}
        naoConcluir={<Siglas texto={m.naoE} />}
        complemento={
          <>
            <EtiquetaDePerimetro tema={m.tema} href={`${hrefSaude(CAMINHO_METODOS)}#perimetros`} />
            <AvisoDoPeriodo texto={aviso} />
            {c.excluidas.length > 0 && (
              <p className="t-meta max-w-prose2 text-carvao">
                {c.excluidas.length <= 4 ? `Fora da comparação neste recorte: ${c.excluidas.map((x) => `${x.cap.nome} (${x.cap.uf})`).join(", ")}.` : `${c.excluidas.length} capitais fora da comparação neste recorte.`}{" "}
                <a href="#fora-da-comparacao" className="inline-block py-1 text-obee-dark underline underline-offset-4">
                  Motivo e detalhe abaixo
                </a>
                .
              </p>
            )}
            <ForaDaComparacaoSaude itens={c.excluidas.map((x) => ({ nome: x.cap.nome, uf: x.cap.uf, status: x.comValor ? "Fora da comparação" : ROTULO_ESTADO[x.status], motivo: x.motivo }))} />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <SobreEsteDado f={ficha} ctx={contextos[ficha.id]} />
              <button type="button" onClick={exportarMedida} className={botao}>
                Baixar CSV da medida
              </button>
            </div>
          </>
        }
      >
        {c.incluidas.length > 0 ? (
          // a distribuição tem mediana, média e faixa central, formas que o kit não tem: fica a de domínio, marcada como figura legada
          <div data-figura-legado="distribuicao-capitais">
            <DistribuicaoCapitais
              linhas={c.incluidas.map((i) => ({ chave: i.cap.id, rotulo: `${i.cap.nome} (${i.cap.uf})`, valor: i.valor, destacada: i.cap.id === A?.id || i.cap.id === B?.id }))}
              referencias={{ mediana: c.ref?.mediana ?? null, media: c.ref?.media ?? null, faixa: c.ref && c.ref.quartisExibicao && c.ref.q1 !== null && c.ref.q3 !== null ? { q1: c.ref.q1, q3: c.ref.q3 } : null }}
              formata={(v) => m.formata(v, true)}
              formataEixo={m.formataEixo}
              zero={m.zero}
              titulo={`${m.rotulo}, ${periodo}`}
              alturaLinha={24}
              fora={c.excluidas.map((x) => ({ chave: x.cap.id, rotulo: `${x.cap.nome} (${x.cap.uf})`, valor: x.comValor ? x.ponto.valor : null, texto: x.comValor ? "fora da comparação (motivo abaixo)" : `${ROTULO_ESTADO[x.status].toLowerCase()} (motivo abaixo)`, destacada: x.cap.id === A?.id || x.cap.id === B?.id }))}
            />
          </div>
        ) : (
          <p data-grafico="sem-comparacao" className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">
            Nenhuma capital tem valor comparável para este recorte.
          </p>
        )}
      </FiguraAnalitica>

      {escolhidas.length > 0 && (
        <FiguraAnalitica
          id="cmp-evolucao"
          idioma="pt"
          pergunta="Evolução da medida nas capitais escolhidas"
          subtitulo={`${m.rotulo} · ${m.unidade(s.moeda)} · ${escolhidas.map((x) => `${x.nome} (${x.uf})`).join(" e ")} · série de ${anos[0]} a ${anos[anos.length - 1]}`}
          natureza={ficha.natureza}
          proveniencia={proveniencia}
          tabela={{
            colunas: ["Período", ...series.map((x) => `${x.cap.nome} (${x.cap.uf})`)],
            linhas: anosSerie.map((a) => [ROTULO_PERIODO[m.periodo](a), ...series.map((x) => { const p = x.pontos.find((q) => q.ano === a); return p && p.valor !== null ? m.formata(p.valor) : null; })]),
            titulo: `${m.rotulo}: evolução nas capitais escolhidas`,
            limite: anosSerie.length,
          }}
          comoInterpretar="Cada gráfico tem a escala do próprio conjunto de valores; para comparar a diferença entre as capitais, use os valores do mesmo ano acima."
          naoConcluir="As duas séries não estão na mesma escala, e a variação entre anos descreve o valor registrado: nenhuma variação identifica a causa nem classifica as capitais."
        >
          {/* a série interrompe a linha na quebra de base e isola o valor fora das comparações, formas que a linha do kit não tem */}
          <div data-figura-legado="serie" className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {series.map(({ cap, pontos }) => (
              <div key={cap.id}>
                <p className="rotulo text-mineral">
                  {cap.nome} ({cap.uf})
                </p>
                <MiniSerie titulo={`${m.rotulo}: ${cap.nome}`} pontos={pontos} formata={(v) => m.formata(v, true)} formataEixo={m.formataEixo} zero={m.zero} altura={200} />
              </div>
            ))}
          </div>
        </FiguraAnalitica>
      )}
    </>
  );
}

/** Valor à direita, em algarismos tabulares (a célula com nó próprio da TabelaDados não alinha sozinha). */
const Num = ({ children, classe = "" }: { children: React.ReactNode; classe?: string }) => <span className={`block text-right tabular-nums ${classe}`}>{children}</span>;

/**
 * A tabela completa: as 26 capitais em todas as medidas do mesmo ano, na fatia de tabelas, com a ordem e o arquivo nos controles do kit logo
 * antes dela. Cada coluna leva o grupo, a unidade e o tipo de período no próprio rótulo (antes, numa linha de grupos e em duas linhas sob o
 * título da coluna); as capitais A e B ficam em destaque de contexto.
 */
export function TabelaCompletaSaude({ dados: dadosProp }: { dados?: DadosSaude }) {
  const dados = useBaseSaude(dadosProp);
  const { ix, s, definir, ano, A, B } = useRecorteComparar(dados);
  const cols = MEDIDAS_ORDEM.map((id) => MEDIDAS_SAUDE[id]);
  const oo = { moeda: s.moeda, denominador: s.den };
  const celula = (cod: number, mm: (typeof cols)[number]) => {
    const p = ix.ponto(mm.indicador, cod, ano, mm.componente(oo.moeda, oo.denominador));
    const anosMm = anosDaMedida(ix, mm, oo);
    return { p, cobre: anosMm.includes(ano), ultimo: anosMm[anosMm.length - 1] };
  };
  const linhasTab = dados.capitais.map((cap) => ({ cap, cel: cols.map((mm) => celula(cap.cod, mm)) }));
  const ordenadas = [...linhasTab].sort((a, b) => {
    if (s.ord === "alfabetica") return s.dir === "desc" ? b.cap.nome.localeCompare(a.cap.nome, "pt-BR") : a.cap.nome.localeCompare(b.cap.nome, "pt-BR");
    const i = MEDIDAS_ORDEM.indexOf(s.ord as MedidaSaudeId);
    const va = a.cel[i].p.valor;
    const vb = b.cel[i].p.valor;
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return s.dir === "desc" ? vb - va : va - vb;
  });
  const rotuloPeriodoMedida = (mm: (typeof cols)[number]) => (mm.periodo === "dezembro" ? `dezembro de ${ano}` : mm.periodo === "processamento" ? `ano de processamento ${ano}` : `exercício ${ano}`);
  const exportarTabela = () => {
    const cab = ["Capital", "UF", ...cols.map((mm) => `${mm.rotulo} (${mm.unidade(s.moeda)}; ${rotuloPeriodoMedida(mm)}; valor numérico com ponto decimal)`), "Observações", "Fontes das medidas", "Páginas oficiais das fontes", "Data de captura mais recente", "Versões metodológicas", "Dados gerados em", "Hash dos dados", "Leia antes de usar"];
    const metas = cols.map((mm) => ({ mm, x: metaCsv(ix, mm, oo) }));
    const fontes = metas.map(({ mm, x }) => `${mm.rotuloCurto}: ${x.fonte}`).join(" | ");
    const paginas = Array.from(new Set(metas.flatMap(({ x }) => x.url.split(" ")).filter(Boolean))).join(" ");
    const captura = metas.map(({ x }) => x.captura).filter(Boolean).sort().slice(-1)[0] ?? "";
    const versoes = metas.map(({ mm, x }) => `${mm.rotuloCurto}: ${x.versao}`).join(" | ");
    const linhas = ordenadas.map(({ cap, cel }) => [
      cap.nome,
      cap.uf,
      ...cel.map(({ p }) => (p.valor === null ? "" : String(p.valor))),
      cel.map(({ p, cobre, ultimo }, i) => (!cobre ? `${cols[i].rotuloCurto}: sem dado em ${ano}; a série vai até ${ultimo}` : p.valor === null ? `${cols[i].rotuloCurto}: ${ROTULO_ESTADO[p.status]}` : !p.elegivel ? `${cols[i].rotuloCurto}: valor oficial fora da comparação` : "")).filter(Boolean).join("; "),
      fontes,
      paginas,
      captura,
      versoes,
      dados.meta.gerado_em,
      dados.meta.hash_dados,
      RESSALVA_CSV,
    ]);
    baixar(`saude_comparacao_${ano}.csv`, csv(cab, linhas));
  };
  const rotulo = (mm: (typeof cols)[number]) => `${GRUPO_MEDIDA[mm.tema]}: ${mm.rotuloCurto} (${mm.unidade(s.moeda)}; ${periodoCurto(mm, ano)})`;
  const corpo = ordenadas.map(({ cap, cel }) => [
    `${cap.nome} (${cap.uf})`,
    ...cel.map(({ p, cobre, ultimo }, i): ReactElement =>
      !cobre ? <Num key={i} classe="text-carvao-muted">série até {ultimo}</Num> : p.valor === null ? <Num key={i} classe="text-carvao-muted">sem valor</Num> : <Num key={i} classe={p.elegivel ? "" : "italic"}>{cols[i].formata(p.valor, true)}</Num>,
    ),
  ]);
  const opcoesOrdem = [{ v: "alfabetica", t: "Capital (alfabética)" }, ...cols.map((mm) => ({ v: mm.id, t: `${GRUPO_MEDIDA[mm.tema]}: ${mm.rotuloCurto}` }))];
  return (
    <>
      <Controles rotulo="Ordem e arquivo da tabela completa" resumo={`${ordenadas.length} capitais · ${cols.length} medidas · ordem: ${opcoesOrdem.find((x) => x.v === s.ord)?.t.toLowerCase()}, ${s.dir === "desc" ? "decrescente" : "crescente"}`} idioma="pt">
        <div className="w-full min-w-0 sm:w-80">
          <Selecao id="cmp-ordem" rotulo="Ordenar a tabela por" ajuda="Recurso de leitura, não classificação." ajudaNoCelular={false} valor={s.ord} opcoes={opcoesOrdem} aoMudar={(v) => definir({ ord: v as Colunas, dir: "cres" })} />
        </div>
        <Alternancia<"cres" | "desc"> rotulo="Sentido" valor={s.dir} opcoes={[{ v: "cres", t: "Crescente" }, { v: "desc", t: "Decrescente" }]} aoMudar={(v) => definir({ dir: v })} />
        <button type="button" onClick={exportarTabela} className={botao}>
          Baixar CSV da tabela
        </button>
      </Controles>
      <TabelaDados
        recolhida={false}
        idioma="pt"
        id="cmp-tabela"
        tituloVisivel={`As 26 capitais, todas as medidas, em ${ano}`}
        titulo={`Capitais e medidas de Saúde em ${ano}`}
        lead={
          <>
            <p>
              Cada coluna tem a sua unidade, o seu perímetro e o seu tipo de período (exercício, dezembro ou ano de processamento); as medidas não se somam. Ordenar por uma coluna é recurso de leitura, não classificação. Valor em itálico:
              valor oficial fora da comparação. {s.moeda === "real" ? "Valores em reais de 2025." : "Valores em reais correntes."}
            </p>
            <p className="mt-1">
              Perímetros: {TEMAS_ORDEM.map((tm) => `${GRUPO_MEDIDA[tm]}, ${PERIMETRO_DO_TEMA[tm].rotulo.toLowerCase()}`).join("; ")}.
            </p>
          </>
        }
        colunas={["Capital", ...cols.map(rotulo)]}
        linhas={corpo}
        limite={corpo.length}
        fixarPrimeiraColuna
        linhasDestacadas={ordenadas.flatMap(({ cap }, i) => (cap.id === A?.id || cap.id === B?.id ? [i] : []))}
      />
    </>
  );
}
