"use client";
import { useState, type FormEvent } from "react";
import { fmtDateTime } from "@/lib/format";
import { dataOperacional, ESTADOS_TAREFA, ROTULOS_TAREFA, type RegistroTarefa, type Tarefa } from "@/lib/operacoes/modelo";

const campo = "mt-1 block min-h-11 w-full rounded border border-mineral bg-superficie px-3 py-2 text-base text-carvao";
const TIPOS = { manual: "Criada pelo ADM", procedimento: "Consulta à fonte", execucao: "Execução", issue: "Encaminhamento", pr: "Revisão de PR" };

function EditorTarefa({ tarefa, salva }: { tarefa?: Tarefa; salva: (t: RegistroTarefa) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(false);
  const manual = !tarefa || tarefa.tipo === "manual";
  const prefixo = tarefa?.id ?? "nova-tarefa";
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setOcupado(true); setMensagem(""); setErro(false);
    try {
      const r = await fetch("/api/admin/tarefas", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(tarefa ? { id: tarefa.id } : {}), ...(manual ? { titulo: f.get("titulo"), detalhe: f.get("detalhe") } : {}),
          estado: f.get("estado"), nota: f.get("nota"), responsavel: f.get("responsavel"), prazo: f.get("prazo"), versao: tarefa?.versao ?? 0 }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Não foi possível salvar. Tente novamente.");
      salva(body.tarefa);
      if (!tarefa) form.reset();
      setMensagem(tarefa ? "Alterações salvas." : "Tarefa criada e incluída na fila.");
    } catch (e) { setErro(true); setMensagem(e instanceof Error ? e.message : "Falha de conexão. Tente novamente."); }
    finally { setOcupado(false); }
  }
  return <form method="post" action="/api/admin/tarefas" onSubmit={enviar} className="max-w-4xl space-y-4 py-4" aria-label={tarefa ? `Editar ${tarefa.titulo}` : "Criar tarefa manual"}>
    {manual && <><label className="block text-sm font-medium" htmlFor={`${prefixo}-titulo`}>O que precisa ser feito?<input id={`${prefixo}-titulo`} name="titulo" defaultValue={tarefa?.titulo ?? ""} required minLength={3} maxLength={240} className={campo} /></label>
      <label className="block text-sm font-medium" htmlFor={`${prefixo}-detalhe`}>Por quê e como resolver<textarea id={`${prefixo}-detalhe`} name="detalhe" defaultValue={tarefa?.detalhe ?? ""} maxLength={2000} rows={3} className={campo} /></label></>}
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm font-medium" htmlFor={`${prefixo}-estado`}>Andamento<select id={`${prefixo}-estado`} name="estado" defaultValue={tarefa?.estado ?? "aberta"} className={campo}>{ESTADOS_TAREFA.map((e) => <option key={e} value={e}>{ROTULOS_TAREFA[e]}</option>)}</select></label>
      <label className="text-sm font-medium" htmlFor={`${prefixo}-responsavel`}>Responsável<input id={`${prefixo}-responsavel`} name="responsavel" maxLength={100} defaultValue={tarefa?.responsavel ?? ""} className={campo} /></label>
      <label className="min-w-0 text-sm font-medium" htmlFor={`${prefixo}-prazo`}>Prazo combinado<input id={`${prefixo}-prazo`} name="prazo" type="date" defaultValue={tarefa?.prazo ?? ""} className={`${campo} min-w-0`} /></label>
    </div>
    <label className="block text-sm font-medium" htmlFor={`${prefixo}-nota`}>Registro do ADM<textarea id={`${prefixo}-nota`} name="nota" maxLength={2000} rows={3} defaultValue={tarefa?.nota ?? ""} className={campo} aria-describedby={`${prefixo}-privacidade`} /></label>
    <p id={`${prefixo}-privacidade`} className="text-sm text-mineral">Visível apenas aos administradores. Registre evidência e próximos passos; não inclua senhas, tokens ou dados pessoais de leitores.</p>
    <div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={ocupado} className="min-h-11 rounded bg-carvao px-5 py-2 text-superficie disabled:cursor-wait">{ocupado ? "Salvando…" : tarefa ? "Salvar andamento" : "Criar tarefa"}</button>
      <p role={erro ? "alert" : "status"} className={`text-sm ${erro ? "text-erro" : "text-carvao-muted"}`}>{mensagem}</p></div>
  </form>;
}

export function TarefasOperacao({ iniciais, monitorDisponivel }: { iniciais: Tarefa[]; monitorDisponivel: boolean }) {
  const [tarefas, setTarefas] = useState(iniciais);
  const [filtro, setFiltro] = useState("pendentes");
  const [busca, setBusca] = useState("");
  const [anuncio, setAnuncio] = useState("");
  const visiveis = tarefas.filter((t) => (filtro === "todas" || (filtro === "pendentes" ? t.estado !== "concluida" : t.estado === filtro)) &&
    `${t.titulo} ${t.detalhe} ${t.responsavel}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  function salva(t: RegistroTarefa) {
    setTarefas((lista) => lista.some((x) => x.id === t.id) ? lista.map((x) => x.id === t.id ? { ...x, ...t } : x) : [{ ...t, sinalAtivo: false }, ...lista]);
    if ((filtro === "pendentes" && t.estado === "concluida") || (ESTADOS_TAREFA.includes(filtro as Tarefa["estado"]) && filtro !== t.estado)) {
      requestAnimationFrame(() => document.getElementById("andamento-fila")?.focus());
    }
    setAnuncio(`${t.titulo}: ${ROTULOS_TAREFA[t.estado]}. Alteração salva.`);
  }
  return <section id="tarefas" aria-labelledby="titulo-tarefas" className="scroll-mt-8 min-w-0 [overflow-wrap:anywhere] border-t border-linha pt-8">
    <h2 id="titulo-tarefas" className="font-serif text-2xl">O que o ADM precisa fazer?</h2>
    <p className="mt-3 max-w-3xl text-carvao-muted">Fila compartilhada entre os administradores. Concluir uma tarefa registra seu encaminhamento; a publicação e o resultado da rotina continuam sendo conferidos separadamente.</p>
    {!monitorDisponivel && <p className="mt-3 max-w-3xl text-sm text-bronze-dark">Consulta automática incompleta, indisponível ou fora do prazo. A fila pode estar incompleta; as tarefas já salvas continuam disponíveis.</p>}
    <details className="mt-4 border-y border-linha"><summary className="min-h-11 cursor-pointer py-3 font-medium text-destaque">Criar tarefa manual</summary><EditorTarefa salva={salva} /></details>
    <div className="mt-6 flex flex-wrap items-end gap-4">
      <label className="text-sm" htmlFor="andamento-fila">Andamento<select id="andamento-fila" value={filtro} onChange={(e) => setFiltro(e.target.value)} className={campo}><option value="pendentes">Pendentes</option><option value="todas">Todas</option>{ESTADOS_TAREFA.map((e) => <option key={e} value={e}>{ROTULOS_TAREFA[e]}</option>)}</select></label>
      <label className="w-full text-sm sm:max-w-sm" htmlFor="busca-tarefa">Buscar na fila<input id="busca-tarefa" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={campo} /></label>
    </div>
    <p className="my-4 text-sm text-carvao-muted" role="status">{visiveis.length} tarefas neste recorte · {tarefas.filter((t) => t.estado !== "concluida").length} pendentes no total</p>
    <p className="sr-only" role="status">{anuncio}</p>
    {!visiveis.length && <p className="border-y border-linha py-8 text-carvao-muted">Nenhuma tarefa neste recorte. Consulte outro andamento ou crie uma tarefa manual.</p>}
    <ul className="divide-y divide-linha border-t border-linha">{visiveis.map((t) => <li key={t.id} className="py-4">
      <details><summary className="min-h-11 cursor-pointer py-2"><span className="font-medium">{t.titulo}</span><span className="ml-2 inline-block text-sm text-carvao-muted">· {ROTULOS_TAREFA[t.estado]}</span>{(t.responsavel || t.prazo) && <span className="mt-1 block text-sm text-carvao-muted">{t.responsavel ? `Responsável: ${t.responsavel}` : "Responsável não definido"}{t.prazo ? ` · Prazo: ${dataOperacional(t.prazo)}` : ""}</span>}</summary>
        <p className="mt-2 max-w-3xl text-sm text-carvao-muted">{t.detalhe}</p>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-carvao-muted"><div><dt className="inline">Origem: </dt><dd className="inline">{TIPOS[t.tipo]}</dd></div><div><dt className="inline">Desde: </dt><dd className="inline">{fmtDateTime(t.desde)}</dd></div>{t.prazo && <div><dt className="inline">Prazo: </dt><dd className="inline">{dataOperacional(t.prazo)}</dd></div>}</dl>
        {t.origem && <a href={t.origem} className="inline-flex min-h-11 items-center text-sm text-destaque underline underline-offset-4">Abrir evidência de origem</a>}
        {t.sinalAtivo && t.estado === "concluida" && <p className="max-w-3xl text-sm text-bronze-dark">O sinal continua na consulta do monitor. O encaminhamento concluído não confirma que a causa foi resolvida.</p>}
        {!t.sinalAtivo && t.tipo !== "manual" && <p className="max-w-3xl text-sm text-carvao-muted">Tarefa preservada no histórico do ADM. Confirme a situação atual na evidência de origem.</p>}
        <EditorTarefa tarefa={t} salva={salva} />
      </details>
    </li>)}</ul>
  </section>;
}
