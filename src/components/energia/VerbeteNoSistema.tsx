import { ModeloDidatico, type ListaDeFora } from "@/components/observatorios/ModeloDidatico";
import { conceito, type Conceito } from "@/lib/energia/conteudo/conceitos";
import { posicaoNoSistema } from "@/lib/energia/conteudo/posicao-no-sistema";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { FAIXAS_MAPA, LIGACOES, NOS_MAPA, O_QUE_O_MAPA_NAO_DIZ, ORDEM_FAIXAS, ROTULOS_FAIXA, TIPOS_LIGACAO, type IdNo, type PontaLigacao, type TipoLigacao } from "@/lib/energia/mapa";
import { plural } from "@/lib/energia/formato";

/**
 * Figura do verbete do Aprenda: em que parte do sistema elétrico o conceito aparece. É o mapa dos sete elos da página inicial
 * (`NOS_MAPA` e `LIGACOES`, a mesma geometria e as mesmas formas de ligação), em miniatura e sem interação, com o elo do verbete
 * marcado, as ligações desse elo em destaque e os elos dos verbetes relacionados assinalados. A posição vem de `posicaoNoSistema`
 * (o que o mapa e o campo "Veja no painel" já declaram); nenhum verbete tem desenho escrito à mão.
 *
 * É uma simplificação, e por isso vem no envelope `ModeloDidatico`, com o que o mapa não diz. Componente de servidor. O desenho é
 * `aria-hidden`: o elo, as ligações e os verbetes relacionados estão escritos ao lado. Abaixo de 768 px o desenho dá lugar ao mapa
 * vertical (os mesmos sete elos, de cima para baixo), como na página inicial.
 */

const LARGURA = 1000;
const ALTURA = 680;
/** Meia largura e meia altura do cartão, em unidades do viewBox (as do mapa da página inicial). */
const MW = 100;
const MH = 56;
const FOLGA = 7;
const PONTAS: readonly PontaLigacao[] = ["seta", "seta-aberta", "losango", "quadrado", "circulo"];

function borda(cx: number, cy: number, dx: number, dy: number): [number, number] {
  const tx_ = dx === 0 ? Infinity : (MW + FOLGA) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (MH + FOLGA) / Math.abs(dy);
  const t = Math.min(tx_, ty);
  return [cx + dx * t, cy + dy * t];
}

function caminho(a: { x: number; y: number }, b: { x: number; y: number }): string {
  // ligação entre cartões da mesma linha que não são vizinhos: arco por cima da fileira
  if (a.y === b.y && Math.abs(a.x - b.x) > 300) {
    const x1 = a.x + Math.sign(b.x - a.x) * (MW - 40);
    const x2 = b.x - Math.sign(b.x - a.x) * (MW - 40);
    const y = a.y - MH - FOLGA;
    return `M ${x1} ${y} Q ${(x1 + x2) / 2} ${y - 120} ${x2} ${y}`;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const n = Math.hypot(dx, dy);
  const [x1, y1] = borda(a.x, a.y, dx / n, dy / n);
  const [x2, y2] = borda(b.x, b.y, -dx / n, -dy / n);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function FormaDaPonta({ ponta }: { ponta: PontaLigacao }) {
  if (ponta === "seta") return <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />;
  if (ponta === "seta-aberta") return <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />;
  if (ponta === "losango") return <path d="M 0 5 L 5 0 L 10 5 L 5 10 z" fill="currentColor" />;
  if (ponta === "quadrado") return <rect x="1" y="1" width="8" height="8" fill="currentColor" />;
  return <circle cx="5" cy="5" r="4" fill="currentColor" />;
}

/** A amostra de um tipo de ligação: o traço, a espessura e a ponta do tipo (a associação tem círculo nas duas pontas). */
function Amostra({ tipo }: { tipo: TipoLigacao }) {
  const t = TIPOS_LIGACAO[tipo];
  const dupla = t.ponta === "circulo";
  return (
    <svg width="50" height="14" viewBox="0 0 50 14" aria-hidden="true" focusable="false" className="shrink-0 text-carvao">
      <line x1={dupla ? 8 : 1} y1="7" x2="38" y2="7" stroke="currentColor" strokeWidth={t.espessura} strokeDasharray={t.traco || undefined} strokeLinecap={t.traco && t.ponta === "quadrado" ? "round" : "butt"} />
      {dupla && (
        <svg x="0" y="2" width="10" height="10" viewBox="0 0 10 10">
          <FormaDaPonta ponta="circulo" />
        </svg>
      )}
      <svg x="38" y="1" width="12" height="12" viewBox="0 0 10 10">
        <FormaDaPonta ponta={t.ponta} />
      </svg>
    </svg>
  );
}

/** Marca do elo na lista vertical e na legenda: losango cheio (este verbete), anel (verbete relacionado) ou ponto (os demais). */
function MarcaDoElo({ estado }: { estado: "verbete" | "vizinho" | "outro" }) {
  return (
    <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true" focusable="false" className="shrink-0">
      {estado === "verbete" ? (
        <path d="M0 -8 L8 0 L0 8 L-8 0 Z" fill="var(--cor-energia)" />
      ) : estado === "vizinho" ? (
        <circle r="6" fill="var(--cor-superficie)" stroke="var(--cor-energia)" strokeWidth="2.5" />
      ) : (
        <circle r="3.5" fill="var(--cor-mineral)" />
      )}
    </svg>
  );
}

const pct = (v: number, total: number) => `${((100 * v) / total).toFixed(2)}%`;

function lista(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} ${tx("e", "and")} ${itens[itens.length - 1]}`;
}

export function VerbeteNoSistema({ c }: { c: Conceito }) {
  const idioma = idiomaEnergia();
  const { elos, vizinhos, ligacoes } = posicaoNoSistema(c, (slug) => conceito(slug));
  const porId = new Map(NOS_MAPA.map((n) => [n.id, n]));
  const marcados = new Set<IdNo>(elos.map((e) => e.no));
  const nomeCurto = (slug: string) => {
    const v = conceito(slug);
    return v ? (v.sigla ?? v.nome) : slug;
  };
  const vizinhosDe = (no: IdNo) => vizinhos.filter((v) => v.elos.includes(no)).map((v) => nomeCurto(v.slug));
  const estadoDe = (no: IdNo): "verbete" | "vizinho" | "outro" => (marcados.has(no) ? "verbete" : vizinhosDe(no).length ? "vizinho" : "outro");
  const rotulo = c.sigla ?? c.nome;
  const titulos = elos.map((e) => porId.get(e.no)!.titulo);
  const paineis = Array.from(new Set(elos.flatMap((e) => e.paineis.map((p) => p.rotulo))));

  const atua = elos.length > 0 && elos[0].motivo === "atuacao";
  const bases = Array.from(new Set(elos.map((e) => e.base).filter((b): b is string => !!b)));

  const descricao = atua
    ? tx(
        `As fontes citadas neste verbete (${lista(bases)}) dão a ${rotulo} papel ${titulos.length === 1 ? "no elo" : "nos elos"} ${lista(titulos)}. A marca mostra onde a instituição atua, e não em que página o observatório publica os dados dela.`,
        `The sources cited in this entry (${lista(bases)}) give ${rotulo} a role in the ${titulos.length === 1 ? "node" : "nodes"} ${lista(titulos)}. The mark shows where the institution acts, not on which page the observatory publishes its data.`,
      )
    : elos.length === 0
      ? tx(
          `As páginas que este verbete indica não pertencem a um único elo do mapa. O desenho assinala os elos dos verbetes relacionados: ${lista(Array.from(new Set(vizinhos.flatMap((v) => v.elos))).map((n) => porId.get(n)!.titulo))}.`,
          `The pages this entry points to do not belong to a single node of the map. The drawing flags the nodes of the related entries: ${lista(Array.from(new Set(vizinhos.flatMap((v) => v.elos))).map((n) => porId.get(n)!.titulo))}.`,
        )
      : elos[0].motivo === "mapa"
        ? tx(
            `O mapa do observatório coloca este verbete ${titulos.length === 1 ? "no elo" : "nos elos"} ${lista(titulos)}. As linhas em destaque são as ligações ${titulos.length === 1 ? "desse elo" : "desses elos"} com os outros.`,
            `The observatory map places this entry in the ${titulos.length === 1 ? "node" : "nodes"} ${lista(titulos)}. The highlighted lines are the connections of ${titulos.length === 1 ? "that node" : "those nodes"} with the others.`,
          )
        : tx(
            `${paineis.length === 1 ? "A página que este verbete indica" : "As páginas que este verbete indica"} (${lista(paineis)}) ${paineis.length === 1 ? "fica" : "ficam"} ${titulos.length === 1 ? "no elo" : "nos elos"} ${lista(titulos)}. As linhas em destaque são as ligações ${titulos.length === 1 ? "desse elo" : "desses elos"} com os outros.`,
            `The ${paineis.length === 1 ? "page this entry points to" : "pages this entry points to"} (${lista(paineis)}) ${paineis.length === 1 ? "sits" : "sit"} in the ${titulos.length === 1 ? "node" : "nodes"} ${lista(titulos)}. The highlighted lines are the connections of ${titulos.length === 1 ? "that node" : "those nodes"} with the others.`,
          );

  const deixaDeFora: ListaDeFora = [
    atua
      ? tx(
          "A marca cobre só as atribuições citadas neste verbete. A lei dá à instituição outras, que o desenho não mostra.",
          "The mark covers only the duties cited in this entry. The law gives the institution others, which the drawing does not show.",
        )
      : tx(
      "A marca diz em que elo o observatório mostra o conceito (no mapa da página inicial ou nas páginas que o verbete indica); não diz que o conceito se limita a esse elo.",
      "The mark shows in which node the observatory presents the concept (on the home page map or on the pages the entry points to); it does not say the concept is limited to that node.",
    ),
    tx("Os sete elos são um resumo: o desenho não representa a topologia nem o despacho do SIN.", "The seven nodes are a summary: the drawing does not represent the topology or the dispatch of the SIN."),
    ...O_QUE_O_MAPA_NAO_DIZ,
  ];

  // verbetes relacionados agrupados pelo elo (ou pelos elos) em que aparecem, na ordem do mapa
  const grupos = NOS_MAPA.map((n) => ({ no: n, nomes: vizinhosDe(n.id) })).filter((g) => g.nomes.length > 0);
  const blocoVizinhos = grupos.length > 0 && (
    <div data-vizinhos="">
      <h3 className="rotulo text-mineral">{tx("Verbetes relacionados, por elo", "Related entries, by node")}</h3>
      <ul className="mt-2 space-y-1 text-sm leading-relaxed text-carvao">
        {grupos.map((g) => (
          <li key={g.no.id}>
            <span className="text-carvao-muted">{g.no.titulo}: </span>
            <span className="font-medium">{g.nomes.join(", ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const legendaDeMarcas = (
    <ul className="t-meta flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" data-legenda-marcas="">
      {elos.length > 0 && (
        <li className="inline-flex items-center gap-2">
          <MarcaDoElo estado="verbete" />
          {atua ? tx("elo em que a instituição atua", "node where the institution acts") : tx("elo deste verbete", "node of this entry")}
        </li>
      )}
      {NOS_MAPA.some((n) => estadoDe(n.id) === "vizinho") && (
        <li className="inline-flex items-center gap-2">
          <MarcaDoElo estado="vizinho" />
          {tx("elo de verbete relacionado", "node of a related entry")}
        </li>
      )}
    </ul>
  );

  return (
    <div className="-mx-[clamp(1rem,4vw,2.5rem)] mt-4 [&>section]:border-b-0" data-elemento-visual="verbete-no-sistema" data-elos={elos.map((e) => e.no).join(" ")}>
      <ModeloDidatico
        id="no-sistema"
        idioma={idioma}
        titulo={tx(`${rotulo}: em que parte do sistema elétrico aparece`, `${rotulo}: where it appears in the power system`)}
        descricao={descricao}
        deixaDeFora={deixaDeFora}
      >
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
          <div className="min-w-0">
            {/* o desenho, a partir de 768 px */}
            <div className="hidden md:block" aria-hidden="true" data-mapa="desenho">
              <div className="relative w-full" style={{ aspectRatio: `${LARGURA} / ${ALTURA}` }}>
                <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="absolute inset-0 h-full w-full" focusable="false">
                  <defs>
                    {PONTAS.flatMap((p) =>
                      (["a", "n"] as const).map((v) => (
                        <marker key={`${p}-${v}`} id={`vns-${p}-${v}`} viewBox="0 0 10 10" refX={p === "circulo" ? 5 : 9} refY="5" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15" orient="auto-start-reverse" className={v === "a" ? "text-energia-dark" : "text-mineral"}>
                          <FormaDaPonta ponta={p} />
                        </marker>
                      )),
                    )}
                  </defs>
                  {LIGACOES.map((l) => {
                    const ativa = marcados.has(l.de) || marcados.has(l.para);
                    const t = TIPOS_LIGACAO[l.tipo];
                    const v = ativa ? "a" : "n";
                    return (
                      <path
                        key={`${l.de}-${l.para}`}
                        d={caminho(porId.get(l.de)!.pos, porId.get(l.para)!.pos)}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={t.espessura + (ativa ? 0.8 : 0)}
                        strokeDasharray={t.traco || undefined}
                        strokeLinecap={t.ponta === "quadrado" ? "round" : "butt"}
                        markerEnd={`url(#vns-${t.ponta}-${v})`}
                        markerStart={t.ponta === "circulo" ? `url(#vns-circulo-${v})` : undefined}
                        // fora do destaque o traço continua legível (3:1): o tipo se lê pelo padrão, e o destaque só o escurece e engrossa
                        className={ativa ? "text-energia-dark" : "text-mineral"}
                        data-ligacao={ativa ? "destaque" : "contexto"}
                      />
                    );
                  })}
                </svg>
                {ORDEM_FAIXAS.map((f) => (
                  <span
                    key={f}
                    className="rotulo pointer-events-none absolute whitespace-nowrap text-mineral"
                    style={{ left: pct(ROTULOS_FAIXA[f].x, LARGURA), top: pct(ROTULOS_FAIXA[f].y, ALTURA), transform: ROTULOS_FAIXA[f].alinha === "centro" ? "translateX(-50%)" : undefined }}
                  >
                    {FAIXAS_MAPA[f].rotulo}
                  </span>
                ))}
                {NOS_MAPA.map((n) => {
                  const estado = estadoDe(n.id);
                  const perto = vizinhosDe(n.id);
                  return (
                    <div
                      key={n.id}
                      data-no={n.id}
                      data-estado={estado}
                      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col justify-center px-2.5 py-1.5 ${
                        estado === "verbete" ? "bg-energia text-superficie" : estado === "vizinho" ? "border-2 border-energia bg-superficie text-carvao" : "border border-linha bg-papel text-carvao-muted"
                      }`}
                      style={{ left: pct(n.pos.x, LARGURA), top: pct(n.pos.y, ALTURA), width: pct(2 * MW, LARGURA), minHeight: pct(2 * MH, ALTURA) }}
                    >
                      <span className={`text-sm leading-[1.2] ${estado === "outro" ? "" : "font-medium"}`}>{n.titulo}</span>
                      {estado === "verbete" && <span className="mt-1 text-xs leading-tight">{atua ? tx("atua aqui", "acts here") : tx("este verbete", "this entry")}</span>}
                      {estado === "vizinho" && <span className="mt-1 text-xs leading-tight text-carvao-muted">{tx(plural(perto.length, "relacionado", "relacionados"), `${perto.length} related`)}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 space-y-2">
                {legendaDeMarcas}
                <ul className="t-meta flex flex-wrap gap-x-5 gap-y-1 text-carvao-muted" data-legenda-ligacoes="">
                  {(Object.keys(TIPOS_LIGACAO) as TipoLigacao[]).map((t) => (
                    <li key={t} className="inline-flex items-center gap-2">
                      <Amostra tipo={t} />
                      {TIPOS_LIGACAO[t].rotulo.toLowerCase()}
                    </li>
                  ))}
                </ul>
              </div>
              {blocoVizinhos && <div className="mt-8">{blocoVizinhos}</div>}
            </div>

            {/* o mapa vertical: é o mapa no celular e a versão lida por leitor de tela em qualquer largura */}
            <div className="md:sr-only" data-mapa="vertical">
              <ol className="space-y-0">
                {NOS_MAPA.map((n, i) => {
                  const estado = estadoDe(n.id);
                  const perto = vizinhosDe(n.id);
                  const novaFaixa = i === 0 || NOS_MAPA[i - 1].faixa !== n.faixa;
                  return (
                    <li key={n.id} data-no={n.id} data-estado={estado}>
                      {novaFaixa && <p className={`rotulo text-mineral ${i === 0 ? "" : "mt-4"} mb-1`}>{FAIXAS_MAPA[n.faixa].rotulo}</p>}
                      <div className={`flex items-start gap-3 px-3 py-2 ${estado === "verbete" ? "bg-energia text-superficie" : estado === "vizinho" ? "border-l-2 border-energia bg-superficie" : "border-l-2 border-linha"}`}>
                        <span className="mt-0.5">
                          {estado === "verbete" ? (
                            <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true" focusable="false" className="shrink-0">
                              <path d="M0 -8 L8 0 L0 8 L-8 0 Z" fill="var(--cor-superficie)" />
                            </svg>
                          ) : (
                            <MarcaDoElo estado={estado} />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-sm leading-snug ${estado === "outro" ? "text-carvao-muted" : "font-medium"}`}>{n.titulo}</span>
                          {estado === "verbete" && <span className="block text-sm leading-snug">{atua ? elos.find((e) => e.no === n.id)?.oQueFaz : tx("Este verbete aparece aqui.", "This entry appears here.")}</span>}
                          {perto.length > 0 && (
                            <span className={`block text-sm leading-snug ${estado === "verbete" ? "" : "text-carvao-muted"}`}>
                              {tx(perto.length === 1 ? "Verbete relacionado:" : "Verbetes relacionados:", perto.length === 1 ? "Related entry:" : "Related entries:")} {perto.join(", ")}
                            </span>
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 md:hidden">{legendaDeMarcas}</div>
            </div>
          </div>

          <div className="min-w-0 space-y-6" data-mapa="texto">
            {elos.map((e) => {
              const n = porId.get(e.no)!;
              return (
                <div key={e.no} data-elo={e.no}>
                  <h3 className="rotulo text-mineral">{FAIXAS_MAPA[n.faixa].rotulo}</h3>
                  <p className="mt-1 font-serif text-xl leading-snug text-carvao">{n.titulo}</p>
                  {e.oQueFaz ? (
                    <>
                      <p className="mt-1 text-sm leading-relaxed text-carvao" data-papel="">
                        {e.oQueFaz}
                      </p>
                      <p className="t-meta mt-1 text-carvao-muted">{e.base}</p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{n.curto}</p>
                  )}
                </div>
              );
            })}
            {ligacoes.length > 0 && (
              <div data-ligacoes="">
                <h3 className="rotulo text-mineral">{tx(elos.length === 1 ? "Como esse elo se liga aos outros" : "Como esses elos se ligam aos outros", elos.length === 1 ? "How that node connects to the others" : "How those nodes connect to the others")}</h3>
                <ul className="mt-2">
                  {ligacoes.map((l) => (
                    <li key={`${l.de}-${l.para}`} className="border-t border-linha py-2.5 text-sm leading-relaxed text-carvao" data-tipo={l.tipo}>
                      <span className="flex items-start gap-x-3">
                        <span className="mt-1">
                          <Amostra tipo={l.tipo} />
                        </span>
                        <span className="min-w-0 font-medium">
                          {porId.get(l.de)!.titulo} {l.tipo === "associacao" ? "↔" : "→"} {porId.get(l.para)!.titulo}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-carvao-muted">
                        {TIPOS_LIGACAO[l.tipo].rotulo}. {l.texto}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </ModeloDidatico>
    </div>
  );
}
