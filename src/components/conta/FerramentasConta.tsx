"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { destinoAtual, useSessao } from "@/components/acesso/sessao";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { cadenciaDe, textosDominio, type DominioFrescorId } from "@/lib/frescor";
import {
  bibtex,
  linhaDoi,
  linhaFonte,
  pacoteTexto,
  referenciaAbnt,
  ris,
  slugCitacao,
  tituloDaPagina,
  type DadosCitacaoPagina,
  type FonteCitacao,
} from "@/lib/conta/citar";

/**
 * Ferramentas da conta na barra comum dos painéis (CabecalhoPlataforma): "Salvar recorte · Citar · Avisar quando
 * atualizar". Só aparecem com sessão: sem ela (visitante, inclusive nas consultas abertas) nada é desenhado, e o HTML
 * do servidor, igual para todos, também não traz a barra. A SPA do Crédito (public/obs/app.js) não usa esta barra.
 */
type Props = {
  /**
   * "menu": a forma do celular (abaixo de 640 px), na linha da marca, no lugar do link "Minha conta": um só botão "Conta ▾"
   * com as três ferramentas e a conta, para a barra não ganhar uma linha só para elas (Iniciativa 2 do parecer de UX de
   * 21/10/2026). O CSS (public/observatorios.css) mostra uma forma ou a outra conforme a largura.
   */
  menu?: boolean;
  /** Coleção ou observatório da página (src/lib/conta/origens.ts), gravado com o recorte. */
  origem: string;
  /** Nome completo do observatório, para a citação. */
  observatorio: string;
  /** Fontes de dados da página (domínios de frescor), para o "Citar" e o "Avisar". */
  dominios: readonly DominioFrescorId[];
};

export function FerramentasConta(props: Props) {
  const logado = useSessao();
  return <BarraFerramentasConta logado={logado} {...props} />;
}

/** O que a barra mostra para cada estado da sessão: nada enquanto a resposta não chega e nada sem sessão. */
export function BarraFerramentasConta({ logado, ...props }: Props & { logado: boolean | null }) {
  if (logado !== true || props.dominios.length === 0) return null;
  return <Ferramentas {...props} />;
}

type Ferramenta = "salvar" | "citar" | "avisar";

function Ferramentas({ menu = false, origem, observatorio, dominios }: Props) {
  const tx = useTx();
  const id = useId();
  const [aberta, setAberta] = useState<Ferramenta | null>(null);
  const [lista, setLista] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const gatilhos = useRef<Partial<Record<Ferramenta, HTMLButtonElement | null>>>({});
  const botaoMenu = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberta && !lista) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setAberta(null);
        setLista(false);
      }
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // no menu do celular o foco volta ao botão "Conta"; na barra, ao botão da ferramenta
      (menu ? botaoMenu.current : aberta ? gatilhos.current[aberta] : null)?.focus();
      setAberta(null);
      setLista(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberta, lista, menu]);

  const itens: { chave: Ferramenta; curto: string; resto: string; titulo: string }[] = [
    { chave: "salvar", curto: tx("Salvar", "Save"), resto: tx(" recorte", " view"), titulo: tx("Salvar este recorte", "Save this view") },
    { chave: "citar", curto: tx("Citar", "Cite"), resto: "", titulo: tx("Citar esta página", "Cite this page") },
    {
      chave: "avisar",
      curto: tx("Avisar", "Notify"),
      resto: tx(" quando atualizar", " on update"),
      titulo: tx("Avisar quando atualizar", "Notify me on update"),
    },
  ];

  const painel = aberta && (
    <section id={`${id}-${aberta}`} className="bp-painel" aria-label={itens.find((i) => i.chave === aberta)!.titulo}>
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-serif text-lg leading-snug text-carvao">{itens.find((i) => i.chave === aberta)!.titulo}</h2>
        <button
          type="button"
          className="rotulo -mr-2 -mt-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-carvao-muted hover:text-carvao"
          onClick={() => {
            (menu ? botaoMenu.current : gatilhos.current[aberta])?.focus();
            setAberta(null);
          }}
        >
          {tx("Fechar", "Close")}
        </button>
      </div>
      {aberta === "salvar" && <PainelSalvar origem={origem} />}
      {aberta === "citar" && <PainelCitar observatorio={observatorio} dominios={dominios} />}
      {aberta === "avisar" && <PainelAvisar dominios={dominios} />}
    </section>
  );

  if (menu)
    return (
      <div ref={caixa} className="bp-ferramentas-menu" data-ferramentas-conta="menu">
        <button
          ref={botaoMenu}
          type="button"
          className="bp-ferramenta"
          aria-expanded={lista || aberta !== null}
          aria-controls={`${id}-lista`}
          onClick={() => {
            setAberta(null);
            setLista((l) => !l);
          }}
        >
          <span>
            {tx("Conta", "Account")}
            <span className="sr-only">{tx(": ferramentas e minha conta", ": tools and my account")}</span>
          </span>
          <span aria-hidden="true" className="ml-1 text-xs">
            ▾
          </span>
        </button>
        {lista && (
          <ul id={`${id}-lista`} className="bp-painel bp-menu-conta">
            {itens.map((it) => (
              <li key={it.chave}>
                <button
                  type="button"
                  className="flex min-h-[44px] w-full items-center text-left text-sm text-carvao hover:text-energia-dark"
                  onClick={() => {
                    setLista(false);
                    setAberta(it.chave);
                  }}
                >
                  {it.titulo}
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-linha pt-1">
              <Link href="/app/conta" className="flex min-h-[44px] items-center text-sm text-carvao hover:text-energia-dark">
                {tx("Minha conta", "My account")}
              </Link>
            </li>
          </ul>
        )}
        {painel}
      </div>
    );

  return (
    <div ref={caixa} className="bp-ferramentas" role="group" aria-label={tx("Ferramentas da conta", "Account tools")} data-ferramentas-conta="">
      {itens.map((it, i) => (
        <span key={it.chave} className="bp-ferramenta-item">
          {i > 0 && (
            <span aria-hidden="true" className="bp-ferramentas-sep">
              ·
            </span>
          )}
          <button
            ref={(el) => {
              gatilhos.current[it.chave] = el;
            }}
            type="button"
            className="bp-ferramenta"
            aria-expanded={aberta === it.chave}
            aria-controls={`${id}-${it.chave}`}
            onClick={() => setAberta((a) => (a === it.chave ? null : it.chave))}
          >
            {/* um só nó de texto dentro do botão flexível: o espaço antes do resto do rótulo não some */}
            <span>
              {it.curto}
              {it.resto && <span className="bp-ferramenta-resto">{it.resto}</span>}
            </span>
          </button>
        </span>
      ))}
      {painel}
    </div>
  );
}

const botao =
  "rotulo inline-flex min-h-[44px] items-center justify-center border border-carvao px-4 text-carvao transition-colors hover:bg-carvao hover:text-marfim disabled:cursor-not-allowed disabled:opacity-50";
const botaoLeve =
  "rotulo inline-flex min-h-[44px] items-center justify-center border border-linha px-4 text-carvao transition-colors hover:border-carvao";
const nota = "text-xs leading-relaxed text-carvao-muted";

function Mensagem({ tipo, children }: { tipo: "ok" | "erro"; children: ReactNode }) {
  return (
    <p role={tipo === "erro" ? "alert" : "status"} className={`mt-3 border-l-2 pl-3 text-sm ${tipo === "erro" ? "border-erro text-erro" : "border-sucesso text-carvao"}`}>
      {children}
    </p>
  );
}

/* ---------------- Salvar recorte ---------------- */

function PainelSalvar({ origem }: { origem: string }) {
  const tx = useTx();
  const campo = useId();
  const [caminho, setCaminho] = useState("");
  const [titulo, setTitulo] = useState("");
  const [estado, setEstado] = useState<
    { tipo: "livre" } | { tipo: "salvando" } | { tipo: "salvo"; existente: boolean } | { tipo: "erro"; texto: string }
  >({ tipo: "livre" });
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setCaminho(destinoAtual());
    setTitulo(tituloDaPagina(document.title).slice(0, 120));
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEstado({ tipo: "salvando" });
    try {
      const r = await fetch("/api/conta/recortes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, caminho, observatorio: origem }),
      });
      const j = (await r.json().catch(() => ({}))) as { existente?: boolean; error?: string };
      if (r.ok) setEstado({ tipo: "salvo", existente: !!j.existente });
      else if (r.status === 401) setEstado({ tipo: "erro", texto: tx("Sua sessão terminou. Entre de novo para salvar.", "Your session has ended. Sign in again to save.") });
      else setEstado({ tipo: "erro", texto: j.error ?? tx("Não foi possível salvar. Tente de novo.", "Could not save. Please try again.") });
    } catch {
      setEstado({ tipo: "erro", texto: tx("Não foi possível salvar. Tente de novo.", "Could not save. Please try again.") });
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${caminho}`);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1600);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <form onSubmit={salvar} className="mt-3 space-y-3">
      <p className={nota}>
        {tx(
          "O recorte guarda esta página com os filtros que estão no endereço. Filtros que a página não grava no endereço não entram.",
          "The saved view keeps this page with the filters in its address. Filters the page does not write to the address are not included.",
        )}
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={campo} className="rotulo text-carvao-muted">
          {tx("Título do recorte", "Title of the view")}
        </label>
        <input
          id={campo}
          value={titulo}
          maxLength={120}
          required
          onChange={(e) => setTitulo(e.target.value)}
          className="min-h-[44px] border border-linha bg-papel px-3 py-2 text-base text-carvao focus:border-bronze"
        />
      </div>
      <p className="break-all font-mono text-xs text-carvao-muted">{caminho}</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={botao} disabled={estado.tipo === "salvando" || !titulo.trim() || !caminho}>
          {estado.tipo === "salvando" ? tx("Salvando…", "Saving…") : tx("Salvar", "Save")}
        </button>
        <button type="button" className={botaoLeve} onClick={copiarLink} disabled={!caminho}>
          {copiado ? tx("Link copiado", "Link copied") : tx("Copiar link", "Copy link")}
        </button>
      </div>
      {estado.tipo === "salvo" && (
        <Mensagem tipo="ok">
          {estado.existente ? tx("Este endereço já estava salvo.", "This address was already saved.") : tx("Recorte salvo.", "View saved.")}{" "}
          <Link href="/app/conta#recortes" className="underline underline-offset-4">
            {tx("Ver em Minha conta", "See it in My account")}
          </Link>
        </Mensagem>
      )}
      {estado.tipo === "erro" && <Mensagem tipo="erro">{estado.texto}</Mensagem>}
      <p className={nota}>
        {tx(
          "O link compartilhável é o próprio endereço: quem não tem conta entra ou se cadastra e volta a esta página.",
          "The shareable link is the address itself: people without an account sign in or register and come back to this page.",
        )}
      </p>
    </form>
  );
}

/* ---------------- Citar ---------------- */

function baixar(nome: string, tipo: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PainelCitar({ observatorio, dominios }: { observatorio: string; dominios: readonly DominioFrescorId[] }) {
  const tx = useTx();
  const idioma = useIdioma();
  const [dados, setDados] = useState<DadosCitacaoPagina | null>(null);
  const [erro, setErro] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [manual, setManual] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch(`/api/conta/citacao?dominios=${dominios.join(",")}`, { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ fontes: FonteCitacao[]; doi: string | null }>) : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (!vivo) return;
        setDados({ titulo: tituloDaPagina(document.title), observatorio, url: window.location.href, acesso: new Date(), fontes: j.fontes, doi: j.doi });
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
    // a lista vem do servidor e não muda na página; a chave em texto evita refazer a consulta a cada renderização
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominios.join(","), observatorio]);

  if (erro) return <Mensagem tipo="erro">{tx("Não foi possível montar a citação. Tente de novo.", "Could not build the citation. Please try again.")}</Mensagem>;
  if (!dados) return <p className="mt-3 text-sm text-carvao-muted" role="status">{tx("Montando a citação…", "Building the citation…")}</p>;

  const texto = pacoteTexto(dados, idioma);
  const ids = dados.fontes.filter((f) => f.idPublicacao);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setManual("");
      window.setTimeout(() => setCopiado(false), 1600);
    } catch {
      setManual(texto);
    }
  }
  const arquivo = `scrutiniums-${slugCitacao(dados.titulo)}`;

  return (
    <div className="mt-3 space-y-4 text-sm">
      <div>
        <h3 className="rotulo text-carvao-muted">{tx("Referência (ABNT NBR 6023)", "Reference (ABNT NBR 6023)")}</h3>
        <p className="mt-1 break-words leading-relaxed text-carvao">{referenciaAbnt(dados, idioma)}</p>
      </div>
      <div>
        <h3 className="rotulo text-carvao-muted">{tx("Fonte dos dados", "Data source")}</h3>
        <ul className="mt-1 space-y-1 leading-relaxed text-carvao">
          {dados.fontes.map((f) => (
            <li key={f.id}>{linhaFonte(f, idioma)}</li>
          ))}
        </ul>
        <p className={`mt-1 ${nota}`}>
          {tx(
            "Fonte e data são as do conjunto de dados do observatório; cada gráfico e tabela traz a referência própria do número.",
            "Source and date are those of the observatory's dataset; each chart and table carries the reference of its own figures.",
          )}
        </p>
      </div>
      {ids.length > 0 && (
        <div>
          <h3 className="rotulo text-carvao-muted">{tx("Identificador da publicação", "Publication identifier")}</h3>
          {ids.map((f) => (
            <p key={f.id} className="mt-1 break-all font-mono text-xs text-carvao">
              {textosDominio(f.id, idioma).nome}: sha256 {f.idPublicacao}
            </p>
          ))}
        </div>
      )}
      <div>
        <h3 className="rotulo text-carvao-muted">DOI</h3>
        <p className="mt-1 text-carvao">{linhaDoi(dados.doi, idioma)}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={botao} onClick={copiar}>
          {copiado ? tx("Citação copiada", "Citation copied") : tx("Copiar citação", "Copy citation")}
        </button>
        <button type="button" className={botaoLeve} onClick={() => baixar(`${arquivo}.bib`, "application/x-bibtex;charset=utf-8", bibtex(dados))}>
          {tx("Baixar .bib", "Download .bib")}
        </button>
        <button
          type="button"
          className={botaoLeve}
          onClick={() => baixar(`${arquivo}.ris`, "application/x-research-info-systems;charset=utf-8", ris(dados))}
        >
          {tx("Baixar .ris", "Download .ris")}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {copiado ? tx("Copiado para a área de transferência.", "Copied to the clipboard.") : ""}
      </p>
      {manual && (
        <label className="block text-xs text-carvao-muted">
          {tx("Copie manualmente:", "Copy manually:")}
          <textarea readOnly value={manual} rows={6} className="mt-1 w-full border border-linha bg-papel p-2 font-mono text-xs text-carvao" />
        </label>
      )}
    </div>
  );
}

/* ---------------- Avisar quando atualizar ---------------- */

function PainelAvisar({ dominios }: { dominios: readonly DominioFrescorId[] }) {
  const tx = useTx();
  const idioma = useIdioma();
  const [assinados, setAssinados] = useState<Set<string> | null>(null);
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/api/conta/alertas", { cache: "no-store", credentials: "same-origin" })
      .then((r) =>
        r.ok ? (r.json() as Promise<{ alertas: { dominio: string }[]; envioLigado: boolean }>) : Promise.reject(new Error(String(r.status))),
      )
      .then((j) => {
        if (!vivo) return;
        setAssinados(new Set(j.alertas.map((a) => a.dominio)));
        setLigado(j.envioLigado === true);
      })
      .catch(() => vivo && setErro(tx("Não foi possível ler seus alertas. Tente de novo.", "Could not load your alerts. Please try again.")));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alternar(d: DominioFrescorId) {
    if (!assinados) return;
    const ativo = assinados.has(d);
    setOcupado(d);
    setErro("");
    try {
      const r = ativo
        ? await fetch(`/api/conta/alertas/${encodeURIComponent(d)}`, { method: "DELETE" })
        : await fetch("/api/conta/alertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dominio: d }) });
      if (!r.ok) throw new Error(String(r.status));
      const novo = new Set(assinados);
      if (ativo) novo.delete(d);
      else novo.add(d);
      setAssinados(novo);
    } catch {
      setErro(tx("Não foi possível salvar o alerta. Tente de novo.", "Could not save the alert. Please try again."));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="mt-3 space-y-3 text-sm">
      <p className={nota}>
        {tx(
          "O aviso é um e-mail para o endereço da sua conta quando a data de referência dos dados avançar. A verificação é diária; sem dado novo, nada é enviado.",
          "The alert is an email to the address of your account when the reference date of the data moves forward. The check runs daily; without new data, nothing is sent.",
        )}
      </p>
      {ligado === false && (
        <p role="status" className="border-l-2 border-aviso pl-3 text-sm text-carvao">
          {tx(
            "O envio por e-mail ainda não está ligado. A assinatura fica registrada e passa a valer quando a verificação diária entrar em funcionamento, sem precisar assinar de novo; até lá, nenhum e-mail sai.",
            "Email delivery is not switched on yet. The subscription is recorded and takes effect when the daily check starts running, with no need to subscribe again; until then, no email is sent.",
          )}
        </p>
      )}
      {!assinados && !erro && (
        <p role="status" className="text-carvao-muted">
          {tx("Carregando…", "Loading…")}
        </p>
      )}
      {assinados && (
        <ul className="divide-y divide-linha border-y border-linha">
          {dominios.map((d) => {
            const t = textosDominio(d, idioma);
            const ativo = assinados.has(d);
            return (
              <li key={d} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                <span className="min-w-0">
                  <span className="block text-carvao">{t.nome}</span>
                  <span className="block text-xs text-carvao-muted">
                    {tx("Cadência", "Frequency")} {cadenciaDe(d)[idioma === "en" ? "rotuloEn" : "rotulo"]} · {t.referencia}
                    {ativo && <strong className="font-semibold text-carvao"> · {tx("aviso ativo", "alert on")}</strong>}
                  </span>
                </span>
                <button type="button" className={ativo ? botaoLeve : botao} disabled={ocupado === d} onClick={() => alternar(d)}>
                  {ativo ? tx("Cancelar aviso", "Cancel alert") : tx("Avisar", "Notify me")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <p className={nota}>
        {tx("Seus alertas ficam em ", "Your alerts are listed in ")}
        <Link href="/app/conta#alertas" className="underline underline-offset-4">
          {tx("Minha conta", "My account")}
        </Link>
        {tx(", onde também podem ser cancelados.", ", where they can also be cancelled.")}
      </p>
    </div>
  );
}
