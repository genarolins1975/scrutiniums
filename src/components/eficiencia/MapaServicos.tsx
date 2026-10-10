"use client";

import { useState } from "react";
import Link from "next/link";
import { DIMENSOES, GRUPOS, filtraDimensoes, type GrupoDimensao } from "@/lib/eficiencia/dimensoes";

export function MapaServicos() {
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState<GrupoDimensao | "Todas">("Todas");
  const [publicados, setPublicados] = useState(false);
  const dimensoes = filtraDimensoes(busca, grupo, publicados);
  const limpar = () => { setBusca(""); setGrupo("Todas"); setPublicados(false); };
  return <section id="dimensoes" aria-labelledby="titulo-dimensoes" className="mt-12 scroll-mt-6">
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr] md:items-end">
      <div><p className="rotulo text-obee">O mapa dos serviços públicos</p><h2 id="titulo-dimensoes" className="mt-1 font-serif text-3xl md:text-4xl">O que você precisa do Estado?</h2></div>
      <p className="text-sm leading-relaxed text-carvao-muted">Escolha uma dimensão para conhecer seu escopo. Educação, Saúde, Trabalho e Renda e Segurança Alimentar têm painéis publicados; as demais áreas têm apenas o escopo proposto, sem indicadores publicados aqui.</p>
    </div>
    <div className="mt-6 border-y border-linha py-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 sm:min-w-[20rem]"><label htmlFor="busca-dimensoes" className="text-sm font-semibold">Buscar um serviço ou necessidade</label><input id="busca-dimensoes" type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Ex.: moradia, água, aposentadoria…" className="mt-2 min-h-[48px] w-full border border-linha bg-superficie px-4 text-sm placeholder:text-carvao-muted" /></div>
        <label className="flex min-h-[48px] cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={publicados} onChange={e => setPublicados(e.target.checked)} className="h-5 w-5 accent-obee" />Somente temas publicados</label>
      </div>
      <div role="group" aria-label="Filtrar dimensões por necessidade" className="mt-4 flex flex-wrap gap-2">
        {(["Todas", ...GRUPOS] as const).map(g => <button key={g} type="button" aria-pressed={grupo === g} onClick={() => setGrupo(g)} className={`min-h-[44px] border px-4 text-sm transition-colors ${grupo === g ? "border-obee-tinta bg-obee-tinta text-superficie" : "border-linha bg-superficie text-obee-tinta hover:border-obee"}`}>{g}</button>)}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 py-4"><p role="status" aria-live="polite" className="text-xs text-carvao-muted">{dimensoes.length} de {DIMENSOES.length} dimensões · situação da publicação neste observatório</p>{(busca || grupo !== "Todas" || publicados) && <button type="button" onClick={limpar} className="min-h-[44px] text-sm text-obee-dark underline underline-offset-4">Limpar filtros</button>}</div>
    {dimensoes.length === 0 ? <div className="border border-linha bg-superficie p-8"><h3 className="font-serif text-xl">Nenhuma dimensão encontrada</h3><p className="mt-2 text-sm">Tente outra palavra ou amplie os filtros.</p><button type="button" onClick={limpar} className="mt-3 min-h-[44px] text-sm text-obee-dark underline">Mostrar todas as dimensões</button></div> :
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dimensoes.map(d => <article key={d.id} className={`border bg-superficie ${d.href ? "border-obee" : "border-linha"}`}>
          <div className="p-5">
            <div className="flex items-center gap-2 text-xs"><span aria-hidden="true" className={`h-1.5 w-1.5 ${d.href ? "bg-obee" : "bg-mineral"}`} /><span className={d.href ? "font-semibold text-obee-dark" : "text-carvao-muted"}>{d.href ? "Painel publicado" : "Sem dados publicados"}</span></div>
            <p className="mt-4 font-label text-xs uppercase tracking-label text-mineral">{d.verbo}</p>
            <h3 className="mt-1 font-serif text-xl leading-tight">{d.titulo}</h3>
            <p className="mt-3 min-h-[4.5rem] text-sm leading-relaxed text-carvao-muted">{d.descricao}</p>
            {d.href && <Link href={d.href} className="mt-2 inline-flex min-h-[44px] items-center gap-3 text-sm font-semibold text-obee-dark underline underline-offset-4">Explorar dados <span aria-hidden="true">↗</span></Link>}
          </div>
          <details className="border-t border-linha">
            <summary className="flex min-h-[48px] cursor-pointer items-center justify-between px-5 py-3 text-sm text-obee-dark">Ver escopo <span className="sr-only">de {d.titulo}</span></summary>
            <div className="px-5 pb-5">
              <p className="text-xs leading-relaxed text-carvao-muted">{d.href ? "Escopo amplo da dimensão. O painel atual cobre apenas o recorte declarado em Dados e métodos." : "Escopo proposto para acompanhamento. Coleta, fontes e comparabilidade ainda precisam ser verificadas."}</p>
              <dl className="mt-4 space-y-4 text-sm leading-relaxed">{[["Recursos", d.recursos], ["Acesso e atendimento", d.acesso], ["Resultados", d.resultados]].map(([dt, dd]) => <div key={dt}><dt className="font-semibold">{dt}</dt><dd className="mt-1 text-carvao-muted">{dd}</dd></div>)}</dl>
            </div>
          </details>
        </article>)}
      </div>}
    <p className="mt-4 text-xs leading-relaxed text-carvao-muted">O mapa inclui serviços prestados diretamente pelo poder público e serviços regulados ou financiados por ele. Responsabilidades e formas de provisão variam por área. “Sem dados publicados” descreve a cobertura do observatório; não indica ausência do serviço.</p>
  </section>;
}
