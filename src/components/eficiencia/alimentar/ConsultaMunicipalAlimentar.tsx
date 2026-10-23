"use client";
/**
 * Consulta por município das bases complementares: um arquivo por UF, buscado no navegador sob
 * a sessão do painel. O tema escolhe as colunas (CadINSAN em Necessidades, PNAE em Acesso, PNAE e
 * PAA em Recursos). Ausência é escrita com o motivo; nenhum valor é calculado aqui.
 *
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a consulta é um bloco da fatia `tabelas`, a TabelaDados do kit à
 * vista, com os controles (estado e busca) logo antes da tabela, o estado do carregamento numa região viva e a paginação e a nota na
 * linha sob a tabela. A busca e a paginação continuam as mesmas.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { Controles, TabelaDados } from "@/components/painel";
import type { MunicipioComplementar } from "@/lib/eficiencia/alimentar/complementos";

export type TemaConsulta = "necessidades" | "acesso" | "recursos";

const BASE = "/eficiencia/seguranca-alimentar";
const POR_PAGINA = 15;
const int = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const normaliza = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

type Coluna = { titulo: string; valor: (m: MunicipioComplementar) => string };

const SEM_CADINSAN = "Fora do anexo de 2025";
const SEM_PNAE = "Sem registro municipal associado";
const SEM_PAA = "Sem dado no extrato";

export function colunas(tema: TemaConsulta): Coluna[] {
  if (tema === "necessidades") {
    return [
      { titulo: "Famílias em risco, com Bolsa Família", valor: (m) => (m.cadinsan ? int(m.cadinsan[0]) : SEM_CADINSAN) },
      { titulo: "% das analisadas", valor: (m) => (m.cadinsan ? pct(m.cadinsan[3]) : SEM_CADINSAN) },
      { titulo: "Famílias analisadas", valor: (m) => (m.cadinsan ? int(m.cadinsan[2]) : SEM_CADINSAN) },
      { titulo: "% no cenário sem o programa", valor: (m) => (m.cadinsan ? pct(m.cadinsan[4]) : SEM_CADINSAN) },
    ];
  }
  if (tema === "acesso") {
    return [
      { titulo: "Alunos registrados, rede municipal, 2025", valor: (m) => (m.pnae2025 ? int(m.pnae2025[0]) : SEM_PNAE) },
      { titulo: "Escolas registradas, rede municipal, 2025", valor: (m) => (m.pnae2025 ? int(m.pnae2025[1]) : SEM_PNAE) },
    ];
  }
  const paa = (ano: string, i: 0 | 1) => (m: MunicipioComplementar) => {
    const v = m.paa[ano]?.[i];
    return v === null || v === undefined ? SEM_PAA : i === 0 ? int(v) : reais(v);
  };
  return [
    { titulo: "PNAE: repasse federal à rede municipal, 2025", valor: (m) => (!m.pnae2025 ? SEM_PNAE : m.pnae2025[2] === null ? "Sem valor informado" : reais(m.pnae2025[2])) },
    { titulo: "PAA: agricultores fornecedores, 2025", valor: paa("2025", 0) },
    { titulo: "PAA: valor pago, 2025", valor: paa("2025", 1) },
    { titulo: "PAA: agricultores fornecedores, 2024", valor: paa("2024", 0) },
    { titulo: "PAA: valor pago, 2024", valor: paa("2024", 1) },
    { titulo: "PAA: agricultores fornecedores, 2023", valor: paa("2023", 0) },
    { titulo: "PAA: valor pago, 2023", valor: paa("2023", 1) },
  ];
}

const LEGENDA: Record<TemaConsulta, string> = {
  necessidades: "CadINSAN, janeiro de 2025: famílias do Cadastro Único em risco estimado de insegurança alimentar grave, valores do anexo municipal do MDS",
  acesso: "PNAE 2025, rede municipal: alunos e escolas registrados pelo FNDE",
  recursos: "PNAE 2025 (repasse federal à rede municipal, R$ nominais) e PAA 2023 a 2025 (agricultores fornecedores e valor pago, R$ nominais)",
};

const NOTA: Record<TemaConsulta, string> = {
  necessidades: "“Fora do anexo de 2025”: município instalado depois da base usada pelo MDS. O percentual é do anexo, com uma casa decimal, e se refere às famílias cadastradas analisadas, não à população do município.",
  acesso: "A rede estadual que funciona no município não está nestes números: o FNDE a registra na secretaria estadual. “Sem registro municipal associado”: o nome no arquivo do FNDE não é idêntico ao da relação oficial do IBGE (18 casos, que continuam nos totais do estado) ou não há prefeitura executora, como em Brasília e Fernando de Noronha.",
  recursos: "“Sem dado no extrato”: o MDS não preencheu o campo para o município naquele ano; não significa zero nem ausência do programa. “Sem registro municipal associado”: nome do FNDE diferente do oficial ou ausência de prefeitura executora. Valores nominais, sem correção pela inflação.",
};

export function ConsultaMunicipalAlimentar({ tema, ufs, ufInicial = "PE", id = "municipio" }: { tema: TemaConsulta; ufs: { sigla: string; nome: string }[]; ufInicial?: string; id?: string }) {
  const idCampo = useId();
  const [uf, setUf] = useState(ufInicial);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<MunicipioComplementar[]>([]);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    const controle = new AbortController();
    setEstado("carregando");
    setLinhas([]);
    fetch(`${BASE}/complementos-uf-${uf}.json`, { signal: controle.signal })
      .then((r) => {
        if (!r.ok) throw new Error("download");
        return r.json() as Promise<MunicipioComplementar[]>;
      })
      .then((rows) => {
        setLinhas(rows);
        setEstado("pronto");
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setEstado("erro");
      });
    return () => controle.abort();
  }, [uf, tentativa]);
  const cols = colunas(tema);
  const filtradas = useMemo(() => linhas.filter((m) => normaliza(`${m.nome} ${m.codigo}`).includes(normaliza(busca))), [linhas, busca]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas - 1);
  const nomeUf = ufs.find((u) => u.sigla === uf)?.nome ?? uf;
  const visiveis = estado === "pronto" ? filtradas.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA) : [];
  const campo = "mt-2 block min-h-[44px] w-full border border-mineral bg-superficie px-3 text-sm text-carvao";
  const botao = "min-h-[44px] border border-mineral px-4 text-sm disabled:opacity-40";
  return (
    <TabelaDados
      idioma="pt"
      recolhida={false}
      id={id}
      tituloVisivel="No seu município"
      lead={
        <>
          <Controles rotulo="Município da consulta" idioma="pt">
            <label htmlFor={`${idCampo}-uf`} className="min-w-[12rem] flex-1 text-sm text-carvao">
              Estado
              <select id={`${idCampo}-uf`} value={uf} onChange={(e) => { setUf(e.target.value); setPagina(0); }} className={campo}>
                {ufs.map((u) => <option key={u.sigla} value={u.sigla}>{u.nome}</option>)}
              </select>
            </label>
            <label htmlFor={`${idCampo}-busca`} className="min-w-[14rem] flex-[1.5] text-sm text-carvao">
              Município ou código IBGE
              <input id={`${idCampo}-busca`} type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} placeholder="Ex.: Recife ou 2611606" className={campo} />
            </label>
          </Controles>
          <div role="status" className="mt-3 text-carvao">
            {estado === "carregando" && <p>Carregando os municípios de {nomeUf}…</p>}
            {estado === "erro" && (
              <>
                <p>Não foi possível carregar os municípios. Tente de novo ou baixe o CSV completo abaixo.</p>
                <button type="button" onClick={() => setTentativa((t) => t + 1)} className="mt-3 min-h-[44px] underline">Tentar de novo</button>
              </>
            )}
            {estado === "pronto" && <p>{LEGENDA[tema]} · {nomeUf} · {int(filtradas.length)} municípios no filtro{filtradas.length === 0 ? `. Nenhum município encontrado em ${nomeUf}.` : ""}</p>}
          </div>
        </>
      }
      titulo={`${LEGENDA[tema]} · ${nomeUf} · ${int(filtradas.length)} municípios no filtro`}
      colunas={["Município", ...cols.map((c) => c.titulo)]}
      linhas={visiveis.map((m) => [
        <span key={m.codigo}>{m.nome}<span className="block text-xs text-carvao-muted">{m.codigo}</span></span>,
        ...cols.map((c) => c.valor(m)),
      ])}
      limite={POR_PAGINA}
      nota={
        <>
          {paginas > 1 && estado === "pronto" && (
            <span className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setPagina(atual - 1)} disabled={atual === 0} className={botao}>← Anterior</button>
              <span role="status">Página {atual + 1} de {paginas} · até {POR_PAGINA} municípios por página</span>
              <button type="button" onClick={() => setPagina(atual + 1)} disabled={atual === paginas - 1} className={botao}>Próxima →</button>
            </span>
          )}
          {NOTA[tema]}
          <noscript> A consulta por município precisa de JavaScript. O CSV completo continua disponível para download.</noscript>
        </>
      }
    />
  );
}
