"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { ExportacaoComConta } from "@/components/acesso/ExportacaoComConta";
import { Controles, FaixaNumeros, FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, NumeroIndicador, type NumeroProps } from "@/components/painel";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";
import { provenienciaObee } from "@/lib/eficiencia/proveniencia";
import { BASE, formato, nomeTerritorio, type Snapshot } from "./modelo";
import { SeletorTerritorioTrabalho } from "./SeletorTerritorioTrabalho";

/**
 * Explorador de uma página de Trabalho e renda no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). A página do servidor
 * (PaginaTrabalho) monta a abertura; aqui ficam as peças que seguem o recorte da URL (medida, território, período, população e grupo):
 * a faixa de números, os controles logo antes das figuras, as figuras (faixas de renda, grupos ocupacionais, evolução, comparação
 * estadual ou a série complementar do emprego formal) e o método da medida escolhida. Um só modelo para todas as páginas do tema que
 * exploram medidas; as peças são ilhas separadas que leem o mesmo recorte (useEstadoUrl avisa as outras a cada mudança).
 */

type Obs = Snapshot["observacoes"][number];
type Indicador = Snapshot["indicadores"][number];
type Fonte = Snapshot["fontes"][number];

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function celula(v: unknown) {
  return `"${String(v ?? "").replaceAll('"', '""')}"`;
}

/** Natureza do dado pela fonte: estimativas amostrais do IBGE, registros administrativos publicados e a variação calculada aqui. */
export function naturezaDe(med: Indicador): Natureza {
  if (med.id === "saldo-formal") return "CALCULADO";
  if (med.fonteId.startsWith("pnad") || med.fonteId.startsWith("censo")) return "ESTIMADO";
  return "OBSERVADO";
}

/**
 * Período da fonte ("202602", "202609", "2023-09", "2022") na forma que a figura e o diálogo de proveniência formatam: ano ou ano e mês.
 * Seis algarismos são trimestre (AAAATT) na PNAD trimestral e mês (AAAAMM) nos retratos do Cadastro Único: `trimestral` decide.
 */
function referenciaPeriodo(p: string | number, trimestral: boolean): string {
  const s = String(p);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{6}$/.test(s)) {
    const n = Number(s.slice(4));
    // trimestre: o último mês do trimestre; mês: o próprio mês
    if (trimestral) return n >= 1 && n <= 4 ? `${s.slice(0, 4)}-${String(n * 3).padStart(2, "0")}` : s.slice(0, 4);
    return n >= 1 && n <= 12 ? `${s.slice(0, 4)}-${s.slice(4)}` : s.slice(0, 4);
  }
  return s.slice(0, 4);
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Todos os períodos entre o primeiro e o último da série, no calendário da fonte; o que falta vira lacuna (null), nunca ponte. */
export function comLacunas(serie: Obs[]): { periodo: string; nome: string; valor: number | null; status: string }[] {
  if (!serie.length) return [];
  const p0 = serie[0].periodo;
  const pN = serie[serie.length - 1].periodo;
  const porPeriodo = new Map(serie.map((o) => [o.periodo, o]));
  const todos: { periodo: string; nome: string }[] = [];
  const trimestral = /trimestre/.test(serie[0].periodoNome);
  // limite de passos: um calendário que não reconhecemos nunca vira laço sem fim (a série fica sem lacunas preenchidas)
  const MAX = 1200;
  if (/^\d{4}-\d{2}$/.test(p0)) {
    for (let a = Number(p0.slice(0, 4)), m = Number(p0.slice(5)); `${a}-${String(m).padStart(2, "0")}` <= pN && todos.length < MAX; m === 12 ? ((m = 1), a++) : m++)
      todos.push({ periodo: `${a}-${String(m).padStart(2, "0")}`, nome: `${MESES[m - 1]} de ${a}` });
  } else if (/^\d{6}$/.test(p0) && trimestral) {
    for (let a = Number(p0.slice(0, 4)), t = Number(p0.slice(4)); `${a}${String(t).padStart(2, "0")}` <= pN && todos.length < MAX; t === 4 ? ((t = 1), a++) : t++)
      todos.push({ periodo: `${a}${String(t).padStart(2, "0")}`, nome: `${t}º trimestre ${a}` });
  } else if (/^\d{6}$/.test(p0)) {
    for (let a = Number(p0.slice(0, 4)), m = Number(p0.slice(4)); `${a}${String(m).padStart(2, "0")}` <= pN && todos.length < MAX; m === 12 ? ((m = 1), a++) : m++)
      todos.push({ periodo: `${a}${String(m).padStart(2, "0")}`, nome: `${MESES[m - 1]} de ${a}` });
  } else if (/^\d{4}$/.test(p0)) {
    for (let a = Number(p0); String(a) <= pN && todos.length < MAX; a++) todos.push({ periodo: String(a), nome: String(a) });
  }
  if (!todos.length || todos.length >= MAX) return serie.map((o) => ({ periodo: o.periodo, nome: o.periodoNome, valor: o.valor, status: o.status }));
  return todos.map((x) => {
    const o = porPeriodo.get(x.periodo);
    return o ? { periodo: o.periodo, nome: o.periodoNome, valor: o.valor, status: o.status } : { periodo: x.periodo, nome: x.nome, valor: null, status: "sem observação nesta publicação" };
  });
}

/** O recorte em vigor e tudo o que dele se calcula: a mesma regra para faixa, gráficos, tabelas e CSV. */
function useRecorteTrabalho(dados: Snapshot, ids: string[]) {
  const idsKey = ids.join(",");
  const indicadores = useMemo(
    () =>
      idsKey
        .split(",")
        .map((id) => dados.indicadores.find((i) => i.id === id))
        .filter((i): i is Indicador => Boolean(i)),
    [dados, idsKey],
  );
  const territorios = dados.territorios;
  const grupos = useMemo(() => Array.from(new Set(dados.observacoes.map((o) => o.grupo))).sort((a, b) => (a === "Total" ? -1 : b === "Total" ? 1 : a.localeCompare(b, "pt-BR"))), [dados]);
  const nacional = territorios.find((t) => t.nivel === "brasil") ?? territorios[0];
  const esquema = useMemo(
    () => ({
      med: campo(tiposUrl.opcao(indicadores.map((i) => i.id)), indicadores[0]?.id ?? ""),
      ter: campo(tiposUrl.opcao(territorios.map((t) => t.id)), nacional?.id ?? ""),
      per: campo(tiposUrl.texto({ max: 20 }), ""),
      sexo: campo(tiposUrl.opcao(["total", "homens", "mulheres"] as const), "total" as const),
      grp: campo(tiposUrl.opcao(grupos), "Total"),
    }),
    [indicadores, territorios, nacional?.id, grupos],
  );
  const [estado, definir] = useEstadoUrl(esquema);
  const med = indicadores.find((i) => i.id === estado.med) ?? indicadores[0];
  const ter = territorios.find((t) => t.id === estado.ter) ?? nacional;
  const baseMed = dados.observacoes.filter((o) => o.indicadorId === med?.id);
  const elegiveis = new Set(baseMed.map((o) => o.territorioId));
  const gruposMed = Array.from(new Set(baseMed.filter((o) => o.territorioId === ter?.id).map((o) => o.grupo)));
  const sexosMed = Array.from(new Set(baseMed.filter((o) => o.territorioId === ter?.id && o.grupo === estado.grp).map((o) => o.sexo)));
  const linhas = baseMed.filter((o) => o.sexo === estado.sexo && o.grupo === estado.grp);
  const estrutural = med?.fonteId.startsWith("censo") ?? false;
  const formal = ["estoque-formal", "saldo-formal"].includes(med?.id ?? "");
  const periodos = Array.from(new Map(linhas.map((o) => [o.periodo, o.periodoNome])).entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const periodo = periodos.some((p) => p[0] === estado.per) ? estado.per : (periodos.at(-1)?.[0] ?? "");
  const serie = linhas.filter((o) => o.territorioId === ter?.id).sort((a, b) => a.periodo.localeCompare(b.periodo));
  const selecionado = serie.find((o) => o.periodo === periodo);
  const anterior = serie.filter((o) => o.periodo < periodo && o.valor !== null).at(-1);
  const fonte = dados.fontes.find((f) => f.id === (selecionado?.fonteId ?? linhas.find((o) => o.territorioId === ter?.id)?.fonteId ?? med?.fonteId));
  const quebraVisita = fonte?.limitacoes.some((n) => n.includes("2020") && n.includes("visita")) ?? false;
  const pares = linhas
    .filter((o) => o.periodo === periodo && territorios.some((t) => t.id === o.territorioId && t.nivel === "uf"))
    .map((o) => ({ ...o, nome: territorios.find((t) => t.id === o.territorioId)?.nome ?? o.territorioId }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const disponiveis = serie.filter((o) => o.valor !== null);
  const porcentagem = med?.unidade.includes("%") || med?.unidade.toLowerCase().includes("percent");
  const diferenca = selecionado?.valor !== null && selecionado?.valor !== undefined && anterior?.valor !== null && anterior?.valor !== undefined ? selecionado.valor - anterior.valor : null;
  const nomePeriodo = periodos.find((p) => p[0] === periodo)?.[1] ?? "Sem período";
  const foraDaCobertura = !!ter && (!elegiveis.has(ter.id) || !sexosMed.includes(estado.sexo) || !gruposMed.includes(estado.grp));
  const ufsElegiveis = Array.from(elegiveis).filter((id) => territorios.some((t) => t.id === id && t.nivel === "uf")).length;
  const csv = (obs: Obs[]) =>
    [
      "territorio;indicador;unidade;periodo;sexo;grupo;valor;estado;cv_percentual;fonte;universo;limitacao;capturado_em",
      ...obs.map((o) =>
        [
          territorios.find((t) => t.id === o.territorioId)?.nome,
          med?.nome,
          med?.unidade,
          o.periodoNome,
          o.sexo,
          o.grupo ?? "total",
          o.valor === null ? "" : String(o.valor).replace(".", ","),
          o.status,
          o.cv,
          dados.fontes.find((f) => f.id === o.fonteId)?.consulta ?? fonte?.url,
          med?.universo,
          med?.limitacao,
          dados.capturadoEm,
        ]
          .map(celula)
          .join(";"),
      ),
    ].join("\r\n");
  return { indicadores, territorios, grupos, nacional, estado, definir, med, ter, elegiveis, gruposMed, sexosMed, linhas, estrutural, formal, periodos, periodo, serie, selecionado, anterior, fonte, quebraVisita, pares, disponiveis, porcentagem, diferenca, nomePeriodo, foraDaCobertura, ufsElegiveis, csv };
}

/** Proveniência da medida escolhida, a partir da fonte registrada no snapshot (página oficial, consulta, captura e limitações). */
export function provenienciaTrabalho(dados: Snapshot, med: Indicador, fonte: Fonte | undefined, serie: Obs[]): Proveniencia {
  const nome = fonte?.nome ?? med.fonteId;
  const [orgao, ...resto] = nome.split(" · ");
  const trimestral = fonte?.periodo.frequencia === "trimestral";
  return provenienciaObee({
    indicador: med.nome,
    natureza: naturezaDe(med),
    orgao,
    dataset: resto.join(", ") || nome,
    recurso: fonte?.consulta,
    url: fonte?.url ?? "",
    urlPrimaria: fonte?.consulta,
    unidade: med.unidade,
    frequencia: fonte?.periodo.frequencia ?? "não informada",
    inicio: referenciaPeriodo(serie[0]?.periodo ?? fonte?.periodo.inicio ?? "", trimestral),
    fim: referenciaPeriodo(serie.at(-1)?.periodo ?? fonte?.periodo.fim ?? "", trimestral),
    cobertura: fonte ? { inicio: referenciaPeriodo(fonte.periodo.inicio, trimestral), fim: referenciaPeriodo(fonte.periodo.fim, trimestral) } : undefined,
    capturadoEm: fonte?.capturadoEm ?? dados.capturadoEm,
    limitacoes: [med.limitacao, ...(fonte?.limitacoes ?? [])],
    notas: `${med.universo}${fonte ? ` Fonte: ${fonte.universo}` : ""}`,
    snapshot: fonte ? { id: fonte.bruto, sha256: fonte.sha256 } : undefined,
  });
}

const NAO_DEMONSTRA = "Não identifica causas, qualidade da gestão ou trajetória de uma pessoa. Média e mediana são medidas distintas; o rendimento real do trabalho não equivale à renda domiciliar por pessoa.";
const PERMITE = "Comparar a mesma medida no tempo ou entre territórios compatíveis. O recorte por população altera o universo e deve acompanhar qualquer comparação.";

/** A faixa de números: o valor do recorte, a diferença para o período anterior e a cobertura da comparação estadual. */
/**
 * A base da página vai ao navegador uma vez só: a faixa de números, o explorador e o método são ilhas de cliente que leem o mesmo
 * recorte, e cada uma recebendo a base por prop a serializava de novo no HTML (de 1,7 MB para 3,6 MB na página de acesso ao trabalho).
 */
const ContextoTrabalho = createContext<Snapshot | null>(null);

export function ProvedorTrabalho({ dados, children }: { dados: Snapshot; children: ReactNode }) {
  return <ContextoTrabalho.Provider value={dados}>{children}</ContextoTrabalho.Provider>;
}

export function useBaseTrabalho(dados?: Snapshot): Snapshot {
  const doContexto = useContext(ContextoTrabalho);
  const base = dados ?? doContexto;
  if (!base) throw new Error("Base de Trabalho e renda ausente: passe `dados` ou use ProvedorTrabalho.");
  return base;
}

export function FaixaTrabalho({ dados: dadosProp, ids }: { dados?: Snapshot; ids: string[] }) {
  const dados = useBaseTrabalho(dadosProp);
  const r = useRecorteTrabalho(dados, ids);
  const { med, ter, estado, selecionado, anterior, fonte, estrutural, formal, diferenca, porcentagem, pares, ufsElegiveis, nomePeriodo, periodos, periodo } = r;
  if (!med || !ter) return null;
  const nomeFonte = (fonte?.nome ?? med.fonteId).replace(" · ", ", ");
  const recorte = `${estado.sexo} · ${estado.grp}${selecionado?.cv !== null && selecionado?.cv !== undefined ? ` · CV ${selecionado.cv.toLocaleString("pt-BR")}%` : ""}`;
  const numeros: NumeroProps[] = [
    selecionado && selecionado.valor !== null
      ? { rotulo: `${med.nome} · ${nomeTerritorio(ter)}`, valor: selecionado.valor, valorTexto: formato(selecionado.valor, med.unidade), formato: "texto", unidade: "", periodo: selecionado.periodoNome, recorte, fonte: nomeFonte, natureza: naturezaDe(med) }
      : { rotulo: `${med.nome} · ${nomeTerritorio(ter)}`, valor: null, motivoAusencia: "Esta combinação de território, população e medida não tem observação nesta publicação.", unidade: med.unidade, periodo: selecionado?.periodoNome ?? periodos.find((p) => p[0] === periodo)?.[1] ?? "Sem período", recorte, fonte: nomeFonte, natureza: naturezaDe(med) },
  ];
  if (!estrutural)
    numeros.push(
      diferenca === null
        ? { rotulo: "Diferença para o período anterior disponível", valor: null, motivoAusencia: `${anterior?.periodoNome ?? "Sem referência anterior"}: sem valor nos dois períodos para a mesma medida e território.`, unidade: med.unidade, periodo: nomePeriodo, fonte: nomeFonte, natureza: "CALCULADO" }
        : {
            rotulo: "Diferença para o período anterior disponível",
            valor: diferenca,
            valorTexto: porcentagem
              ? `${diferenca > 0 ? "+" : ""}${diferenca.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`
              : med.unidade === "índice"
                ? `${diferenca > 0 ? "+" : ""}${diferenca.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} pontos de índice`
                : formato(diferenca, med.unidade),
            unidade: "",
            periodo: `${anterior?.periodoNome} a ${selecionado?.periodoNome}`,
            recorte: "mesma medida e território",
            fonte: nomeFonte,
            natureza: "CALCULADO",
          },
    );
  if (!formal)
    numeros.push({ rotulo: "Cobertura na comparação estadual", valor: pares.filter((p) => p.valor !== null).length, valorTexto: `${pares.filter((p) => p.valor !== null).length} / ${ufsElegiveis}`, unidade: "Unidades da Federação com valor disponível no recorte", periodo: nomePeriodo, fonte: nomeFonte, natureza: "CALCULADO" });
  const nota = [
    estrutural ? "Referência estrutural: Censo · semana de referência em julho de 2022." : null,
    formal ? "Âmbito da série: Brasil. Vínculos por estabelecimento · cobertura nacional." : null,
    "Os números seguem o recorte escolhido logo abaixo.",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <FaixaNumeros nota={nota} idioma="pt">
      {numeros.map((n, i) => (
        <NumeroIndicador key={n.rotulo} {...n} tamanho={i === 0 ? "g" : "m"} idioma="pt" />
      ))}
    </FaixaNumeros>
  );
}

/** O método da medida escolhida: fonte, captura, universo e limitações (antes em "Fonte, captura e método da medida"). */
export function MetodoTrabalhoMedida({ dados: dadosProp, ids }: { dados?: Snapshot; ids: string[] }) {
  const dados = useBaseTrabalho(dadosProp);
  const { med, fonte } = useRecorteTrabalho(dados, ids);
  if (!med) return null;
  return (
    <div className="space-y-2">
      <p>
        <strong className="font-medium text-carvao">{fonte?.nome}</strong> ·{" "}
        <a href={fonte?.url} className="text-obee-dark underline underline-offset-4">
          Abrir fonte oficial
        </a>
      </p>
      <p>
        Universo: {med.universo}. Unidade: {med.unidade}. Captura do conjunto: {new Date(dados.capturadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília). Períodos de referência são os de cada observação, não a data da captura.
      </p>
      <p>{med.limitacao}</p>
      <p>{fonte?.limitacoes?.join(" ")}</p>
      <p className="flex flex-wrap gap-x-6">
        <Link href={`${BASE}/metodos`} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
          Método e cobertura completa →
        </Link>
        <Link href={BASE} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
          Voltar ao panorama →
        </Link>
      </p>
    </div>
  );
}

const campoSelect = "mt-1 block min-h-[44px] w-full border border-linha bg-superficie px-3 text-sm text-carvao";
const rotuloCampo = "flex min-w-[12rem] flex-1 flex-col text-sm text-carvao";
const botao = "rotulo inline-flex min-h-[44px] items-center border border-linha bg-superficie px-3 text-obee-dark hover:border-obee";

function Baixar({ rotulo, aoBaixar }: { rotulo: string; aoBaixar: () => void }) {
  return (
    <ExportacaoComConta rotulo={rotulo}>
      <button type="button" onClick={aoBaixar} className={botao}>
        {rotulo}
      </button>
    </ExportacaoComConta>
  );
}

/** Tabela equivalente de uma série ou comparação (Referência, estado do dado e valor), como a tabela de antes. */
function tabelaDe(itens: { nome: string; valor: number | null; status: string }[], unidade: string, titulo: string, primeira = "Referência") {
  return {
    colunas: [primeira, "Estado do dado", `Valor · ${unidade}`],
    linhas: itens.map((p) => [p.nome, p.valor === null ? "Ausente" : p.status === "observado" ? "Observado" : p.status, p.valor === null ? null : formato(p.valor, unidade)]),
    titulo,
    limite: 200,
  };
}

/** Casas decimais do gráfico, as mesmas de `formato`: uma em percentuais, até duas em reais e contagens, até três no índice. */
const casasDe = (unidade: string) => (unidade.includes("%") ? 1 : unidade === "índice" ? 3 : unidade.includes("R$") ? 2 : 0);

export function ExploradorTrabalho({ dados: dadosProp, ids, rota }: { dados?: Snapshot; ids: string[]; rota: string }) {
  const dados = useBaseTrabalho(dadosProp);
  const r = useRecorteTrabalho(dados, ids);
  const { indicadores, territorios, grupos, nacional, estado, definir, med, ter, elegiveis, gruposMed, sexosMed, estrutural, formal, periodos, periodo, serie, selecionado, fonte, quebraVisita, pares, disponiveis, nomePeriodo, foraDaCobertura, csv } = r;
  if (!med || !ter)
    return (
      <FiguraAnalitica
        id="base-indisponivel"
        idioma="pt"
        pergunta="Base indisponível"
        subtitulo="Trabalho e renda"
        natureza="OBSERVADO"
        proveniencia={provenienciaObee({ indicador: "Trabalho e renda", natureza: "OBSERVADO", orgao: "IBGE", dataset: "Trabalho e renda", url: "", unidade: "", frequencia: "", inicio: "", fim: "", limitacoes: [] })}
        tabela={{ colunas: ["Situação"], linhas: [["Nenhum valor é exibido no lugar dos dados ausentes."]] }}
        naoConcluir="Nenhum valor é exibido no lugar dos dados ausentes: a ausência de base não vira zero nem estimativa."
      >
        <p data-grafico="sem-dado" className="t-meta text-carvao">
          Nenhum valor é exibido no lugar dos dados ausentes.
        </p>
      </FiguraAnalitica>
    );
  const prov = provenienciaTrabalho(dados, med, fonte, serie);
  const unidade = med.unidade;
  const casas = casasDe(unidade);
  const nome = nomeTerritorio(ter);
  const natureza = naturezaDe(med);
  const padrao = estado.med === indicadores[0].id && estado.ter === nacional.id && !estado.per && estado.sexo === "total" && estado.grp === "Total";
  const rotuloGrupo = med.id === "renda-por-decil" ? "Faixa de renda" : med.id.startsWith("ocupacoes") ? "Grupo ocupacional" : med.id === "jornada-habitual" ? "Grupo de idade" : "Grupo da população";
  const lacunas = comLacunas(serie);
  // retratos espaçados (mais lacunas que observações, como os do Cadastro Único): barras por retrato, nunca uma linha que sugira série contínua
  const retratos = lacunas.filter((p) => p.valor === null).length > lacunas.filter((p) => p.valor !== null).length;
  const primeiro = disponiveis[0];
  const ult = disponiveis.at(-1);
  // mudança de coleta da PNAD anual (quinta visita de 2020 a 2022): a linha se interrompe nas fronteiras, uma série por trecho
  const trechos: { id: string; nome: string; dentro: (ano: number) => boolean }[] = quebraVisita
    ? [
        { id: "ate-2019", nome: `${med.nome}, coleta pela 1ª visita`, dentro: (a) => a < 2020 },
        { id: "2020-2022", nome: `${med.nome}, coleta pela 5ª visita (2020 a 2022)`, dentro: (a) => a >= 2020 && a < 2023 },
        { id: "desde-2023", nome: `${med.nome}, coleta pela 1ª visita (desde 2023)`, dentro: (a) => a >= 2023 },
      ]
    : [{ id: "serie", nome: `${med.nome} · ${nome}`, dentro: () => true }];
  const seriesLinha = trechos
    .map((t) => ({ id: t.id, nome: t.nome, pontos: lacunas.map((p) => ({ x: p.nome, y: t.dentro(Number(p.periodo.slice(0, 4))) ? p.valor : null })) }))
    .filter((s) => s.pontos.some((p) => p.y !== null));
  const notasFonte = (fonte?.limitacoes ?? []).filter((n) => n.includes("visita") || n.includes("percentis") || n.includes("coexistir"));
  const universoDaMedida: ReactNode = (
    <>
      <strong className="font-medium">Universo da medida:</strong> {med.universo} {med.limitacao}{" "}
      {selecionado?.cv !== null && selecionado?.cv !== undefined ? "CV é o coeficiente de variação da estimativa; não é um intervalo de confiança." : ""}{" "}
      {estrutural ? "O Censo é um retrato de 2022: não descreve a conjuntura atual." : "Resultados por residência nas pesquisas do IBGE; vínculos por estabelecimento no Novo Caged. Diferenças observadas não demonstram efeito de uma política pública."}
    </>
  );
  return (
    <>
      <Controles rotulo="Recorte da análise" resumo={`${med.nome} · ${nome} · ${nomePeriodo} · ${estado.sexo} · ${estado.grp}`} limpar={padrao ? undefined : { href: rota }} idioma="pt">
        <label className={rotuloCampo}>
          Indicador
          <select className={campoSelect} value={med.id} onChange={(e) => definir({ med: e.target.value, per: "" })}>
            {indicadores.map((i) => (
              <option value={i.id} key={i.id}>
                {i.nome}
              </option>
            ))}
          </select>
        </label>
        <SeletorTerritorioTrabalho territorios={territorios} elegiveis={elegiveis} selecionado={ter.id} onChange={(id) => definir({ ter: id })} />
        <label className={rotuloCampo}>
          Período
          <select className={campoSelect} value={periodo} onChange={(e) => definir({ per: e.target.value })}>
            {periodos.map((p) => (
              <option key={p[0]} value={p[0]}>
                {p[1]}
              </option>
            ))}
          </select>
        </label>
        <label className={rotuloCampo}>
          População
          <select className={campoSelect} value={estado.sexo} onChange={(e) => definir({ sexo: e.target.value as typeof estado.sexo, per: "" })}>
            <option value="total">Total</option>
            <option value="homens" disabled={!sexosMed.includes("homens")}>
              Homens{!sexosMed.includes("homens") ? " · indisponível" : ""}
            </option>
            <option value="mulheres" disabled={!sexosMed.includes("mulheres")}>
              Mulheres{!sexosMed.includes("mulheres") ? " · indisponível" : ""}
            </option>
          </select>
        </label>
        <label className={rotuloCampo}>
          {rotuloGrupo}
          <select className={campoSelect} value={estado.grp} onChange={(e) => definir({ grp: e.target.value, per: "" })}>
            {grupos
              .filter((g) => gruposMed.includes(g) || g === estado.grp)
              .map((g) => (
                <option key={g} value={g}>
                  {g}
                  {!gruposMed.includes(g) ? " · indisponível" : ""}
                </option>
              ))}
          </select>
        </label>
        <CopiarLinkRecorte />
      </Controles>

      {dados.indicadores.some((i) => i.id === "renda-por-decil") && <FiguraDecis dados={dados} territorio={ter.id} periodo={periodo} nome={nome} />}
      {med.id.startsWith("ocupacoes") && <FiguraOcupacoes dados={dados} territorio={ter.id} sexo={estado.sexo} periodo={periodo} nome={nome} />}

      <FiguraAnalitica
        id="evolucao"
        idioma="pt"
        pergunta={estrutural ? "Qual é o retrato do período?" : "Como evoluiu?"}
        subtitulo={`${med.nome} · ${unidade} · ${nome} · ${estado.sexo} · ${estado.grp}`}
        natureza={natureza}
        proveniencia={prov}
        leitura={
          primeiro && ult && primeiro !== ult ? (
            <LeituraGuiada>
              A série disponível vai de {primeiro.periodoNome} ({formato(primeiro.valor, unidade)}) a {ult.periodoNome} ({formato(ult.valor, unidade)}). O período selecionado pode ser anterior ao último disponível.
            </LeituraGuiada>
          ) : undefined
        }
        tabela={tabelaDe(lacunas, unidade, `Série de ${med.nome} · ${nome}`)}
        ressalva={
          foraDaCobertura ? (
            <>
              <strong className="font-medium">Recorte fora da cobertura.</strong> Esta combinação de território, população e medida não tem observações nesta publicação. Nenhum valor de outro território é colocado no lugar. Escolha um território ou população disponível.
            </>
          ) : (
            universoDaMedida
          )
        }
        comoInterpretar={
          <>
            {estrutural
              ? "Sem série temporal compatível nesta publicação."
              : retratos
                ? "Retratos em datas espaçadas: cada barra é um retrato, e os retratos não formam uma série mensal contínua."
                : "Cada ponto mantém o período da fonte, sem interpolação de ausências: período sem observação fica como lacuna."}{" "}
            {PERMITE}
            {notasFonte.map((n, i) => (
              <span key={i}>
                {" "}
                {n}
                {n.includes("visita") ? " A linha é interrompida nas fronteiras de 2020 e 2023 para sinalizar a alteração de coleta." : ""}
              </span>
            ))}
          </>
        }
        naoConcluir={NAO_DEMONSTRA}
        complemento={
          <>
            {foraDaCobertura && <p className="t-meta max-w-prose2 text-carvao-muted">{universoDaMedida}</p>}
            <p className="t-meta text-carvao-muted">
              Fonte:{" "}
              <a href={fonte?.url} className="text-obee-dark underline underline-offset-4">
                {fonte?.nome}
              </a>{" "}
              · {med.universo.replace(/\.$/, "")}.
            </p>
            <Baixar rotulo="Baixar série CSV" aoBaixar={() => baixar(`trabalho-renda-${med.id}-${ter.id}-serie.csv`, csv(serie))} />
          </>
        }
      >
        {disponiveis.length > 1 && retratos ? (
          <GraficoBarras
            titulo={`Retratos: ${med.nome} · ${nome}`}
            series={[{ id: "valor", nome: med.nome, pontos: serie.map((o) => ({ x: o.periodo, rotulo: o.periodoNome, y: o.valor })) }]}
            eixoY={{ unidade, zero: true, casas }}
            orientacao="vertical"
            rotulosValor
          />
        ) : disponiveis.length > 1 ? (
          <GraficoLinhas titulo={`Evolução: ${med.nome} · ${nome}`} series={seriesLinha} eixoY={{ unidade, zero: unidade !== "índice", casas }} formatoX="texto" altura={280} />
        ) : (
          <p data-grafico="ponto-unico" className="t-corpo max-w-prose2 border-l-2 border-linha pl-3 text-carvao">
            {formato(selecionado?.valor ?? null, unidade)} · {selecionado?.periodoNome ?? "Sem observação no recorte"}. Uma única referência temporal está disponível; não há uma linha de evolução.
          </p>
        )}
      </FiguraAnalitica>

      {!formal ? (
        <FiguraAnalitica
          id="comparacao-estadual"
          idioma="pt"
          pergunta="Como se comparam os estados?"
          subtitulo={`${med.nome} · ${unidade} · ${selecionado?.periodoNome ?? nomePeriodo} · ${estado.sexo} · ${estado.grp} · ${pares.length} estados`}
          natureza={natureza}
          proveniencia={prov}
          tabela={tabelaDe(pares, unidade, `Comparação estadual · ${selecionado?.periodoNome ?? periodo}`, "Unidade da Federação")}
          comoInterpretar={
            <>
              Mesma medida, período e população. Ordem alfabética; o destaque identifica a seleção.{" "}
              {med.fonteId.startsWith("mds") ? "Brasil e estados são somas dos registros municipais extraídos do Cadastro Único. A cobertura depende dos registros presentes na captura." : "Brasil é uma estimativa própria, não a média simples dos estados."} Barras começam em zero.
            </>
          }
          naoConcluir="Diferenças observadas entre estados não demonstram efeito de uma política pública nem identificam causas ou qualidade da gestão."
          complemento={<Baixar rotulo="Baixar comparação CSV" aoBaixar={() => baixar(`trabalho-renda-${med.id}-${periodo}-estados.csv`, csv(pares))} />}
        >
          {pares.length ? (
            <GraficoBarras
              titulo={`Comparação estadual: ${med.nome}, ${selecionado?.periodoNome ?? nomePeriodo}`}
              series={[{ id: "valor", nome: med.nome, pontos: pares.map((p) => ({ x: p.territorioId, rotulo: p.nome, y: p.valor })) }]}
              eixoY={{ unidade, zero: true, casas }}
              orientacao="horizontal"
              alturaCategoria={32}
              alturaMaxima={900}
              rotulosValor
              rotulosSaoNomes
              selecionado={ter.id}
            />
          ) : (
            <p data-grafico="sem-dado" className="t-meta max-w-prose2 text-carvao">
              Nenhum estado com observação para esta população e período. Selecione outro recorte.
            </p>
          )}
        </FiguraAnalitica>
      ) : (
        <FiguraEmpregoFormal dados={dados} indicadorAtual={med.id} />
      )}
    </>
  );
}

/** A renda média em cada faixa da distribuição (antes DistribuicaoRendaTrabalho), como figura do kit. */
function FiguraDecis({ dados, territorio, periodo, nome }: { dados: Snapshot; territorio: string; periodo: string; nome: string }) {
  const linhas = dados.observacoes.filter((o) => o.indicadorId === "renda-por-decil" && o.territorioId === territorio && o.periodo === periodo && o.sexo === "total" && o.grupo !== "Total");
  if (!linhas.length) return null;
  const total = dados.observacoes.find((o) => o.indicadorId === "renda-domiciliar-real" && o.territorioId === territorio && o.periodo === periodo && o.grupo === "Total");
  const med = dados.indicadores.find((i) => i.id === "renda-por-decil")!;
  const fonte = dados.fontes.find((f) => f.id === med.fonteId);
  function exportar() {
    baixar(
      `renda-deciles-${territorio}-${periodo}.csv`,
      ["territorio;periodo;faixa;renda_media_real_2025;fonte", ...linhas.map((o) => [nome, periodo, o.grupo, o.valor, dados.fontes.find((f) => f.id === o.fonteId)?.consulta].map(celula).join(";"))].join("\r\n"),
    );
  }
  return (
    <FiguraAnalitica
      id="faixas-de-renda"
      idioma="pt"
      pergunta="Qual é a renda média em cada faixa da distribuição?"
      subtitulo={`${nome} · ${periodo} · total da população · reais a preços de 2025`}
      natureza="ESTIMADO"
      proveniencia={provenienciaTrabalho(dados, med, fonte, linhas)}
      tabela={{ colunas: ["Faixa", "Renda média"], linhas: linhas.map((o) => [o.grupo, formato(o.valor, "R$")]), titulo: `${nome} · ${periodo} · reais a preços de 2025` }}
      comoInterpretar={`Cada faixa reúne aproximadamente 10% das pessoas, segundo a renda domiciliar por pessoa. O valor mostrado é a média dentro da faixa, em reais a preços de 2025; não é o limite superior do decil. PNAD Contínua anual · tabela 7533 · barras a partir de zero. Referência total do mesmo universo: ${formato(total?.valor ?? null, "R$")}.`}
      naoConcluir="As médias das faixas não devem ser somadas para obter renda total. Esta figura descreve rendas médias por decil, não quantidades de pessoas em um histograma. Estimativas amostrais, revisáveis; de 2020 a 2022, a coleta anual usa a quinta visita em lugar da primeira."
      complemento={<Baixar rotulo="Baixar faixas de renda CSV" aoBaixar={exportar} />}
    >
      <GraficoBarras titulo={`Renda média por faixa · ${nome} · ${periodo}`} series={[{ id: "valor", nome: "Renda média", pontos: linhas.map((o) => ({ x: o.grupo, y: o.valor })) }]} eixoY={{ unidade: "R$ de 2025", zero: true, casas: 2 }} orientacao="horizontal" rotulosValor />
    </FiguraAnalitica>
  );
}

/** Grupos ocupacionais, lado a lado (antes GruposOcupacoes), como figura do kit. */
function FiguraOcupacoes({ dados, territorio, sexo, periodo, nome }: { dados: Snapshot; territorio: string; sexo: string; periodo: string; nome: string }) {
  const obs = dados.observacoes.filter((o) => o.territorioId === territorio && o.sexo === sexo && o.periodo === periodo && o.indicadorId.startsWith("ocupacoes"));
  const grupos = Array.from(new Set(obs.map((o) => o.grupo))).filter((g) => g !== "Total");
  const linhas = grupos.map((grupo) => ({
    grupo,
    pessoas: obs.find((o) => o.grupo === grupo && o.indicadorId === "ocupacoes-pessoas")?.valor ?? null,
    media: obs.find((o) => o.grupo === grupo && o.indicadorId === "ocupacoes-renda-media")?.valor ?? null,
    mediana: obs.find((o) => o.grupo === grupo && o.indicadorId === "ocupacoes-renda-mediana")?.valor ?? null,
  }));
  const med = dados.indicadores.find((i) => i.id === "ocupacoes-pessoas");
  if (!med || !linhas.length) return null;
  const fonte = dados.fontes.find((f) => f.id === "censo-ocupacoes");
  function exportar() {
    baixar(
      `ocupacoes-grupos-${territorio}-${sexo}-${periodo}.csv`,
      [
        "territorio;sexo;ano;grupo;pessoas_com_rendimento;renda_media_nominal;renda_mediana_nominal;fonte",
        ...linhas.map((l) => [nome, sexo, periodo, l.grupo, l.pessoas, l.media, l.mediana, fonte?.consulta].map(celula).join(";")),
      ].join("\r\n"),
    );
  }
  return (
    <FiguraAnalitica
      id="grupos-ocupacionais"
      idioma="pt"
      pergunta="Quantas pessoas e quanto rendem os grupos ocupacionais?"
      subtitulo={`${nome} · ${sexo} · ${periodo} · pessoas ocupadas com rendimento, pela ocupação principal`}
      natureza="ESTIMADO"
      proveniencia={provenienciaTrabalho(dados, med, fonte, obs)}
      tabela={{
        colunas: ["Grupo da ocupação principal", "Pessoas com rendimento", "Renda média · R$", "Renda mediana · R$"],
        linhas: linhas.map((l) => [l.grupo, formato(l.pessoas, "pessoas"), formato(l.media, "R$"), formato(l.mediana, "R$")]),
        titulo: "Grupos completos, incluindo ocupações mal definidas",
      }}
      comoInterpretar="Rendimentos nominais mensais de todos os trabalhos. O total é uma referência separada; não entra duas vezes na composição. Barras a partir de zero · pessoas com rendimento · Censo 2022, tabela 10282."
      naoConcluir="Média e mediana resumem aspectos distintos da distribuição. Esses rendimentos descrevem trabalhadores observados em 2022; não são salários oferecidos em vagas atuais."
      complemento={<Baixar rotulo="Baixar grupos e rendimentos CSV" aoBaixar={exportar} />}
    >
      <GraficoBarras titulo={`Pessoas com rendimento por grupo ocupacional · ${nome}`} series={[{ id: "pessoas", nome: "Pessoas com rendimento", pontos: linhas.map((l) => ({ x: l.grupo, y: l.pessoas })) }]} eixoY={{ unidade: "pessoas", zero: true, casas: 0 }} orientacao="horizontal" rotulosValor />
    </FiguraAnalitica>
  );
}

/** A série complementar do emprego formal (antes ComplementoEmpregoFormal): o estoque, quando a medida é a variação, e vice-versa. */
function FiguraEmpregoFormal({ dados, indicadorAtual }: { dados: Snapshot; indicadorAtual: string }) {
  const id = indicadorAtual === "estoque-formal" ? "saldo-formal" : "estoque-formal";
  const med = dados.indicadores.find((i) => i.id === id);
  const pontos = dados.observacoes.filter((o) => o.indicadorId === id && o.territorioId === "1" && o.sexo === "total" && o.grupo === "Total").sort((a, b) => a.periodo.localeCompare(b.periodo));
  const fonte = dados.fontes.find((f) => f.id === med?.fonteId);
  if (!med) return null;
  const lacunas = comLacunas(pontos);
  return (
    <FiguraAnalitica
      id="emprego-formal-complementar"
      idioma="pt"
      pergunta={id === "saldo-formal" ? "Qual é a variação mensal do estoque?" : "Qual é o estoque de vínculos?"}
      subtitulo={`Brasil · ${med.nome} · ${med.unidade}`}
      natureza={naturezaDe(med)}
      proveniencia={provenienciaTrabalho(dados, med, fonte, pontos)}
      tabela={tabelaDe(lacunas, med.unidade, `${med.nome} · Brasil`)}
      comoInterpretar={`${med.universo} ${med.limitacao} Cobertura nacional nesta publicação; sem comparação estadual.`}
      naoConcluir="Estoque é a quantidade de vínculos em um momento. A variação mensal apresentada é a diferença entre o estoque do mês e o do mês anterior na série SGS 28763; não é uma série oficial de admissões menos desligamentos. Vínculos não equivalem a pessoas únicas. As séries podem ser revisadas e não recebem ajuste sazonal."
      complemento={
        <Baixar
          rotulo="Baixar série complementar CSV"
          aoBaixar={() =>
            baixar(`novo-caged-${id}-brasil.csv`, ["periodo;indicador;unidade;valor;fonte;universo", ...pontos.map((o) => [o.periodoNome, med.nome, med.unidade, o.valor, dados.fontes.find((f) => f.id === o.fonteId)?.consulta, med.universo].map(celula).join(";"))].join("\r\n"))
          }
        />
      }
    >
      <GraficoLinhas titulo={`${med.nome} · Brasil`} series={[{ id: "valor", nome: med.nome, pontos: lacunas.map((p) => ({ x: p.nome, y: p.valor })) }]} eixoY={{ unidade: med.unidade, zero: id === "estoque-formal", casas: 0 }} formatoX="texto" altura={260} />
    </FiguraAnalitica>
  );
}

/** "Copiar link do recorte", como no desenho anterior: o recorte vive na URL, e o botão a copia; sem área de transferência, diz como fazer. */
function CopiarLinkRecorte() {
  const [aviso, setAviso] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-x-4">
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setAviso("Link do recorte copiado.");
          } catch {
            setAviso("Copie o endereço da página para compartilhar o recorte.");
          }
        }}
      >
        Copiar link do recorte
      </button>
      <span role="status" className="t-meta text-carvao-muted">
        {aviso}
      </span>
    </div>
  );
}
