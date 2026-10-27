import Link from "next/link";
import { fmtDateTime } from "@/lib/format";
import { rotuloReferencia, textoSituacao } from "@/lib/frescor/regras";
import { CATALOGO, GITHUB, dataOperacional, monitorVigente, situacaoExecucao, type LeituraEstado, type LinhaQuadro } from "@/lib/operacoes/modelo";

const data = dataOperacional;
export function ResumoAtualizacoes({ linhas }: { linhas: LinhaQuadro[] }) {
  const pendentes = linhas.filter((l) => l.situacao.estado !== "em-dia").length;
  return <section aria-labelledby="resumo-atualizacoes" className="mt-8 border-y border-linha py-6">
    <h2 id="resumo-atualizacoes" className="font-serif text-2xl text-carvao">Atualização dos dados</h2>
    <p className="mt-2 max-w-3xl text-carvao-muted">{pendentes ? `${pendentes} de ${linhas.length} áreas pedem conferência de frescor.` : `As ${linhas.length} áreas estão dentro do prazo de publicação configurado.`} A execução das rotinas e as pendências manuais têm acompanhamento próprio.</p>
    <Link href="/app/admin/atualizacoes" className="mt-4 inline-flex min-h-11 items-center text-destaque underline underline-offset-4">Abrir quadro de atualização e tarefas do ADM</Link>
  </section>;
}

export function QuadroAtualizacoes({ linhas, leitura, agora, filtro }: { linhas: LinhaQuadro[]; leitura: LeituraEstado; agora: Date; filtro: string }) {
  const { estado, aviso } = leitura;
  const vigente = monitorVigente(estado, agora);
  const visiveis = filtro === "atencao" ? linhas.filter((l) => l.situacao.estado !== "em-dia") : linhas;
  return <section id="publicacoes" aria-labelledby="titulo-publicacoes" className="scroll-mt-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-linha pb-4">
      <div><h2 id="titulo-publicacoes" className="font-serif text-2xl">Publicações disponíveis</h2>
        <p className="mt-2 max-w-3xl text-sm text-carvao-muted">Arquivos desta versão do site · conferidos em {fmtDateTime(agora)} (Brasília).</p></div>
      <form className="flex items-end gap-2" action="/app/admin/atualizacoes">
        <label className="text-sm" htmlFor="filtro-publicacao">Mostrar
          <select id="filtro-publicacao" name="situacao" defaultValue={filtro} className="mt-1 block min-h-11 border border-mineral bg-superficie px-3 text-carvao">
            <option value="todas">Todas as áreas</option><option value="atencao">Frescor a conferir</option>
          </select></label>
        <button className="min-h-11 border border-mineral px-3 text-sm" type="submit">Aplicar</button>
      </form>
    </div>
    <div className="my-3 max-w-4xl text-sm text-carvao-muted">
      <p>{aviso ?? `Rotinas consultadas em ${fmtDateTime(estado!.geradoEm)} (Brasília).`}</p>
      {estado && !vigente && <p className="mt-2 font-semibold text-bronze-dark">Consulta fora do prazo de três horas ou com relógio inconsistente. Os resultados abaixo são históricos; confira as execuções antes de decidir.</p>}
      {!!estado?.erros.length && <p className="mt-2 text-bronze-dark">{estado.erros.length} consultas do monitor não puderam ser concluídas. A ausência de resultado não significa aprovação.</p>}
      {aviso && <a href={`${GITHUB}/actions`} className="inline-flex min-h-11 items-center text-destaque underline underline-offset-4">Conferir execuções no GitHub</a>}
    </div>
    <div className="hidden grid-cols-[1.1fr_1fr_1.1fr_1.5fr] gap-6 border-b border-linha py-3 text-sm font-semibold lg:grid" aria-hidden="true">
      <span>Área e cadência</span><span>Publicação disponível</span><span>Referência dos dados</span><span>Rotinas automáticas</span>
    </div>
    {!visiveis.length && <p className="py-8 text-carvao-muted">Nenhuma área fora do prazo configurado. Confira também as tarefas e as rotinas: uma edição nova pode aguardar integração.</p>}
    {visiveis.map((l) => <article key={l.id} className="border-b border-linha py-5" aria-labelledby={`area-${l.id}`}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1.1fr_1.5fr] lg:gap-6">
        <div><h3 id={`area-${l.id}`} className="font-semibold"><Link className="text-destaque underline underline-offset-4" href={l.rota}>{l.nome}</Link></h3>
          <p className="mt-1 text-sm text-carvao-muted">Cadência {l.cadencia}</p>
          <p className={`mt-2 text-sm font-medium ${l.situacao.estado === "em-dia" ? "text-carvao" : "text-bronze-dark"}`}>{textoSituacao(l.situacao)}</p></div>
        <dl><dt className="text-sm text-mineral lg:sr-only">Publicação mais antiga</dt><dd className="mt-1 text-sm tabular-nums lg:mt-0">{data(l.frescor.publicadoEm)}</dd>
          {l.frescor.parteMaisRecente && data(l.frescor.parteMaisRecente) !== data(l.frescor.publicadoEm) && <><dt className="mt-2 text-sm text-mineral">Parte mais recente</dt><dd className="text-sm tabular-nums">{data(l.frescor.parteMaisRecente)}</dd></>}</dl>
        <div><p className="text-sm text-mineral lg:sr-only">Referência principal</p><p className="text-sm">{l.frescor.referencia ? rotuloReferencia(l.frescor.referencia) : "Não informada"}</p><p className="mt-1 text-sm text-carvao-muted">{l.referenciaRotulo}</p></div>
        <ul className="space-y-3">{l.workflows.map((w) => {
          const r = estado?.execucoes.find((e) => e.workflow === w);
          return <li key={w} className="text-sm"><a className="text-destaque underline underline-offset-4" href={r?.url ?? `${GITHUB}/actions/workflows/${w}`}>{CATALOGO.workflows[w as keyof typeof CATALOGO.workflows].nome}</a>
            <p className="mt-1">{estado?.erros.includes(w) ? "Consulta indisponível" : situacaoExecucao(r)}{r?.tentativa && r.tentativa > 1 ? ` · tentativa ${r.tentativa}` : ""}{r?.iniciadaEm ? ` · ${fmtDateTime(r.iniciadaEm)}` : ""}</p></li>;
        })}</ul>
      </div>
      <details className="mt-4 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-destaque">Automação, fontes e trabalho manual · {l.nome}</summary>
        <div className="grid max-w-5xl gap-5 pb-2 sm:grid-cols-2"><div><h4 className="font-semibold">O que roda sozinho</h4><p className="mt-2 text-carvao-muted">{l.automatico}</p><p className="mt-2 text-carvao-muted">{l.nota}</p></div><div><h4 className="font-semibold">Quando o ADM precisa agir</h4><p className="mt-2 text-carvao-muted">{l.manual}</p><a href={`${GITHUB}/blob/main/OPERACOES.md`} className="mt-2 inline-flex min-h-11 items-center text-destaque underline underline-offset-4">Ler procedimento operacional</a></div></div>
      </details>
    </article>)}
    <p className="mt-5 max-w-4xl text-sm text-carvao-muted">O período do dado é diferente da data de publicação. O monitor consulta as rotinas a cada hora, com até cinco minutos de cache. Uma execução aprovada não confirma que houve deploy; as datas acima são dos arquivos desta versão.</p>
    <details className="mt-5"><summary className="min-h-11 cursor-pointer py-3 text-destaque">Vigília, e-mails e depósito de pesquisa</summary>
      <ul className="divide-y divide-linha">{Object.entries(CATALOGO.workflows).filter(([w]) => !CATALOGO.dominios.some((d) => d.workflows.includes(w))).map(([w, c]) => {
        const r = estado?.execucoes.find((e) => e.workflow === w);
        return <li className="flex flex-wrap justify-between gap-2 py-3 text-sm" key={w}><a href={r?.url ?? `${GITHUB}/actions/workflows/${w}`} className="text-destaque underline underline-offset-4">{c.nome}</a><span>{estado?.erros.includes(w) ? "Consulta indisponível" : situacaoExecucao(r)}{r?.tentativa && r.tentativa > 1 ? ` · tentativa ${r.tentativa}` : ""}{r?.iniciadaEm ? ` · ${fmtDateTime(r.iniciadaEm)}` : ""}</span></li>;
      })}</ul>
    </details>
  </section>;
}
