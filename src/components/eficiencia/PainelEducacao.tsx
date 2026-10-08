"use client";

import { useMemo, useState, type ReactNode } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  CABECALHO_CSV_COMPARACAO,
  CABECALHO_CSV_TABELA,
  CABECALHO_CSV_TABELA_COMPARATIVA,
  CABECALHO_TABELA,
  COLUNAS,
  Indice,
  MEDIDA,
  MEDIDAS,
  ROTULO_STATUS,
  comparar,
  componente,
  composicaoDespesa,
  csv,
  distribuicaoMatriculas,
  diferenca,
  edicaoIdeb,
  etapaDaMedida,
  etapaValida,
  formata,
  formataEixo,
  internacionaisDa,
  linhasCsvComparacao,
  linhasCsvTabela,
  linhasCsvTabelaComparativa,
  linhasTabela,
  nomeEtapa,
  ponteMatricula,
  referenciasExternas,
  rotuloComparacao,
  serie,
  tabelaComparativa,
  unidade,
  variacao,
  type ColunaId,
  type DadosPainel,
  type Disciplina,
  type Grupo,
  type MedidaId,
  type Moeda,
  type Ordem,
  type Ponto,
} from "@/lib/eficiencia/consulta";
import { decimal, inteiro, percentual, reaisCompleto, reaisExtenso } from "@/lib/eficiencia/formato";
import type { EtapaId, IndicadorId } from "@/lib/eficiencia/tipos";
import type { ContextoFicha } from "./FichaConteudo";
import { Passaporte } from "./Passaporte";
import { BarrasComposicao, GraficoPontosPares, MiniSerie, type Anotacao } from "./graficos";
import { ContextoInternacionalBloco, RefLinha, RefNacionalLinha, ReferenciasNacionais, ResumoGrupo, SemReferencia } from "./ReferenciasPainel";
import { TabelaComparativa, type VisaoColunas } from "./TabelaComparativa";

const ETAPAS: EtapaId[] = ["total", "creche", "pre_escola", "anos_iniciais", "anos_finais", "ensino_medio", "eja", "profissional"];

const PANDEMIA_IDEB: Anotacao = { ano: 2021, texto: "edição afetada pela pandemia de covid-19 (nota informativa do INEP sobre o Ideb 2021)." };
const PANDEMIA_APROVACAO: Anotacao = { ano: 2021, texto: "ano letivo afetado pela pandemia de covid-19, com regras excepcionais de avaliação em muitas redes." };

const SEM_NACIONAL: Record<MedidaId, string> = {
  despesa: "Despesa total é volume: depende do tamanho da cidade e não tem referência nacional comparável. Use o gasto por habitante ou por matrícula.",
  despesa_hab: "O IBGE, o INEP, o Tesouro Nacional e o FNDE não publicam despesa municipal em Educação por habitante para o conjunto das redes municipais. Calculá-la aqui seria indicador próprio, não referência oficial.",
  despesa_mat: "Há o investimento público direto por estudante do INEP (todas as redes públicas e esferas), publicado só até 2021; ele aparece para 2021, com o universo declarado.",
  matriculas: "Matrícula absoluta depende do tamanho da rede; não há referência nacional comparável.",
  conveniadas: "Matrícula em escolas conveniadas depende do tamanho da rede e da política de parceria de cada município; não há referência nacional comparável.",
  atu: "Referência nacional da rede municipal do INEP existe para creche, pré-escola e anos iniciais e finais.",
  aprovacao: "Referência nacional da rede municipal do INEP existe para anos iniciais e anos finais.",
  ideb: "Referência nacional da rede municipal do INEP existe para anos iniciais e anos finais, nas edições bienais.",
  saeb: "Referência nacional da rede municipal do INEP existe para anos iniciais e anos finais, nas edições bienais.",
};
const SEM_INTERNACIONAL: Record<MedidaId, string> = {
  despesa: "Despesa total de um município não tem equivalente internacional comparável.",
  despesa_hab: "A OCDE e a UNESCO publicam despesa como proporção do PIB e por estudante; despesa pública por habitante de um município não tem equivalente internacional comparável.",
  despesa_mat: "Há contexto da OCDE (despesa por estudante, ISCED 1 e 2, em dólares de paridade de poder de compra), mostrado quando a medida é a despesa por matrícula.",
  matriculas: "Matrículas de uma rede municipal não têm equivalente internacional comparável; contagens nacionais são de outra escala, e taxas de matrícula por idade medem a cobertura da população, outro conceito.",
  conveniadas: "Sem equivalente internacional comparável.",
  atu: "Há contexto da OCDE (tamanho médio das turmas, ISCED 1 e 2, instituições públicas) para anos iniciais e anos finais. Creche e pré-escola não têm tamanho de turma na OCDE; alunos por turma não é alunos por professor.",
  aprovacao: "A OCDE e a UNESCO publicam repetência, outro conceito: o Brasil não tem valor na OCDE e o último valor da UNESCO é de 2010. Sem equivalente comparável da taxa de aprovação.",
  ideb: "Ideb, Saeb e PISA não compartilham população, escala nem construto; o painel não converte notas entre escalas.",
  saeb: "Ideb, Saeb e PISA não compartilham população, escala nem construto; o painel não converte notas entre escalas.",
};

function esquema(ids: string[]) {
  return {
    cap: campo(tiposUrl.opcao(ids), ids[0]),
    ano: campo(tiposUrl.inteiro({ min: 2021, max: 2025 }), 2025),
    etapa: campo(tiposUrl.opcao(ETAPAS), "anos_iniciais" as EtapaId),
    med: campo(tiposUrl.opcao(MEDIDAS), "despesa_hab" as MedidaId),
    grupo: campo(tiposUrl.opcao(["todas", "regiao"] as const), "todas" as Grupo),
    ord: campo(tiposUrl.opcao(["alfabetica", "valor"] as const), "alfabetica" as Ordem),
    eixo: campo(tiposUrl.opcao(["linear", "log"] as const), "linear" as "linear" | "log"),
    ot: campo(tiposUrl.opcao(["alfabetica", ...COLUNAS.map((c) => c.id)] as const), "alfabetica" as ColunaId | "alfabetica"),
    od: campo(tiposUrl.opcao(["asc", "desc"] as const), "asc" as "asc" | "desc"),
    vc: campo(tiposUrl.opcao(["todas", "recursos", "atendimento", "resultado"] as const), "todas" as VisaoColunas),
    moeda: campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal" as Moeda),
    disc: campo(tiposUrl.opcao(["matematica", "portugues"] as const), "matematica" as Disciplina),
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

/* ------------------------------------------------------------------ peças pequenas */

function Bloco({ id, rotulo, titulo, children, acao }: { id: string; rotulo: string; titulo: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-24 border-t border-linha pt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="rotulo text-mineral">{rotulo}</p>
          <h2 id={`${id}-titulo`} className="mt-2 font-serif text-2xl leading-tight text-obee-tinta md:text-[1.75rem]">
            {titulo}
          </h2>
        </div>
        {acao}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SemValor({ ponto, contexto }: { ponto: Ponto; contexto?: string }) {
  const texto = contexto ?? ponto.nota ?? "Sem valor para este recorte.";
  // frase inicial sempre visível; o restante do motivo abre por clique ou teclado
  const corte = texto.length > 170 ? texto.search(/\.\s/) : -1;
  const inicio = corte > 0 ? texto.slice(0, corte + 1) : texto;
  const resto = corte > 0 ? texto.slice(corte + 1).trim() : "";
  return (
    <div className="mt-2 border border-dashed border-mineral bg-papel px-3 py-2 text-sm text-obee-tinta" role="note">
      <p className="rotulo flex items-center gap-1.5 !text-[0.66rem] text-carvao-muted">
        <span aria-hidden="true" className="inline-block h-2 w-2 border border-carvao-muted" />
        {ponto.status === "NAO_COMPARAVEL" && ponto.valor === null ? "Sem valor publicável" : ROTULO_STATUS[ponto.status]}
      </p>
      <p className="mt-1 leading-snug">{inicio}</p>
      {resto && (
        <details className="mt-1">
          <summary className="rotulo inline-flex min-h-[32px] cursor-pointer items-center text-obee-dark">Ver o motivo completo</summary>
          <p className="mt-1 leading-snug text-carvao-muted">{resto}</p>
        </details>
      )}
    </div>
  );
}

/**
 * Ressalva junto ao dado: restrição material com sinal visível ("Ressalva"); nota informativa com
 * "Nota". O detalhe abre por clique ou teclado (details/summary), sem depender de hover ou cor.
 */
function Ressalva({ ponto }: { ponto: Ponto }) {
  const texto = ponto.status === "OBSERVADO" && !ponto.elegivel ? ponto.motivo ?? ponto.nota : ponto.nota;
  if (!texto || ponto.status !== "OBSERVADO") return null;
  const material = ponto.notaMaterial || !ponto.elegivel;
  return (
    <details className="group mt-2 text-xs leading-snug">
      <summary
        className={`inline-flex min-h-[32px] cursor-pointer list-none items-center gap-1.5 border px-2 ${
          material ? "border-obee-tinta font-semibold text-obee-tinta" : "border-linha text-carvao-muted"
        }`}
      >
        <span aria-hidden="true">{material ? "!" : "i"}</span>
        {material ? (ponto.elegivel ? "Ressalva" : "Ressalva: fora das comparações") : "Nota"}
        <span className="sr-only"> (abrir detalhe)</span>
      </summary>
      <p className="mt-1.5 text-obee-tinta">{texto}</p>
      {!ponto.elegivel && ponto.nota && ponto.nota !== texto && <p className="mt-1 text-carvao-muted">{ponto.nota}</p>}
    </details>
  );
}

function ForaDoEscopo({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-mineral bg-papel px-4 py-4 text-sm leading-relaxed text-obee-tinta" role="note">
      <p className="rotulo !text-[0.66rem] text-carvao-muted">Fora do escopo deste indicador</p>
      <p className="mt-1">{texto}</p>
      {children}
    </div>
  );
}

function Selecao({
  id,
  rotulo,
  ajuda,
  valor,
  opcoes,
  aoMudar,
  desabilitado,
}: {
  id: string;
  rotulo: string;
  ajuda: string;
  valor: string;
  opcoes: { v: string; t: string; desab?: boolean; grupo?: string }[];
  aoMudar: (v: string) => void;
  desabilitado?: boolean;
}) {
  const grupos = Array.from(new Set(opcoes.map((o) => o.grupo ?? "")));
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="rotulo block text-carvao-muted">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        disabled={desabilitado}
        aria-describedby={`${id}-ajuda`}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-1.5 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-[0.95rem] text-obee-tinta hover:border-obee disabled:text-mineral"
      >
        {grupos.map((g) => {
          const itens = opcoes
            .filter((o) => (o.grupo ?? "") === g)
            .map((o) => (
              <option key={o.v} value={o.v} disabled={o.desab}>
                {o.t}
              </option>
            ));
          return g ? (
            <optgroup key={g} label={g}>
              {itens}
            </optgroup>
          ) : (
            itens
          );
        })}
      </select>
      <p id={`${id}-ajuda`} className="mt-1 text-xs leading-snug text-carvao-muted">
        {ajuda}
      </p>
    </div>
  );
}

function Alternancia<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: { v: T; t: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="rotulo text-carvao-muted">{rotulo}</legend>
      <div className="mt-1.5 inline-flex border border-linha bg-superficie">
        {opcoes.map((o) => (
          <label
            key={o.v}
            className={`relative inline-flex min-h-[40px] cursor-pointer items-center px-3 text-sm focus-within:outline focus-within:outline-2 focus-within:outline-obee ${
              valor === o.v ? "bg-obee-fundo font-semibold text-obee-tinta" : "text-carvao-muted hover:text-obee-tinta"
            }`}
          >
            <input type="radio" className="sr-only" name={rotulo} value={o.v} checked={valor === o.v} onChange={() => aoMudar(o.v)} />
            {o.t}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const ESCALAS: { m: MedidaId; titulo: string; texto: string }[] = [
  { m: "despesa", titulo: "Gasto total", texto: "Volume do orçamento do município na função Educação. Depende do tamanho da cidade." },
  { m: "despesa_hab", titulo: "Por habitante", texto: "Divide pelos moradores do ano. Põe cidades de portes diferentes na mesma escala territorial; não é gasto por aluno." },
  { m: "despesa_mat", titulo: "Por matrícula da rede municipal", texto: "Aplicação direta do município ÷ matrículas das escolas municipais, sem conveniadas, inativos nem ensino superior." },
];

function EscalaDespesa({ valor, aoMudar }: { valor: MedidaId; aoMudar: (m: MedidaId) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="rotulo text-carvao-muted">Gasto em Educação, em três escalas</legend>
      <p className="mt-1 text-xs leading-snug text-carvao-muted">Cada escala responde a uma pergunta diferente. Nenhuma substitui as outras.</p>
      <div className="mt-2 grid gap-px border border-linha bg-linha sm:grid-cols-3">
        {ESCALAS.map((e) => (
          <label
            key={e.m}
            className={`relative flex min-h-[44px] cursor-pointer flex-col px-4 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-obee ${
              valor === e.m ? "bg-obee-fundo" : "bg-superficie hover:bg-papel"
            }`}
          >
            <input type="radio" className="sr-only" name="escala-despesa" value={e.m} checked={valor === e.m} onChange={() => aoMudar(e.m)} />
            <span className={`text-sm ${valor === e.m ? "font-semibold text-obee-tinta" : "text-obee-tinta"}`}>
              <span aria-hidden="true">{valor === e.m ? "● " : "○ "}</span>
              {e.titulo}
            </span>
            <span className="mt-0.5 text-xs leading-snug text-carvao-muted">{e.texto}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TabelaSimples({ legenda, cabecalho, linhas }: { legenda: string; cabecalho: string[]; linhas: (string | number)[][] }) {
  return (
    <div className="tabela-scroll mt-2" tabIndex={0} role="region" aria-label={`${legenda} (tabela; role na horizontal se necessário)`}>
      <table className="w-full min-w-[22rem] border-collapse text-sm">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr>
            {cabecalho.map((c, i) => (
              <th key={c} scope="col" className={`border-b border-carvao-muted px-2 py-1.5 font-semibold text-obee-tinta ${i ? "text-right" : "text-left"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, j) => (
            <tr key={j} className="border-b border-linha">
              {l.map((c, i) =>
                i ? (
                  <td key={i} className="px-2 py-1.5 text-right text-obee-tinta">
                    {c}
                  </td>
                ) : (
                  <th key={i} scope="row" className="px-2 py-1.5 text-left font-normal text-obee-tinta">
                    {c}
                  </th>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ painel */

export function PainelEducacao({ dados, contextos }: { dados: DadosPainel; contextos: Record<string, ContextoFicha> }) {
  const ix = useMemo(() => new Indice(dados), [dados]);
  const ids = useMemo(() => dados.capitais.map((c) => c.id), [dados]);
  const esq = useMemo(() => esquema(ids), [ids]);
  const [s, definir] = useEstadoUrl(esq);
  const [aviso, setAviso] = useState("");
  const cap = dados.capitais.find((c) => c.id === s.cap) ?? dados.capitais[0];
  const ficha = (id: IndicadorId) => dados.fichas.find((f) => f.id === id)!;
  const pass = (id: IndicadorId, rotulo?: string, compacto?: boolean) => (
    <Passaporte f={ficha(id)} ctx={contextos[id]} rotulo={rotulo} compacto={compacto} />
  );
  const etapaNome = nomeEtapa(dados, s.etapa);
  const { edicao, exata } = edicaoIdeb(s.ano);
  const nomeCap = `${cap.nome} (${cap.uf})`;

  const restaurar = () => {
    definir({ cap: ids[0], ano: 2025, etapa: "anos_iniciais", med: "despesa_hab", grupo: "todas", ord: "alfabetica", moeda: "nominal", disc: "matematica", eixo: "linear", ot: "alfabetica", od: "asc", vc: "todas" });
    setAviso("Recorte inicial restaurado.");
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setAviso("Link do recorte copiado.");
    } catch {
      setAviso("Não foi possível copiar automaticamente. O endereço na barra do navegador reproduz este recorte.");
    }
  };

  /* ---------- C: números de orientação ---------- */
  const grp = s.grupo === "regiao" ? cap.regiao : "todas";
  const rotuloGrupo = s.grupo === "regiao" ? `das capitais da região ${dados.regioes[cap.regiao]}` : "das capitais estaduais";
  const compDe = (m: MedidaId) => componente(m, s.moeda, s.disc);
  const refDe = (m: MedidaId, a = s.ano, et: EtapaId = s.etapa) => ix.referencia(MEDIDA[m].indicador, compDe(m), etapaDaMedida(m, et), a, grp);
  const ptDe = (m: MedidaId, a = s.ano, et: EtapaId = s.etapa) => ix.ponto(MEDIDA[m].indicador, cap.cod, a, etapaDaMedida(m, et), compDe(m));
  const desp = ptDe("despesa");
  const despAnt = ptDe("despesa", s.ano - 1);
  const hab = ptDe("despesa_hab");
  const habAnt = ptDe("despesa_hab", s.ano - 1);
  const dmat = ptDe("despesa_mat");
  const dmatAnt = ptDe("despesa_mat", s.ano - 1);
  const pop = ix.ponto("ctx.populacao.residente", cap.cod, s.ano, null, null);
  const popMeta = dados.populacao[String(s.ano)];
  const mat = ix.ponto("edu.matriculas.rede_municipal", cap.cod, s.ano, s.etapa, null);
  const matAnt = ix.ponto("edu.matriculas.rede_municipal", cap.cod, s.ano - 1, s.etapa, null);
  const matTotal = ix.ponto("edu.matriculas.rede_municipal", cap.cod, s.ano, "total", null);
  const conv = ix.ponto("edu.matriculas.conveniadas_municipais", cap.cod, s.ano, s.etapa, null);
  const convTotalCard = ix.ponto("edu.matriculas.conveniadas_municipais", cap.cod, s.ano, "total", null);
  const ponte = ponteMatricula(ix, cap.cod, s.ano);
  const etapaFund = s.etapa === "anos_iniciais" || s.etapa === "anos_finais";
  const etapaAtu = etapaValida("atu", s.etapa);
  const atu = etapaAtu ? ptDe("atu") : null;
  const ideb = etapaFund ? ptDe("ideb", edicao) : null;
  const idebAnt = etapaFund ? ptDe("ideb", edicao - 2) : null;
  const saeb = etapaFund ? ptDe("saeb", edicao) : null;
  const aprov = etapaFund ? ptDe("aprovacao") : null;
  const ext = (m: MedidaId, a: number) => referenciasExternas(dados, m, a, s.etapa, compDe(m));

  /** Variação só entre valores elegíveis e de mesma base; quando um deles não é, diz por que não foi calculada. */
  const variacaoPct = (a: Ponto, b: Ponto, anoB: number, motivoQuebra = "há quebra de série entre os dois anos") => {
    if (a.valor !== null && b.valor !== null && a.quebraSerie !== b.quebraSerie) {
      return `Variação em relação a ${anoB} não calculada: ${motivoQuebra}.`;
    }
    const v = variacao(a, b);
    if (!v) return null;
    if ("bloqueio" in v) return `Variação em relação a ${anoB} não calculada: um dos valores está fora das comparações.`;
    return `${v.pct >= 0 ? "+" : "−"}${decimal(Math.abs(v.pct), 1)}% em relação a ${anoB}`;
  };
  const variacaoAbs = (a: Ponto | null, b: Ponto | null, anoB: number, casas: number) =>
    a && b && a.valor !== null && b.valor !== null && a.elegivel && b.elegivel
      ? `${a.valor - b.valor >= 0 ? "+" : "−"}${decimal(Math.abs(a.valor - b.valor), casas)} em relação à edição ${anoB}`
      : null;
  const univ = (id: IndicadorId) => ficha(id).universo_rotulo;

  /* ---------- E: séries ---------- */
  const series: { m: MedidaId; titulo: string; zero: boolean; anot?: Anotacao[] }[] = [
    { m: "despesa", titulo: "Despesa liquidada na função Educação, total", zero: true },
    { m: "despesa_hab", titulo: "Despesa por habitante", zero: true },
    { m: "despesa_mat", titulo: "Despesa por matrícula da rede municipal", zero: true },
    { m: "matriculas", titulo: "Matrículas na rede municipal", zero: true },
    { m: "conveniadas", titulo: "Matrículas em escolas privadas conveniadas só com o município", zero: true },
    { m: "atu", titulo: "Média de alunos por turma", zero: true },
    { m: "aprovacao", titulo: "Taxa de aprovação", zero: false, anot: [PANDEMIA_APROVACAO] },
    { m: "ideb", titulo: "Ideb", zero: false, anot: [PANDEMIA_IDEB] },
    { m: "saeb", titulo: `Proficiência no Saeb, ${s.disc === "matematica" ? "Matemática" : "Língua Portuguesa"}`, zero: false, anot: [PANDEMIA_IDEB] },
  ];

  /* ---------- F: comparação ---------- */
  const med = MEDIDA[s.med];
  const compEtapaOk = etapaValida(s.med, s.etapa);
  const compAnoOk = med.anos !== "ideb" || exata;
  const comp = compEtapaOk && compAnoOk ? comparar(ix, s.med, s.ano, s.etapa, s.moeda, s.disc, s.grupo, cap, s.ord) : null;
  const unidadeMed = unidade(s.med, s.moeda);
  const fmt = (v: number) => formata(s.med, v);
  const fmtCurto = (v: number) => formataEixo(s.med, v);
  // tabela equivalente e download saem da mesma comparação: incluídas e excluídas, com estado e motivo
  const linhasComp = comp
    ? [
        ...comp.incluidas.map((i) => [`${i.cap.nome} (${i.cap.uf})`, formata(s.med, i.valor), i.ponto.nota ? "Incluída, com nota" : "Incluída"]),
        ...comp.excluidas.map((x) => [
          `${x.cap.nome} (${x.cap.uf})`,
          x.comValor && x.ponto.valor !== null ? formata(s.med, x.ponto.valor) : "",
          x.comValor ? "Fora da comparação" : ROTULO_STATUS[x.status],
        ]),
      ]
    : [];
  const csvComp = () =>
    comp &&
    baixar(
      `obee_comparacao_${s.med}_${s.ano}${med.etapas ? `_${s.etapa}` : ""}${s.grupo === "regiao" ? `_regiao_${cap.regiao}` : ""}.csv`,
      csv(CABECALHO_CSV_COMPARACAO, linhasCsvComparacao(dados, comp, s.med, s.ano, s.etapa, s.moeda, s.disc)),
    );

  const extComp = comp ? referenciasExternas(dados, s.med, med.anos === "ideb" ? s.ano : s.ano, s.etapa, compDe(s.med)) : [];
  const extMesmo = extComp.filter((e) => e.tipo === "nacional_mesmo_universo");
  const intl = internacionaisDa(dados, s.med, s.etapa);
  const selPonto = comp ? comp.incluidas.find((i) => i.cap.id === cap.id) : undefined;
  const LEITURA: Partial<Record<MedidaId, string>> = {
    despesa: "Escala de volume: capitais maiores ficam mais à direita. Para comparar cidades de portes diferentes, use o gasto por habitante ou por matrícula.",
    despesa_hab: "Divide o gasto pelos moradores do ano. Não é gasto por aluno nem tributo por pessoa, e a participação da rede municipal na oferta de ensino varia entre capitais: população semelhante não implica responsabilidades educacionais semelhantes.",
    despesa_mat: "Aplicação direta do município na função Educação ÷ matrículas das escolas municipais. Não é custo integral do aluno nem custo marginal; despesa maior ou menor por matrícula não demonstra mais ou menos eficiência nem qualidade.",
  };
  const textoRazao = (() => {
    const r = comp?.ref;
    if (!r || r.razaoAgregada === null || (s.med !== "despesa_hab" && s.med !== "despesa_mat")) return undefined;
    const den = s.med === "despesa_hab" ? "dos habitantes" : "das matrículas";
    return (
      <>
        {formata(s.med, r.razaoAgregada)}: soma da despesa de {r.n} capitais ({s.moeda === "real" ? "R$ de 2025" : "R$ correntes"}, {reaisExtenso(r.somaNumerador ?? 0)}) ÷ soma {den} das mesmas {r.n} ({inteiro(r.somaDenominador ?? 0)}). Pesa cada capital pelo seu denominador; difere da média simples, que dá o mesmo peso a cada capital.
      </>
    );
  })();

  /* ---------- G: decomposição ---------- */
  const compDesp = composicaoDespesa(ix, cap.cod, s.ano);
  const somaSub = compDesp.linhas.reduce((a, l) => a + l.valor, 0);
  const distMat = distribuicaoMatriculas(ix, cap.cod, s.ano);
  const convTotal = ix.ponto("edu.matriculas.conveniadas_municipais", cap.cod, s.ano, "total", null);

  /* ---------- H: tabela ---------- */
  const tabela = linhasTabela(ix, cap.cod, s.ano);

  return (
    <div className="space-y-14">
      {/* B: controles */}
      <section aria-labelledby="controles-titulo" className="border border-linha bg-superficie px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="controles-titulo" className="rotulo text-obee-tinta">
            Recorte em exibição
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className="rotulo min-h-[44px] border border-linha px-3 text-obee-tinta hover:border-obee">
              Copiar link do recorte
            </button>
            <button type="button" onClick={restaurar} className="rotulo min-h-[44px] border border-linha px-3 text-obee-tinta hover:border-obee">
              Voltar ao recorte inicial
            </button>
          </div>
        </div>
        <div className="mt-4">
          <EscalaDespesa valor={s.med} aoMudar={(m) => definir({ med: m })} />
        </div>
        <div className="mt-5 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Selecao
            id="f-cap"
            rotulo="Capital"
            ajuda="Rede municipal da capital. Recorte inicial: a primeira em ordem alfabética."
            valor={cap.id}
            opcoes={dados.capitais.map((c) => ({ v: c.id, t: `${c.nome} (${c.uf})` }))}
            aoMudar={(v) => definir({ cap: v })}
          />
          <Selecao
            id="f-ano"
            rotulo="Ano"
            ajuda="Exercício financeiro, ano do Censo Escolar e ano letivo. O Ideb usa a edição do ano ou a anterior, sempre indicada."
            valor={String(s.ano)}
            opcoes={dados.anos.financeiros.map((a) => ({ v: String(a), t: String(a) }))}
            aoMudar={(v) => definir({ ano: Number(v) })}
          />
          <Selecao
            id="f-etapa"
            rotulo="Etapa de ensino"
            ajuda="Vale para matrículas, alunos por turma, aprovação, Ideb e Saeb, conforme a etapa existir em cada um. Não se aplica à despesa."
            valor={s.etapa}
            opcoes={dados.etapas.map((e) => ({ v: e.id, t: e.nome }))}
            aoMudar={(v) => definir({ etapa: v as EtapaId })}
          />
          <Selecao
            id="f-med"
            rotulo="Medida em foco"
            ajuda="Medida da comparação, da tabela e das referências. Os três botões acima escolhem o gasto; este campo escolhe qualquer medida."
            valor={s.med}
            opcoes={MEDIDAS.map((m) => ({ v: m, t: MEDIDA[m].rotulo, grupo: MEDIDA[m].familia === "recursos" ? "Recursos" : MEDIDA[m].familia === "atendimento" ? "Atendimento" : "Resultados" }))}
            aoMudar={(v) => definir({ med: v as MedidaId })}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
          <Alternancia
            rotulo="Grupo de comparação"
            valor={s.grupo}
            opcoes={[
              { v: "todas", t: "Todas as capitais" },
              { v: "regiao", t: `Região ${dados.regioes[cap.regiao]}` },
            ]}
            aoMudar={(v) => definir({ grupo: v })}
          />
          <Alternancia
            rotulo="Valores da despesa"
            valor={s.moeda}
            opcoes={[
              { v: "nominal", t: "Nominais" },
              { v: "real", t: "Em reais de 2025 (IPCA)" },
            ]}
            aoMudar={(v) => definir({ moeda: v })}
          />
          <Alternancia
            rotulo="Disciplina do Saeb"
            valor={s.disc}
            opcoes={[
              { v: "matematica", t: "Matemática" },
              { v: "portugues", t: "Língua Portuguesa" },
            ]}
            aoMudar={(v) => definir({ disc: v })}
          />
        </div>
        <p role="status" aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm text-obee-dark">
          {aviso}
        </p>
      </section>

      {/* C: números de orientação */}
      <section aria-labelledby="orientacao-titulo" id="orientacao">
        <h2 id="orientacao-titulo" className="rotulo text-mineral">
          {nomeCap} · números de orientação
        </h2>
        <p className="mt-1 max-w-prose2 text-sm text-carvao-muted">
          Cada número tem o seu período, o seu universo e uma referência do grupo ao lado. Quando os períodos diferem, isso aparece abaixo do valor. Grupo de referência:{" "}
          {rotuloGrupo.replace("das ", "as ")}, escolhido nos controles.
        </p>
        <h3 className="rotulo mt-5 text-obee-dark">Recursos: gasto em Educação, em três escalas</h3>
        <div className="mt-2 grid gap-px border border-linha bg-linha sm:grid-cols-2 xl:grid-cols-4">
          <Cartao id="despesa" rotulo="Gasto total na função Educação" periodo={`Exercício ${s.ano} · ${unidade("despesa", s.moeda)} · ${univ("edu.despesa.funcao_educacao")}`} acao={pass("edu.despesa.funcao_educacao", "Passaporte", true)}>
            {desp.valor !== null ? (
              <>
                <Valor>{formata("despesa", desp.valor)}</Valor>
                {variacaoPct(desp, despAnt, s.ano - 1) && <Detalhe>{variacaoPct(desp, despAnt, s.ano - 1)}</Detalhe>}
                <Detalhe>Volume: depende do tamanho da cidade.</Detalhe>
                <Ressalva ponto={desp} />
                <RefLinha r={refDe("despesa")} m="despesa" valor={desp.valor} elegivel={desp.elegivel} rotuloGrupo={rotuloGrupo} />
              </>
            ) : (
              <SemValor ponto={desp} />
            )}
          </Cartao>
          <Cartao id="habitante" rotulo="Gasto por habitante" periodo={`Exercício ${s.ano} · ${unidade("despesa_hab", s.moeda)} · ${univ("edu.despesa.por_habitante")}`} acao={pass("edu.despesa.por_habitante", "Passaporte", true)}>
            {hab.valor !== null ? (
              <>
                <Valor>{formata("despesa_hab", hab.valor)}</Valor>
                {variacaoPct(hab, habAnt, s.ano - 1, "a população de 2021 é estimativa anterior ao Censo 2022 e tem outra base") && <Detalhe>{variacaoPct(hab, habAnt, s.ano - 1, "a população de 2021 é estimativa anterior ao Censo 2022 e tem outra base")}</Detalhe>}
                <Detalhe>
                  {desp.valor !== null ? `${formata("despesa", desp.valor)} ÷ ${pop.valor !== null ? inteiro(pop.valor) : "?"} habitantes` : ""}
                  {popMeta?.tipo === "censo" ? " (Censo 2022, 1º de agosto de 2022)" : popMeta?.referencia ? ` (população estimada, ${popMeta.referencia})` : ""}.
                </Detalhe>
                <Detalhe>Não é gasto por aluno, tributo por pessoa nem benefício individual.</Detalhe>
                <Ressalva ponto={hab} />
                <RefLinha r={refDe("despesa_hab")} m="despesa_hab" valor={hab.valor} elegivel={hab.elegivel} rotuloGrupo={rotuloGrupo} />
                <p className="mt-1.5 text-xs leading-snug text-carvao-muted">Referência nacional: não há indicador oficial de despesa municipal em Educação por habitante.</p>
              </>
            ) : (
              <SemValor ponto={hab} contexto={hab.status === "NAO_DIVULGADO" ? hab.nota ?? undefined : undefined} />
            )}
          </Cartao>
          <Cartao id="matricula-despesa" rotulo="Gasto por matrícula da rede municipal" periodo={`Exercício ${s.ano} e Censo Escolar ${s.ano} · ${unidade("despesa_mat", s.moeda)} · ${univ("edu.despesa.por_matricula_rede_propria")}`} acao={pass("edu.despesa.por_matricula_rede_propria", "Passaporte", true)}>
            {dmat.valor !== null ? (
              <>
                <Valor>{formata("despesa_mat", dmat.valor)}</Valor>
                {variacaoPct(dmat, dmatAnt, s.ano - 1) && <Detalhe>{variacaoPct(dmat, dmatAnt, s.ano - 1)}</Detalhe>}
                <Detalhe>
                  Aplicação direta na rede própria ({ponte.linhas.find((l) => l.dentro) ? reaisExtenso(ponte.linhas.find((l) => l.dentro)!.valor) : ""}) ÷ {matTotal.valor !== null ? inteiro(matTotal.valor) : "?"} matrículas das escolas municipais.
                  {convTotalCard.valor ? ` Fora desta razão: ${inteiro(convTotalCard.valor)} matrículas em escolas privadas conveniadas com o município e as transferências a elas.` : ""} Por matrícula, não por estudante único.
                </Detalhe>
                <Ressalva ponto={dmat} />
                <RefLinha r={refDe("despesa_mat")} m="despesa_mat" valor={dmat.valor} elegivel={dmat.elegivel} rotuloGrupo={rotuloGrupo} />
                <RefNacionalLinha externas={ext("despesa_mat", s.ano)} valor={dmat.valor} elegivel={dmat.elegivel} m="despesa_mat" nomeCapital={cap.nome} />
              </>
            ) : (
              <SemValor ponto={dmat} />
            )}
          </Cartao>
          <Cartao id="matriculas" rotulo={`Matrículas na rede municipal · ${etapaNome}`} periodo={`Censo Escolar ${s.ano} · matrículas · ${univ("edu.matriculas.rede_municipal")}`} acao={pass("edu.matriculas.rede_municipal", "Passaporte", true)}>
            {mat.valor !== null ? (
              <>
                <Valor>{inteiro(mat.valor)}</Valor>
                {variacaoPct(mat, matAnt, s.ano - 1) && <Detalhe>{variacaoPct(mat, matAnt, s.ano - 1)}</Detalhe>}
                {conv.valor !== null && (
                  <Detalhe>
                    Contadas à parte, não somadas: {inteiro(conv.valor)} em escolas privadas com parceria só com o município.
                  </Detalhe>
                )}
                <Ressalva ponto={mat} />
                <RefLinha r={refDe("matriculas")} m="matriculas" valor={mat.valor} elegivel={mat.elegivel} rotuloGrupo={rotuloGrupo} />
                <p className="mt-1.5 text-xs leading-snug text-carvao-muted">Matrícula absoluta depende do tamanho da rede; não há referência nacional comparável.</p>
              </>
            ) : (
              <SemValor ponto={mat} />
            )}
          </Cartao>
        </div>
        <h3 className="rotulo mt-8 text-obee-dark">Atendimento e resultados · {etapaNome}</h3>
        <div className="mt-2 grid gap-px border border-linha bg-linha sm:grid-cols-2 xl:grid-cols-4">
          <Cartao id="atu" rotulo={`Alunos por turma · ${etapaNome}`} periodo={`Censo Escolar ${s.ano} · alunos por turma · ${univ("edu.atu.rede_municipal")}`} acao={pass("edu.atu.rede_municipal", "Passaporte", true)}>
            {!etapaAtu ? (
              <ForaDoEscopo texto={`A média de alunos por turma deste painel cobre creche, pré-escola e ensino fundamental, não ${etapaNome.toLowerCase()}.`} />
            ) : atu && atu.valor !== null ? (
              <>
                <Valor>{decimal(atu.valor, 1)}</Valor>
                <Ressalva ponto={atu} />
                <RefLinha r={refDe("atu")} m="atu" valor={atu.valor} elegivel={atu.elegivel} rotuloGrupo={rotuloGrupo} />
                <RefNacionalLinha externas={ext("atu", s.ano)} valor={atu.valor} elegivel={atu.elegivel} m="atu" nomeCapital={cap.nome} />
              </>
            ) : (
              atu && <SemValor ponto={atu} />
            )}
          </Cartao>
          <Cartao
            id="aprovacao"
            rotulo={`Taxa de aprovação na rede municipal${etapaFund ? ` · ${etapaNome}` : ""}`}
            periodo={`Ano letivo ${s.ano} · % · ${univ("edu.aprovacao.rede_municipal")}`}
            acao={pass("edu.aprovacao.rede_municipal", "Passaporte", true)}
          >
            {!etapaFund ? (
              <ForaDoEscopo texto={`A taxa de aprovação deste painel cobre os anos iniciais e os anos finais do ensino fundamental, não ${etapaNome.toLowerCase()}.`} />
            ) : aprov && aprov.valor !== null ? (
              <>
                <Valor>{percentual(aprov.valor, 1)}</Valor>
                <Ressalva ponto={aprov} />
                <RefLinha r={refDe("aprovacao")} m="aprovacao" valor={aprov.valor} elegivel={aprov.elegivel} rotuloGrupo={rotuloGrupo} />
                <RefNacionalLinha externas={ext("aprovacao", s.ano)} valor={aprov.valor} elegivel={aprov.elegivel} m="aprovacao" nomeCapital={cap.nome} />
              </>
            ) : (
              aprov && <SemValor ponto={aprov} />
            )}
          </Cartao>
          <Cartao
            id="ideb"
            rotulo={`Ideb da rede municipal${etapaFund ? ` · ${etapaNome}` : ""}`}
            periodo={etapaFund ? `Edição ${edicao}${exata ? "" : ` (o Ideb é bienal; não há edição ${s.ano})`} · índice de 0 a 10 · ${univ("edu.ideb.rede_municipal")}` : "Edições bienais · índice de 0 a 10"}
            acao={pass("edu.ideb.rede_municipal", "Passaporte", true)}
          >
            {!etapaFund ? (
              <ForaDoEscopo texto={`O Ideb é calculado para os anos iniciais e os anos finais do ensino fundamental, não para ${etapaNome.toLowerCase()}.`} />
            ) : ideb && ideb.valor !== null ? (
              <>
                <Valor>{decimal(ideb.valor, 1)}</Valor>
                {variacaoAbs(ideb, idebAnt, edicao - 2, 1) && <Detalhe>{variacaoAbs(ideb, idebAnt, edicao - 2, 1)}</Detalhe>}
                <RefLinha r={refDe("ideb", edicao)} m="ideb" valor={ideb.valor} elegivel={ideb.elegivel} rotuloGrupo={rotuloGrupo} />
                <RefNacionalLinha externas={ext("ideb", edicao)} valor={ideb.valor} elegivel={ideb.elegivel} m="ideb" nomeCapital={cap.nome} />
              </>
            ) : (
              ideb && <SemValor ponto={ideb} />
            )}
          </Cartao>
          <Cartao
            id="saeb"
            rotulo={`Saeb, ${s.disc === "matematica" ? "Matemática" : "Língua Portuguesa"}${etapaFund ? ` · ${etapaNome}` : ""}`}
            periodo={etapaFund ? `Edição ${edicao}${exata ? "" : ` (bienal)`} · pontos na escala Saeb · ${univ("edu.saeb.rede_municipal")}` : "Edições bienais · pontos na escala Saeb"}
            acao={pass("edu.saeb.rede_municipal", "Passaporte", true)}
          >
            {!etapaFund ? (
              <ForaDoEscopo texto={`A proficiência no Saeb é divulgada aqui para os anos iniciais e os anos finais do ensino fundamental, não para ${etapaNome.toLowerCase()}.`} />
            ) : saeb && saeb.valor !== null ? (
              <>
                <Valor>{decimal(saeb.valor, 2)}</Valor>
                <Detalhe>Escalas do Saeb não se somam entre disciplinas nem entre anos escolares.</Detalhe>
                <RefLinha r={refDe("saeb", edicao)} m="saeb" valor={saeb.valor} elegivel={saeb.elegivel} rotuloGrupo={rotuloGrupo} />
                <RefNacionalLinha externas={ext("saeb", edicao)} valor={saeb.valor} elegivel={saeb.elegivel} m="saeb" nomeCapital={cap.nome} />
              </>
            ) : (
              saeb && <SemValor ponto={saeb} />
            )}
          </Cartao>
        </div>
        <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
          Despesa total, por habitante e por matrícula não se substituem: a primeira mede volume, a segunda contextualiza o território e a terceira a rede atendida. Os resultados educacionais ao lado são os da
          etapa escolhida; a despesa de toda a educação não é específica dessa etapa e não deve ser lida como o gasto que gerou o resultado.
        </p>
      </section>

      {/* E: série histórica */}
      <Bloco id="serie" rotulo="Explorar · série histórica" titulo={`Séries de ${nomeCap}`}>
        <p className="max-w-prose2 text-[0.95rem] leading-relaxed text-carvao-muted">
          Pequenos múltiplos, um por medida, cada um com a sua unidade e o seu eixo. Não há eixo duplo nem sobreposição de medidas: a
          posição relativa das linhas em painéis diferentes não indica relação entre elas. Etapa selecionada: {etapaNome.toLowerCase()}.
        </p>
        <div className="mt-6 grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
          {series.map(({ m, titulo, zero, anot }) => {
            const md = MEDIDA[m];
            const ok = etapaValida(m, s.etapa);
            const pts = ok ? serie(ix, m, cap.cod, s.etapa, s.moeda, s.disc) : [];
            const sub = `${unidade(m, s.moeda)} · ${md.anos === "financeiros" ? "exercícios" : md.anos === "censo" ? (m === "aprovacao" ? "anos letivos" : "Censo Escolar") : "edições"} ${pts[0]?.ano ?? ""}${pts.length ? `–${pts[pts.length - 1].ano}` : ""}${md.etapas ? ` · ${etapaNome}` : " · todas as etapas"}`;
            return (
              <figure key={m} className="min-w-0">
                <figcaption>
                  <p className="font-semibold leading-snug text-obee-tinta">{titulo}</p>
                  <p className="mt-0.5 text-xs text-carvao-muted">{sub}</p>
                  <p className="text-xs text-carvao-muted">{ficha(md.indicador).universo_rotulo}</p>
                </figcaption>
                <div className="mt-3">
                  {ok ? (
                    <MiniSerie
                      titulo={`${titulo}, ${nomeCap}`}
                      pontos={pts}
                      formata={(v) => formata(m, v)}
                      formataEixo={(v) => formataEixo(m, v)}
                      zero={zero}
                      anotacoes={anot}
                      referencia={pts.map((p) => {
                        const r = refDe(m, p.ano);
                        return { ano: p.ano, valor: r?.mediana ?? null, n: r?.n ?? 0 };
                      })}
                      rotuloReferencia={s.grupo === "regiao" ? `Mediana das capitais da região ${dados.regioes[cap.regiao]}` : "Mediana das capitais"}
                    />
                  ) : (
                    <ForaDoEscopo
                      texto={`${titulo} não existe para ${etapaNome.toLowerCase()}. Etapas com dado: ${(md.etapas ?? [])
                        .map((e) => nomeEtapa(dados, e).toLowerCase())
                        .join(", ")}.`}
                    />
                  )}
                </div>
                {ok && (
                  <details className="mt-2 text-sm">
                    <summary className="rotulo inline-flex min-h-[32px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
                    <TabelaSimples
                      legenda={`${titulo}, ${nomeCap}`}
                      cabecalho={["Ano", "Valor", "Estado do dado"]}
                      linhas={pts.map((p) => [String(p.ano), p.valor !== null ? formata(m, p.valor) : "", ROTULO_STATUS[p.status]])}
                    />
                  </details>
                )}
                <div className="mt-1">{pass(md.indicador, "Passaporte", true)}</div>
              </figure>
            );
          })}
        </div>
      </Bloco>

      {/* F: comparação */}
      <Bloco
        id="comparacao"
        rotulo="Explorar · comparação descritiva"
        titulo={`${med.rotulo}: capitais ${s.grupo === "regiao" ? `da região ${dados.regioes[cap.regiao]}` : "estaduais"}`}
        acao={
          <Alternancia
            rotulo="Ordem das capitais"
            valor={s.ord}
            opcoes={[
              { v: "alfabetica", t: "Alfabética" },
              { v: "valor", t: "Por valor, crescente" },
            ]}
            aoMudar={(v) => definir({ ord: v })}
          />
        }
      >
        <p className="text-sm text-carvao-muted">
          {unidadeMed} · {med.anos === "ideb" ? `edição ${s.ano}` : med.anos === "financeiros" ? `exercício ${s.ano}` : `${s.med === "aprovacao" ? "ano letivo" : "Censo Escolar"} ${s.ano}`}
          {med.etapas ? ` · ${etapaNome}` : " · todas as etapas"}
          {s.med === "saeb" ? ` · ${s.disc === "matematica" ? "Matemática" : "Língua Portuguesa"}` : ""}
        </p>
        <div className="mt-5">
          {!compEtapaOk ? (
            <ForaDoEscopo texto={`${med.rotulo} não existe para ${etapaNome.toLowerCase()}. Escolha uma etapa com dado:`}>
              <div className="mt-3 flex flex-wrap gap-2">
                {(med.etapas ?? []).map((e) => (
                  <button key={e} type="button" onClick={() => definir({ etapa: e })} className="rotulo min-h-[44px] border border-obee px-3 text-obee-dark hover:bg-obee-fundo">
                    {nomeEtapa(dados, e)}
                  </button>
                ))}
              </div>
            </ForaDoEscopo>
          ) : !compAnoOk ? (
            <ForaDoEscopo texto={`O Ideb e o Saeb são bienais: não há edição ${s.ano}. Escolha uma edição:`}>
              <div className="mt-3 flex flex-wrap gap-2">
                {[s.ano - 1, s.ano + 1]
                  .filter((a) => a >= 2021 && a <= 2025)
                  .map((a) => (
                    <button key={a} type="button" onClick={() => definir({ ano: a })} className="rotulo min-h-[44px] border border-obee px-3 text-obee-dark hover:bg-obee-fundo">
                      Edição {a}
                    </button>
                  ))}
              </div>
            </ForaDoEscopo>
          ) : comp && comp.incluidas.length === 0 ? (
            <ForaDoEscopo texto="Nenhuma capital do grupo tem valor observado e comparável neste recorte." />
          ) : (
            comp && (
              <>
                {comp.incluidas.length < 3 && (
                  <p className="mb-3 border-l-2 border-obee pl-3 text-sm text-obee-tinta">
                    Só {comp.incluidas.length} {comp.incluidas.length === 1 ? "capital está" : "capitais estão"} na comparação neste recorte
                    {comp.comValor > comp.incluidas.length ? ` (${comp.comValor} com valor oficial)` : ""}. A mediana de um grupo tão pequeno é pouco
                    informativa.
                  </p>
                )}
                {(s.med === "despesa" || s.med === "matriculas" || s.med === "conveniadas") && (
                  <div className="mb-3">
                    <Alternancia
                      rotulo="Escala do eixo"
                      valor={s.eixo}
                      opcoes={[
                        { v: "linear", t: "Linear (padrão)" },
                        { v: "log", t: "Logarítmica" },
                      ]}
                      aoMudar={(v) => definir({ eixo: v })}
                    />
                    <p className="mt-1 text-xs text-carvao-muted">
                      Em volume, uma capital muito maior estica o eixo e comprime as demais. Nenhuma capital é omitida nem o eixo é cortado; a escala logarítmica separa as menores, e a diferença real em reais só se lê na linear.
                    </p>
                  </div>
                )}
                <GraficoPontosPares
                  titulo={`${med.rotulo}, ${s.ano}`}
                  linhas={comp.incluidas.map((i) => ({
                    chave: i.cap.id,
                    rotulo: `${i.cap.nome} (${i.cap.uf})${i.ponto.nota ? " *" : ""}`,
                    valor: i.valor,
                    selecionada: i.cap.id === cap.id,
                  }))}
                  referencias={{
                    mediana: comp.ref?.mediana ?? null,
                    media: comp.ref?.media ?? null,
                    faixa: comp.ref && comp.ref.quartisExibicao && comp.ref.q1 !== null && comp.ref.q3 !== null ? { q1: comp.ref.q1, q3: comp.ref.q3 } : null,
                    externas: extMesmo.map((e) => ({ rotulo: e.rotulo, valor: e.valor })),
                  }}
                  formata={fmt}
                  formataEixo={fmtCurto}
                  zero={s.med === "despesa" || s.med === "matriculas" || s.med === "conveniadas" || s.med === "despesa_hab" || s.med === "despesa_mat"}
                  escala={s.eixo}
                />
                <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-carvao-muted">
                  <span>Toque ou passe o ponteiro numa linha para ver o valor exato.</span>
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-2"
                    onClick={() => {
                      const d = document.getElementById("tabela-comparacao") as HTMLDetailsElement | null;
                      if (!d) return;
                      d.open = true;
                      d.scrollIntoView({ block: "start" });
                      d.querySelector("summary")?.focus();
                    }}
                  >
                    Ver todos os valores na tabela
                  </button>
                  <a href="#tabela-comparativa" className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-2">
                    Ir à tabela comparativa completa
                  </a>
                </p>
                {LEITURA[s.med] && <p className="mt-3 max-w-prose2 border-l-2 border-obee pl-3 text-sm leading-relaxed text-obee-tinta">{LEITURA[s.med]}</p>}
                {comp.ref && (
                  <div className="mt-4">
                    <p className="rotulo text-mineral">Resumo do grupo ({comp.ref.n} {comp.ref.n === 1 ? "capital" : "capitais"} na comparação)</p>
                    <div className="mt-2">
                      <ResumoGrupo r={comp.ref} m={s.med} rotuloGrupo={rotuloGrupo} textoRazao={textoRazao} />
                    </div>
                    <p className="mt-2 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                      A média simples dá o mesmo peso a cada capital; a mediana é o valor do meio. A média e a mediana do grupo de capitais não são metas, padrões nem estatísticas nacionais. Menor gasto não demonstra eficiência, e gasto maior não demonstra qualidade.
                    </p>
                  </div>
                )}
                {selPonto && comp.ref && (
                  <p className="mt-3 text-sm leading-relaxed text-obee-tinta">
                    <span className="font-semibold">{nomeCap}:</span> {fmt(selPonto.valor)}.{" "}
                    {diferenca(s.med, selPonto.valor, comp.ref.mediana)?.texto
                      ? `Diferença: ${diferenca(s.med, selPonto.valor, comp.ref.mediana)?.texto}.`
                      : ""}
                  </p>
                )}
                {extComp.length > 0 && (
                  <div className="mt-4">
                    <p className="rotulo text-mineral">Referência nacional oficial (escopo declarado)</p>
                    <div className="mt-2">
                      <ReferenciasNacionais externas={extComp} valor={selPonto?.valor ?? null} m={s.med} nomeCapital={nomeCap} />
                    </div>
                  </div>
                )}
                {comp.incluidas.every((i) => i.cap.id !== cap.id) && (
                  <p className="mt-2 text-sm text-obee-tinta">{nomeCap} não está entre as capitais incluídas neste recorte; o motivo está na lista abaixo.</p>
                )}
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="text-sm leading-relaxed text-obee-tinta">
                    <p className="rotulo text-mineral">Critério do grupo, definido antes dos valores</p>
                    <p className="mt-1">{comp.criterio}</p>
                    <p className="mt-2">
                      <span className="text-carvao-muted">O que o indicador mede:</span> {comp.universoIndicador}
                    </p>
                    <dl className="mt-3 grid grid-cols-3 gap-px border border-linha bg-linha text-center">
                      {[
                        ["Capitais no grupo", comp.universo.length],
                        ["Com valor oficial", comp.comValor],
                        ["Na comparação", comp.incluidas.length],
                      ].map(([t, n]) => (
                        <div key={String(t)} className="bg-superficie px-2 py-2">
                          <dt className="text-xs leading-tight text-carvao-muted">{t}</dt>
                          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-obee-tinta">{n}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3">
                      A comparação é descritiva: não ajusta por renda, composição da rede ou atribuições de cada município. As referências são do grupo
                      de {comp.incluidas.length} capitais na comparação, sem ponderação; não são estatística nacional, meta nem valor de referência.
                    </p>
                    {comp.incluidas.some((i) => i.ponto.nota) && (
                      <div className="mt-3">
                        <p className="rotulo text-mineral">* Incluídas com nota</p>
                        <ul className="mt-1 space-y-1.5">
                          {Array.from(
                            comp.incluidas
                              .filter((i) => i.ponto.nota)
                              .reduce((m, i) => m.set(i.ponto.nota as string, [...(m.get(i.ponto.nota as string) ?? []), `${i.cap.nome} (${i.cap.uf})`]), new Map<string, string[]>())
                              .entries(),
                          ).map(([nota, caps]) => (
                            <li key={nota} className="leading-snug">
                              <span className="font-semibold">{caps.length > 6 ? `${caps.length} das capitais na comparação` : caps.join(", ")}</span>: {nota}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-obee-tinta">
                    <p className="rotulo text-mineral">Fora da comparação neste recorte ({comp.excluidas.length})</p>
                    {comp.excluidas.length ? (
                      <ul className="mt-1 space-y-1.5">
                        {comp.excluidas.map((e) => (
                          <li key={e.cap.id} className="leading-snug">
                            <span className="font-semibold">
                              {e.cap.nome} ({e.cap.uf})
                            </span>
                            : {e.comValor ? `valor oficial ${formata(s.med, e.ponto.valor as number)}, fora da comparação` : ROTULO_STATUS[e.status].toLowerCase()}
                            {e.motivo ? `. ${e.motivo}` : "."}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1">Nenhuma: todas as capitais do grupo têm valor.</p>
                    )}
                  </div>
                </div>
                <details id="tabela-comparacao" className="mt-5 scroll-mt-24 text-sm">
                  <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ver tabela da comparação</summary>
                  <TabelaSimples legenda={`${med.rotulo}, ${s.ano}, por capital`} cabecalho={["Capital", `Valor (${unidadeMed})`, "Situação"]} linhas={linhasComp} />
                </details>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <button type="button" onClick={csvComp} className="rotulo min-h-[44px] border border-obee-tinta px-4 text-obee-tinta hover:bg-obee-tinta hover:text-superficie">
                    Baixar esta comparação (CSV)
                  </button>
                  {pass(med.indicador)}
                </div>
              </>
            )
          )}
        </div>
      </Bloco>

      {/* tabela comparativa completa */}
      <Bloco id="tabela-comparativa" rotulo="Explorar · capitais lado a lado" titulo="Tabela comparativa: gasto, população, matrículas e resultados">
        <TabelaComparativa
          ix={ix}
          dados={dados}
          ano={s.ano}
          etapa={s.etapa}
          moeda={s.moeda}
          disc={s.disc}
          grupo={s.grupo}
          cap={cap}
          medida={s.med}
          ordem={s.ot}
          decrescente={s.od === "desc"}
          visao={s.vc}
          aoOrdenar={(c) => definir(s.ot === c ? { od: s.od === "asc" ? "desc" : "asc" } : { ot: c, od: "asc" })}
          aoVisao={(v) => definir({ vc: v })}
          aoSelecionar={(id) => {
            definir({ cap: id });
            setAviso(`Capital selecionada: ${dados.capitais.find((c) => c.id === id)?.nome}.`);
            document.getElementById("orientacao")?.scrollIntoView({ block: "start" });
          }}
          aoBaixar={() => {
            const t = tabelaComparativa(ix, s.ano, s.etapa, s.moeda, s.disc, s.grupo, cap, s.med);
            baixar(
              `obee_tabela_comparativa_${s.ano}_${s.etapa}${s.grupo === "regiao" ? `_regiao_${cap.regiao}` : ""}.csv`,
              csv(CABECALHO_CSV_TABELA_COMPARATIVA, linhasCsvTabelaComparativa(dados, t, s.ano, s.etapa, s.moeda, s.grupo, cap, s.med, ix, s.disc)),
            );
          }}
        />
        <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-obee-tinta">
          <span className="font-semibold">Por que não há um gráfico de gasto contra resultado.</span> A despesa por matrícula cobre toda a rede municipal, de creche a EJA; o Ideb e o Saeb cobrem só os anos iniciais ou
          finais do ensino fundamental, das escolas com resultado divulgado, em edições bienais. Universos e períodos diferentes não permitem ler um contra o outro sem sugerir uma relação que a fonte não sustenta. Por isso
          o painel os põe lado a lado, cada um com o seu universo e o seu ano, e não desenha quadrantes, linha de tendência nem nota.
        </p>
      </Bloco>

      {/* referências */}
      <Bloco id="referencias" rotulo="Contextualizar · referências" titulo={`Referências para ${med.rotulo.toLowerCase()}`}>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <h3 className="font-semibold text-obee-tinta">Do próprio município e do grupo</h3>
            <p className="text-sm leading-relaxed text-obee-tinta">
              O histórico de {nomeCap} está nas séries acima, com a mediana do grupo em cada ano em linha tracejada. A média simples, a mediana, os extremos e, em grupos de 8 ou mais capitais, a faixa dos 50% centrais estão
              no resumo do grupo, sob o gráfico da comparação, e no CSV de referências.
            </p>
            {comp?.ref ? (
              <ResumoGrupo r={comp.ref} m={s.med} rotuloGrupo={rotuloGrupo} textoRazao={textoRazao} />
            ) : (
              <SemReferencia medida={s.med} motivo="Escolha uma etapa e um ano em que a medida exista para ver o resumo do grupo." />
            )}
            <a href="/eficiencia/series/referencias_educacao_capitais.csv" className="inline-flex min-h-[44px] items-center text-sm text-obee-dark underline underline-offset-2">
              Baixar as referências de todos os indicadores, anos e grupos (CSV)
            </a>
          </div>
          <div className="min-w-0 space-y-4">
            <h3 className="font-semibold text-obee-tinta">Referência nacional oficial</h3>
            {extComp.length ? (
              <ReferenciasNacionais externas={extComp} valor={selPonto?.valor ?? null} m={s.med} nomeCapital={nomeCap} />
            ) : (
              <SemReferencia medida={s.med} motivo={SEM_NACIONAL[s.med]} />
            )}
          </div>
        </div>
        <div className="mt-8">
          <h3 className="font-semibold text-obee-tinta">Contexto internacional (outro universo, sem comparação direta)</h3>
          {intl.length ? (
            <div className="mt-3">
              <ContextoInternacionalBloco grupos={intl} anoPainel={s.ano} />
            </div>
          ) : (
            <div className="mt-3">
              <SemReferencia medida={s.med} motivo={SEM_INTERNACIONAL[s.med]} />
            </div>
          )}
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="font-semibold text-obee-tinta">Meta ou parâmetro oficial</h3>
            <p className="mt-2 text-sm leading-relaxed text-obee-tinta">
              Nenhuma meta ou parâmetro oficial aplicável a esta medida foi identificado. As metas do Ideb ficam fora do painel (a exibição induziria leitura de cumprimento), e os parâmetros de financiamento do Fundeb não são
              despesa executada: não substituem o gasto por matrícula.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-obee-tinta">Como ler uma referência</h3>
            <p className="mt-2 text-sm leading-relaxed text-obee-tinta">
              Média não é meta. Máximo não é ideal. Menor gasto não demonstra eficiência, e gasto maior não demonstra qualidade. Um indicador isolado tampouco demonstra causalidade. Todas as candidatas a referência
              examinadas, aceitas, contextuais e rejeitadas, com o motivo, estão na{" "}
              <a href="#matriz-referencias" className="text-obee-dark underline underline-offset-2">
                matriz de referências
              </a>
              .
            </p>
          </div>
        </div>
      </Bloco>

      {/* G: decomposição */}
      <Bloco id="decomposicao" rotulo="Explorar · decomposição" titulo={`Composição em ${nomeCap}, ${s.ano}`}>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-obee-tinta">Despesa liquidada na função Educação, por subfunção</h3>
            <p className="mt-0.5 text-xs text-carvao-muted">% do total da função · exercício {s.ano} · valores nominais · ordem da classificação funcional</p>
            {compDesp.inconsistente ? (
              <SemValor ponto={{ ...compDesp.total, status: "INCONSISTENTE" }} contexto="A soma das subfunções não reconcilia com o total da função; a composição não é exibida." />
            ) : compDesp.total.valor === null ? (
              <SemValor ponto={compDesp.total} />
            ) : (
              <>
                <div className="mt-4">
                  <BarrasComposicao
                    linhas={compDesp.linhas.map((l) => ({ chave: l.codigo, rotulo: l.rotulo, pct: l.participacao, detalhe: percentual(l.participacao, 1) }))}
                  />
                </div>
                <p className="mt-4 text-sm text-obee-tinta">
                  <span aria-hidden="true">✓ </span>
                  Soma das subfunções: {reaisCompleto(somaSub)}, igual ao total da função ({reaisCompleto(compDesp.total.valor)}), com tolerância de R$ 1,00.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                  A classificação por subfunção segue a prática contábil de cada município: despesas comuns a várias etapas podem estar em
                  administração geral, em demais subfunções ou distribuídas nas subfunções de etapa. A composição não mede o custo de cada etapa.
                </p>
                <details className="mt-2 text-sm">
                  <summary className="rotulo inline-flex min-h-[32px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
                  <TabelaSimples
                    legenda={`Despesa por subfunção, ${nomeCap}, ${s.ano}`}
                    cabecalho={["Subfunção", "R$", "% da função"]}
                    linhas={[
                      ...compDesp.linhas.map((l) => [l.rotulo, reaisCompleto(l.valor), percentual(l.participacao, 2)]),
                      ["Total da função Educação", reaisCompleto(compDesp.total.valor), "100,00%"],
                    ]}
                  />
                </details>
              </>
            )}
            <div className="mt-1">{pass("edu.despesa.subfuncao", "Passaporte", true)}</div>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-obee-tinta">Matrículas na rede municipal, por etapa</h3>
            <p className="mt-0.5 text-xs text-carvao-muted">matrículas e % do total da rede · Censo Escolar {s.ano} · etapas mutuamente exclusivas</p>
            {distMat.total.valor === null || distMat.total.valor === 0 ? (
              <SemValor ponto={distMat.total} />
            ) : (
              <>
                <div className="mt-4">
                  <BarrasComposicao
                    linhas={distMat.linhas
                      .filter((l) => l.rede !== null)
                      .map((l) => ({
                        chave: l.etapa,
                        rotulo: l.rotulo,
                        pct: (100 * (l.rede ?? 0)) / distMat.total.valor!,
                        detalhe: `${inteiro(l.rede ?? 0)} (${percentual((100 * (l.rede ?? 0)) / distMat.total.valor!, 1)})`,
                      }))}
                  />
                </div>
                <p className="mt-4 text-sm text-obee-tinta">
                  <span aria-hidden="true">✓ </span>
                  Soma das etapas: {inteiro(distMat.linhas.reduce((a, l) => a + (l.rede ?? 0), 0))}, igual ao total da rede ({inteiro(distMat.total.valor)}).
                </p>
                <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                  A educação especial é uma modalidade transversal, já contada nas etapas. Matrículas em escolas privadas conveniadas com o
                  município aparecem só na tabela, em coluna separada, e não entram na soma.
                </p>
                <details className="mt-2 text-sm">
                  <summary className="rotulo inline-flex min-h-[32px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
                  <TabelaSimples
                    legenda={`Matrículas por etapa, ${nomeCap}, ${s.ano}`}
                    cabecalho={["Etapa", "Rede municipal", "Conveniadas com o município (à parte)"]}
                    linhas={[
                      ...distMat.linhas.map((l) => [l.rotulo, l.rede !== null ? inteiro(l.rede) : "", l.conveniadas !== null ? inteiro(l.conveniadas) : ""]),
                      ["Total da educação básica", inteiro(distMat.total.valor), convTotal.valor !== null ? inteiro(convTotal.valor) : ""],
                    ]}
                  />
                </details>
              </>
            )}
            <div className="mt-1">{pass("edu.matriculas.rede_municipal", "Passaporte", true)}</div>
          </div>
        </div>
        <div className="mt-12 border-t border-linha pt-8" id="ponte">
          <h3 className="font-semibold text-obee-tinta">Da despesa total à despesa por matrícula: o que entra e o que fica fora</h3>
          <p className="mt-0.5 text-xs text-carvao-muted">R$ correntes · exercício {s.ano} · Matriz de Saldos Contábeis de dezembro, função 12, e DCA · {nomeCap}</p>
          {!ponte.linhas.length ? (
            <SemValor ponto={dmat} contexto="A Matriz de Saldos Contábeis de dezembro não está disponível para esta capital e este exercício: a ponte não existe." />
          ) : (
            <>
              <p className="mt-2 max-w-prose2 text-sm leading-relaxed text-obee-tinta">
                O total declarado na DCA é separado em parcelas mutuamente exclusivas, linha a linha da MSC. Só a aplicação direta na rede própria entra no numerador da despesa por matrícula; as demais parcelas ficam fora porque não têm matrícula correspondente no
                denominador. Nenhuma despesa é rateada por etapa e nenhuma matrícula conveniada é somada ao denominador.
              </p>
              <p className="mt-4 text-sm text-obee-tinta">
                <span className="font-semibold">Total declarado na DCA:</span> {reaisExtenso(ponte.total ?? 0)} (100%). Parcelas, em % do total:
              </p>
              <div className="mt-2 max-w-prose2">
                <BarrasComposicao
                  linhas={ponte.linhas
                    .filter((l) => l.componente !== "dca_total")
                    .map((l) => ({
                      chave: l.componente,
                      rotulo: `${l.dentro ? "Dentro do numerador: " : "Fora do numerador: "}${l.rotulo}`,
                      pct: Math.max(0, l.participacao ?? 0),
                      detalhe: `${reaisExtenso(l.valor)} (${percentual(l.participacao ?? 0, 1)})`,
                    }))}
                />
              </div>
              <p className="mt-3 text-sm text-obee-tinta">
                {ponte.reconcilia ? (
                  <>
                    <span aria-hidden="true">✓ </span>A soma das parcelas, com a diferença entre a DCA e a MSC (quando existe), é igual ao total da função na DCA ({reaisCompleto(ponte.total ?? 0)}).
                  </>
                ) : (
                  <>A MSC não reconcilia com a DCA neste exercício: as parcelas aparecem para transparência, mas o numerador por matrícula não é publicado.</>
                )}
              </p>
              <details className="mt-2 text-sm">
                <summary className="rotulo inline-flex min-h-[32px] cursor-pointer items-center text-obee-dark">Ver tabela</summary>
                <TabelaSimples
                  legenda={`Ponte da despesa por matrícula, ${nomeCap}, ${s.ano}`}
                  cabecalho={["Parcela", "R$", "% do total da DCA"]}
                  linhas={ponte.linhas.map((l) => [l.rotulo, reaisCompleto(l.valor), l.participacao === null ? "" : percentual(l.participacao, 2)])}
                />
              </details>
              <div className="mt-2 flex flex-wrap gap-x-6">{pass("edu.despesa.ponte_matricula", "Passaporte da ponte", true)}</div>
            </>
          )}
        </div>
      </Bloco>

      {/* H: tabela auditável */}
      <Bloco
        id="tabela"
        rotulo="Auditar · tabela"
        titulo={`Todos os valores de ${nomeCap}, ${s.ano}`}
        acao={
          <button
            type="button"
            onClick={() => baixar(`obee_educacao_${cap.id}_${s.ano}.csv`, csv(CABECALHO_CSV_TABELA, linhasCsvTabela(dados, cap, tabela)))}
            className="rotulo min-h-[44px] border border-obee-tinta px-4 text-obee-tinta hover:bg-obee-tinta hover:text-superficie"
          >
            Baixar esta tabela (CSV, {tabela.length} linhas)
          </button>
        }
      >
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          Os mesmos valores dos gráficos e números acima, com período, unidade, estado do dado e fonte. Ideb e Saeb entram pela edição {edicao}
          {exata ? "" : ` (não há edição ${s.ano})`}. O download contém exatamente estas {tabela.length} linhas.
        </p>
        <div className="tabela-scroll mt-4 max-h-[36rem] overflow-y-auto border border-linha" tabIndex={0} role="region" aria-label="Tabela auditável (role na horizontal e na vertical)">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <caption className="sr-only">
              Valores de {nomeCap} em {s.ano}, por medida, etapa e componente
            </caption>
            <thead className="sticky top-0 bg-superficie">
              <tr>
                {CABECALHO_TABELA.map((c) => (
                  <th key={c} scope="col" className="border-b border-carvao-muted px-2.5 py-2 text-left font-semibold text-obee-tinta">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.map((l, i) => (
                <tr key={i} className="border-b border-linha align-top">
                  <th scope="row" className="px-2.5 py-1.5 text-left font-normal text-obee-tinta">
                    {l.medida}
                  </th>
                  <td className="px-2.5 py-1.5 text-obee-tinta">{l.etapa}</td>
                  <td className="px-2.5 py-1.5 text-obee-tinta">{l.componente}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-obee-tinta">{l.periodo}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right text-obee-tinta">
                    {l.valor}
                    {l.participacao && <span className="block text-xs text-carvao-muted">{percentual(Number(l.participacao), 1)} da função</span>}
                  </td>
                  <td className="px-2.5 py-1.5 text-carvao-muted">{l.unidade}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-obee-tinta">{ROTULO_STATUS[l.status]}</td>
                  <td className={`px-2.5 py-1.5 ${l.status === "OBSERVADO" && !l.elegivel ? "font-semibold text-obee-tinta" : "text-carvao-muted"}`}>
                    {rotuloComparacao(l)}
                    {l.situacao && <span className="block text-xs font-normal text-carvao-muted">{l.situacao}</span>}
                  </td>
                  <td className="max-w-[22rem] px-2.5 py-1.5 text-xs leading-snug text-carvao-muted">{l.nota}</td>
                  <td className="px-2.5 py-1.5 text-xs text-carvao-muted">{l.fonte}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </div>
  );
}

function Cartao({ id, rotulo, periodo, children, acao }: { id: string; rotulo: string; periodo: string; children: ReactNode; acao: ReactNode }) {
  return (
    <div data-cartao={id} className="flex flex-col bg-superficie px-5 py-5">
      <p className="text-sm font-semibold leading-snug text-obee-tinta">{rotulo}</p>
      <p className="mt-0.5 text-xs leading-snug text-carvao-muted">{periodo}</p>
      <div className="mt-3 flex-1">{children}</div>
      <div className="mt-2">{acao}</div>
    </div>
  );
}

function Valor({ children }: { children: ReactNode }) {
  return <p className="text-[1.9rem] font-semibold leading-tight tracking-tight text-obee-tinta">{children}</p>;
}

function Detalhe({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs leading-snug text-carvao-muted">{children}</p>;
}
