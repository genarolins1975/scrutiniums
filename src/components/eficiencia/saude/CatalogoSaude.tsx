"use client";

import { useMemo, useState } from "react";
import type { FichaExibivel, LinhaMatrizFonte, Validacao } from "@/lib/eficiencia/saude/tipos";
import { FichaConteudo, ESTADO_PUBLICACAO, type ContextoFicha } from "../FichaConteudo";
import { CODIGO_SAUDE } from "./SobreDadoSaude";

/**
 * Catálogo pesquisável de Dados e métodos: indicadores (com a ficha de 16 campos em detalhe sob demanda), decisões por fonte e validações.
 * A busca e os filtros só escondem linhas; todo o conteúdo continua acessível, e o texto técnico (JSON, fórmulas) fica em detalhes.
 */

const FAMILIA: Record<string, string> = { recursos: "Recursos", estrutura: "Estrutura", atendimento: "Atendimento", resultado: "Resultado", contexto: "Contexto" };
const RESULTADO: Record<string, string> = {
  aprovada: "aprovada",
  aprovada_com_divergencias_documentadas: "aprovada, com divergências documentadas",
  regra_aplicada_com_pendencias: "regra aplicada, com pendências documentadas",
  reprovada: "reprovada",
  medicao: "medição",
};

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CatalogoIndicadores({ fichas, contextos }: { fichas: FichaExibivel[]; contextos: Record<string, ContextoFicha> }) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const visiveis = useMemo(() => {
    const t = norm(q.trim());
    return fichas.filter((f) => (estado === "todos" || f.estado === estado) && (!t || norm(`${f.nome} ${f.id} ${f.pergunta} ${f.fontes.join(" ")}`).includes(t)));
  }, [fichas, q, estado]);
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div>
          <label htmlFor="busca-ind" className="rotulo block text-carvao-muted">Buscar indicador</label>
          <input id="busca-ind" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, identificador, pergunta ou fonte" className="mt-1.5 min-h-[44px] w-full border border-linha bg-superficie px-3 text-[0.95rem] text-obee-tinta focus:outline focus:outline-2 focus:outline-obee" />
        </div>
        <div>
          <label htmlFor="estado-ind" className="rotulo block text-carvao-muted">Estado de publicação</label>
          <select id="estado-ind" value={estado} onChange={(e) => setEstado(e.target.value)} className="mt-1.5 min-h-[44px] w-full border border-linha bg-superficie px-3 text-[0.95rem] text-obee-tinta focus:outline focus:outline-2 focus:outline-obee">
            <option value="todos">Todos</option>
            <option value="PUBLICAVEL_COM_RESSALVAS">Publicável com ressalvas</option>
            <option value="PUBLICAVEL">Publicável</option>
            <option value="NAO_PUBLICAVEL">Não publicável nesta etapa</option>
          </select>
        </div>
      </div>
      <p className="mt-3 text-sm text-carvao-muted" role="status">{visiveis.length} de {fichas.length} indicadores</p>
      <ul className="mt-2 divide-y divide-linha border-y border-linha">
        {visiveis.map((f) => (
          <li key={f.id}>
            <details className="group py-1">
              <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2">
                <span className="min-w-0 flex-1 basis-[18rem] font-semibold leading-snug text-obee-tinta">{f.nome}</span>
                <span className="rotulo text-carvao-muted">{FAMILIA[f.familia] ?? f.familia}</span>
                <span className="text-[0.8125rem] text-carvao-muted">{ESTADO_PUBLICACAO[f.estado]}</span>
                <span aria-hidden="true" className="text-obee-dark group-open:rotate-90">›</span>
                <span className="sr-only">(abrir a ficha)</span>
              </summary>
              <p className="mt-1 max-w-prose2 text-sm leading-snug text-carvao-muted">{f.pergunta}</p>
              <p className="mt-1 text-[0.8125rem] text-carvao-muted">Unidade: {f.unidade} · Período: {f.periodo}</p>
              <details className="mt-2">
                <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Ficha completa (16 campos)</summary>
                <div className="mt-2">
                  <FichaConteudo f={f} ctx={contextos[f.id]} codigo={CODIGO_SAUDE} />
                </div>
              </details>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

const GRUPOS_MATRIZ = [
  { id: "recursos", titulo: "Recursos executados pelo município", prefixos: ["F"] },
  { id: "servicos", titulo: "Serviços localizados no território", prefixos: ["E"] },
  { id: "residentes", titulo: "População residente e contexto demográfico", prefixos: ["R", "D"] },
];

const DECISOES = ["todas", "publicar com ressalva", "apenas contexto", "não publicar"];

export function MatrizDeFontes({ linhas }: { linhas: LinhaMatrizFonte[] }) {
  const [q, setQ] = useState("");
  const [d, setD] = useState("todas");
  const visiveis = useMemo(() => {
    const t = norm(q.trim());
    return linhas.filter((l) => (d === "todas" || l.decisao === d) && (!t || norm(`${l.medida} ${l.fonte} ${l.fundamento}`).includes(t)));
  }, [linhas, q, d]);
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div>
          <label htmlFor="busca-mat" className="rotulo block text-carvao-muted">Buscar medida ou fonte</label>
          <input id="busca-mat" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Por exemplo: SIOPS, CNES, ICSAP" className="mt-1.5 min-h-[44px] w-full border border-linha bg-superficie px-3 text-[0.95rem] text-obee-tinta focus:outline focus:outline-2 focus:outline-obee" />
        </div>
        <div>
          <label htmlFor="dec-mat" className="rotulo block text-carvao-muted">Decisão</label>
          <select id="dec-mat" value={d} onChange={(e) => setD(e.target.value)} className="mt-1.5 min-h-[44px] w-full border border-linha bg-superficie px-3 text-[0.95rem] text-obee-tinta focus:outline focus:outline-2 focus:outline-obee">
            {DECISOES.map((x) => (
              <option key={x} value={x}>{x === "todas" ? "Todas" : x.charAt(0).toUpperCase() + x.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-3 text-sm text-carvao-muted" role="status">{visiveis.length} de {linhas.length} medidas candidatas</p>
      <div className="mt-2 space-y-3">
        {GRUPOS_MATRIZ.map((g) => {
          const itens = visiveis.filter((l) => g.prefixos.includes(l.id.charAt(0)));
          if (!itens.length) return null;
          const por = (dec: string) => itens.filter((l) => l.decisao === dec).length;
          return (
            <details key={g.id} open={q.trim() !== "" || d !== "todas"} className="border-t border-linha pt-1">
              <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-0.5">
                <span className="font-semibold text-obee-tinta">{g.titulo}</span>
                <span className="text-sm text-carvao-muted">{itens.length} medidas: {por("publicar com ressalva")} publicar com ressalva, {por("apenas contexto")} apenas contexto, {por("não publicar")} não publicar</span>
                <span className="sr-only">(abrir a lista)</span>
              </summary>
              <ul className="divide-y divide-linha border-y border-linha">
                {itens.map((l) => (
                  <li key={l.id} className="py-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-mono text-[0.8rem] text-carvao-muted">{l.id}</span>
              <span className="min-w-0 flex-1 basis-[18rem] font-semibold leading-snug text-obee-tinta">{l.medida}</span>
              <span className="rotulo text-obee-tinta">{l.decisao}</span>
            </div>
            <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-sm leading-snug sm:grid-cols-2">
              <div><dt className="rotulo text-carvao-muted">Fonte</dt><dd className="text-obee-tinta">{l.fonte}</dd></div>
              <div><dt className="rotulo text-carvao-muted">Acesso testado em 09/10/2026</dt><dd className="text-obee-tinta">{l.acesso_testado}</dd></div>
              <div><dt className="rotulo text-carvao-muted">Cobertura das 26 capitais</dt><dd className="text-obee-tinta">{l.cobertura}</dd></div>
              <div><dt className="rotulo text-carvao-muted">Período</dt><dd className="text-obee-tinta">{l.periodo}</dd></div>
            </dl>
            <p className="mt-2 max-w-prose2 text-sm leading-snug text-carvao-muted">{l.fundamento}</p>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

export function ListaValidacoes({ validacoes }: { validacoes: Validacao[] }) {
  return (
    <ul className="divide-y divide-linha border-y border-linha">
      {validacoes.map((v) => (
        <li key={v.id} className="py-3">
          <details>
            <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-baseline gap-x-4 gap-y-0.5">
              <span className="font-mono text-[0.8rem] text-carvao-muted">{v.id}</span>
              <span className="min-w-0 flex-1 basis-[18rem] leading-snug text-obee-tinta">{v.titulo}</span>
              <span className="rotulo text-obee-tinta">{RESULTADO[v.resultado] ?? v.resultado}</span>
              <span className="sr-only">(abrir o detalhe)</span>
            </summary>
            <p className="mt-2 max-w-prose2 text-sm leading-snug text-carvao-muted">{v.detalhe}</p>
            {v.casos.length > 0 && (
              <details className="mt-2">
                <summary className="rotulo inline-flex min-h-[44px] cursor-pointer items-center text-obee-dark">Casos listados ({v.casos.length}, dado técnico)</summary>
                <pre role="region" aria-label={`Casos listados da validação ${v.id}, em formato técnico`} className="mt-2 max-h-64 overflow-auto bg-papel p-3 text-xs leading-snug text-obee-tinta" tabIndex={0}>{JSON.stringify(v.casos.slice(0, 40), null, 1)}</pre>
              </details>
            )}
          </details>
        </li>
      ))}
    </ul>
  );
}
