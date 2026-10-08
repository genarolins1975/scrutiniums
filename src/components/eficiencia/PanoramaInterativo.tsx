"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { formata, formataEixo, type MedidaId } from "@/lib/eficiencia/consulta";
import { fraseCapital } from "@/lib/eficiencia/frases";
import type { CapituloPanorama } from "@/lib/eficiencia/panorama";
import type { FichaIndicador } from "@/lib/eficiencia/tipos";
import { hrefTema, type Tema } from "@/lib/eficiencia/visao";
import { Alternancia, Selecao } from "./controles";
import { FaixaDistribuicao } from "./FaixaDistribuicao";
import type { ContextoFicha } from "./FichaConteudo";
import { SobreEsteDado } from "./SobreEsteDado";
import { TabelaSimples } from "./TabelaSimples";

/**
 * Panorama editorial: três capítulos curtos (Quanto se gasta? Quem é atendido? Quais resultados são observados?), cada um
 * com a pergunta, uma frase factual gerada dos dados, a distribuição das capitais, a referência e uma ação para
 * aprofundar. Nenhuma capital vem selecionada: escolher uma é opcional e só a destaca nos gráficos.
 */

type CapitalLista = { id: string; nome: string; uf: string };

const ESQUEMA_VAZIO = { cap: campo(tiposUrl.texto({ max: 40 }), "") };

/** Seletor opcional de capital do panorama; lê e grava ?cap= como o restante da página. */
export function SeletorCapitalPanorama({ capitais }: { capitais: CapitalLista[] }) {
  const ids = useMemo(() => new Set(capitais.map((c) => c.id)), [capitais]);
  const [s, definir] = useEstadoUrl(ESQUEMA_VAZIO);
  const cap = ids.has(s.cap) ? s.cap : "";
  return (
    <Selecao
      id="panorama-cap"
      rotulo="Destacar uma capital"
      ajuda="Opcional. Mostra onde a capital está em cada gráfico."
      valor={cap}
      opcoes={[{ v: "", t: "Nenhuma: ver o conjunto" }, ...capitais.map((c) => ({ v: c.id, t: `${c.nome} (${c.uf})` }))]}
      aoMudar={(v) => definir({ cap: v })}
    />
  );
}

export function PanoramaInterativo({
  capitulos,
  capitais,
  fichas,
  contextos,
}: {
  capitulos: CapituloPanorama[];
  capitais: CapitalLista[];
  fichas: Record<string, FichaIndicador>;
  contextos: Record<string, ContextoFicha>;
}) {
  const ids = useMemo(() => new Set(capitais.map((c) => c.id)), [capitais]);
  const [s] = useEstadoUrl(ESQUEMA_VAZIO);
  const cap = ids.has(s.cap) ? s.cap : "";
  return (
    <div>
      <div className="space-y-20 md:space-y-28">
        {capitulos.map((c) => (
          <CapituloEditorial key={c.id} c={c} cap={cap} ficha={fichas[c.id]} ctx={contextos[c.id]} />
        ))}
      </div>
    </div>
  );
}

function CapituloEditorial({ c, cap, ficha, ctx }: { c: CapituloPanorama; cap: string; ficha: FichaIndicador; ctx: ContextoFicha }) {
  const [visao, setVisao] = useState<"grafico" | "tabela">("grafico");
  const selecionada = c.pontos.find((p) => p.id === cap);
  const fmt = (v: number) => formata(c.medida as MedidaId, v);
  const fmtEixo = (v: number) => formataEixo(c.medida as MedidaId, v);
  const idTitulo = `cap-${c.id}-titulo`;
  const semCapital = cap && !selecionada;
  const infoCapital =
    cap && selecionada
      ? fraseCapital(selecionada.nome, selecionada.uf, selecionada.valor, c.referencia?.mediana ?? null, c.referencia?.n ?? 0, c.medida)
      : null;
  const linhasTabela = [
    ...c.pontos.map((p) => [`${p.nome} (${p.uf})`, fmt(p.valor)]),
    ...c.semDado.map((x) => [`${x.nome} (${x.uf})`, "Sem dado comparável"]),
  ];
  return (
    <section aria-labelledby={idTitulo} id={`capitulo-${c.id}`} className="scroll-mt-24">
      <p className="rotulo text-obee-dark">{c.pergunta}</p>
      <h2 id={idTitulo} className="mt-3 max-w-[46rem] font-serif text-[1.6rem] leading-[1.2] text-obee-tinta md:text-[1.95rem]">
        {c.titulo}
      </h2>
      <p className="mt-3 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        {c.subtitulo}. {c.cobertura}
      </p>
      {infoCapital && <p className="mt-3 max-w-prose2 text-[0.95rem] leading-relaxed text-obee-tinta">{infoCapital}</p>}
      {semCapital && <p className="mt-3 max-w-prose2 text-[0.95rem] leading-relaxed text-obee-tinta">A capital escolhida não tem dado comparável nesta medida e neste período; a tabela mostra o motivo.</p>}
      <div className="mt-5">
        <Alternancia
          rotulo={`Forma de ver: ${c.pergunta}`}
          rotuloVisivel={false}
          valor={visao}
          opcoes={[
            { v: "grafico", t: "Gráfico" },
            { v: "tabela", t: "Tabela" },
          ]}
          aoMudar={setVisao}
        />
      </div>
      <div className="mt-4">
        {c.pontos.length === 0 ? (
          <p className="border border-dashed border-mineral bg-papel px-4 py-3 text-sm text-obee-tinta" role="note">
            Nenhuma capital tem dado comparável para esta medida neste período.
          </p>
        ) : visao === "grafico" ? (
          <FaixaDistribuicao
            pontos={c.pontos.map((p) => ({ chave: p.id, rotulo: `${p.nome} (${p.uf})`, valor: p.valor, destacada: p.id === cap }))}
            mediana={c.referencia?.mediana ?? null}
            media={c.referencia?.media ?? null}
            faixa={c.referencia && c.referencia.quartisExibicao && c.referencia.q1 !== null && c.referencia.q3 !== null ? { q1: c.referencia.q1, q3: c.referencia.q3 } : null}
            formata={fmt}
            formataEixo={fmtEixo}
            titulo={`${c.pergunta} ${c.titulo}`}
            zero={c.medida === "despesa_hab"}
          />
        ) : (
          <TabelaSimples legenda={`${c.titulo} Valores de cada capital`} cabecalho={["Capital", c.medida === "despesa_hab" ? "R$ por habitante" : "Valor"]} linhas={linhasTabela} />
        )}
      </div>
      {c.externas.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-l-2 border-obee-neutro pl-3 text-sm leading-snug text-obee-tinta">
          {c.externas.map((e) => (
            <li key={e.rotulo}>
              <span className="rotulo !text-[0.66rem] text-mineral">{e.classe === "calculada" ? "Calculado pelo OBEE com fontes oficiais" : "Oficial publicado"}</span>
              <br />
              {e.texto}
              <span className="text-carvao-muted">. {e.escopo}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link
          href={hrefTema(c.id as Tema, { ...c.aprofunda.params, cap: cap || undefined })}
          className="inline-flex min-h-[44px] items-center gap-1.5 border border-obee-tinta px-4 text-[0.9375rem] text-obee-tinta hover:bg-obee-tinta hover:text-superficie"
        >
          {c.aprofunda.rotulo} <span aria-hidden="true">→</span>
        </Link>
        <SobreEsteDado f={ficha} ctx={ctx} />
      </div>
    </section>
  );
}
