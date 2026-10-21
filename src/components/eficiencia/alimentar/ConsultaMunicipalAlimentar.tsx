"use client";
/**
 * Consulta por município das bases complementares: um arquivo por UF, buscado no navegador sob
 * a sessão do painel. O tema escolhe as colunas (CadINSAN em Necessidades, PNAE em Acesso, PNAE e
 * PAA em Recursos). Ausência é escrita com o motivo; nenhum valor é calculado aqui.
 */
import { useEffect, useId, useMemo, useState } from "react";
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

export function ConsultaMunicipalAlimentar({ tema, ufs, ufInicial = "PE" }: { tema: TemaConsulta; ufs: { sigla: string; nome: string }[]; ufInicial?: string }) {
  const id = useId();
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
  return (
    <div className="mt-8">
      <h3 className="font-serif text-xl">No seu município</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1.5fr]">
        <label htmlFor={`${id}-uf`} className="text-sm">
          Estado
          <select id={`${id}-uf`} value={uf} onChange={(e) => { setUf(e.target.value); setPagina(0); }} className="mt-2 block min-h-[44px] w-full border border-mineral bg-superficie px-3">
            {ufs.map((u) => <option key={u.sigla} value={u.sigla}>{u.nome}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-busca`} className="text-sm">
          Município ou código IBGE
          <input id={`${id}-busca`} type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} placeholder="Ex.: Recife ou 2611606" className="mt-2 block min-h-[44px] w-full border border-mineral bg-superficie px-3" />
        </label>
      </div>
      {estado === "carregando" && <p role="status" className="my-6 text-sm">Carregando os municípios de {nomeUf}…</p>}
      {estado === "erro" && (
        <div role="status" className="my-6 border border-linha p-4 text-sm">
          <p>Não foi possível carregar os municípios. Tente de novo ou baixe o CSV completo abaixo.</p>
          <button type="button" onClick={() => setTentativa((t) => t + 1)} className="mt-3 min-h-[44px] underline">Tentar de novo</button>
        </div>
      )}
      {estado === "pronto" && (
        <>
          <p className="mt-5 max-w-prose2 text-xs leading-relaxed" aria-hidden="true">{LEGENDA[tema]} · {nomeUf} · {int(filtradas.length)} municípios no filtro</p>
          <div className="tabela-scroll mt-2 min-w-0 max-w-full" tabIndex={0} role="region" aria-label={`${LEGENDA[tema]} · ${nomeUf} (tabela; role na horizontal se necessário)`}>
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">{LEGENDA[tema]} · {nomeUf} · {int(filtradas.length)} municípios no filtro</caption>
              <thead>
                <tr>
                  <th scope="col" className="border-b border-carvao-muted px-2 py-2 text-left font-semibold">Município</th>
                  {cols.map((c) => <th key={c.titulo} scope="col" className="border-b border-carvao-muted px-2 py-2 text-right font-semibold">{c.titulo}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA).map((m) => (
                  <tr key={m.codigo} className="border-b border-linha">
                    <th scope="row" className="px-2 py-2 text-left font-normal">{m.nome}<span className="block text-xs text-carvao-muted">{m.codigo}</span></th>
                    {cols.map((c) => {
                      const v = c.valor(m);
                      const ausente = /^(Fora|Sem)/.test(v);
                      return <td key={c.titulo} className={`px-2 py-2 text-right ${ausente ? "text-xs text-carvao-muted" : "tabular-nums"}`}>{v}</td>;
                    })}
                  </tr>
                ))}
                {filtradas.length === 0 && <tr><td colSpan={cols.length + 1} className="py-6">Nenhum município encontrado em {nomeUf}.</td></tr>}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <div className="my-4 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setPagina(atual - 1)} disabled={atual === 0} className="min-h-[44px] border border-mineral px-4 text-sm disabled:opacity-40">← Anterior</button>
              <span role="status" className="text-xs">Página {atual + 1} de {paginas} · até {POR_PAGINA} municípios por página</span>
              <button type="button" onClick={() => setPagina(atual + 1)} disabled={atual === paginas - 1} className="min-h-[44px] border border-mineral px-4 text-sm disabled:opacity-40">Próxima →</button>
            </div>
          )}
        </>
      )}
      <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">{NOTA[tema]}</p>
      <noscript><p className="text-sm">A consulta por município precisa de JavaScript. O CSV completo continua disponível para download.</p></noscript>
    </div>
  );
}
