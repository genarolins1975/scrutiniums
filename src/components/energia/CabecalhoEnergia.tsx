import Link from "@/components/i18n/LinkIdioma";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { DetalhesFechaveis } from "@/components/layout/DetalhesFechaveis";
import { AtivoVisivel } from "@/components/energia/AtivoVisivel";
import { RetornoContexto } from "@/components/energia/RetornoContexto";
import { rotulosRetorno } from "@/lib/energia/conteudo/rotulos-retorno";
import { listaPorExtenso, menuNavegacao, type DestinoNavegacao, type ItemMenu } from "@/lib/energia/navegacao";
import { tx } from "@/lib/energia/idioma";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";
import { prefetchDoLink } from "@/lib/rotasPublicas";

/**
 * Cabeçalho do Observatório Brasileiro do Setor Elétrico: a barra comum da plataforma (CabecalhoPlataforma: marca, seletor de
 * observatório, as abas dos seis observatórios, idioma e conta) e, abaixo dela, a navegação do observatório em seis grupos
 * (seção 5.1), com os atalhos de dados e método à direita. Estático (sem leitura de sessão no servidor): a conta é resolvida no
 * cliente. O nome do observatório inteiro mora no seletor e no título da aba, e não numa linha própria em serifa.
 *
 * A navegação tem três peças, todas renderizadas no servidor:
 *
 *  - em tela larga (xl), uma linha com os seis grupos; cada grupo é um disclosure (<details> fechável: abre por clique, toque ou
 *    teclado, Esc fecha e devolve o foco ao grupo, fecha quando o foco sai) com os destinos e a pergunta que cada um responde;
 *  - abaixo disso, um botão "Menu" com todos os destinos publicados em seções, e ao lado, em texto, onde o leitor está (grupo e
 *    página). No celular o menu é o único caminho: o destino está a um toque, e a primeira tela fica para a pergunta e a medida;
 *  - de 768 px em diante, sob os grupos, a faixa com as páginas do grupo ativo (AtivoVisivel traz a atual para a vista).
 *
 * Destino sem página (publicado: false) nunca vira link: aparece como texto "em preparação" no grupo, para o tema social não sumir
 * do menu nem prometer uma página que não existe. O destino atual leva aria-current="page".
 *
 * Quem chega de um verbete ou de uma trilha do Aprenda (?volta=) ganha o botão fixo de volta ao contexto (RetornoContexto), que só
 * existe no cliente.
 */
export function CabecalhoEnergia({ atual }: { atual: string }) {
  const { itens, grupoAtual } = menuNavegacao(atual);
  const paginaAtual = grupoAtual?.links.find((d) => d.slug === atual) ?? null;
  return (
    <header className="obs-identidade border-b border-linha bg-superficie">
      <CabecalhoPlataforma colecao="energia" destinoConta="/setor-eletrico" complementos={<SeletorIdiomaPublico idioma={tx("pt", "en")} />} />
      <nav aria-label={tx("Navegação do Observatório do Setor Elétrico", "Setor Elétrico observatory navigation")}>
        <div className="ed-pagina relative">
          {/* tela larga: os seis grupos numa linha */}
          <ul className="hidden flex-wrap gap-x-1 xl:flex">
            {itens.map((item, i) => (
              <li key={item.grupo.id}>
                <DetalhesFechaveis className="group relative">
                  <summary
                    className={`flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm [&::-webkit-details-marker]:hidden ${
                      item.ativo ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"
                    }`}
                  >
                    {item.grupo.rotulo}
                    {item.ativo && <span className="sr-only">{tx(" (grupo da página atual)", " (group of the current page)")}</span>}
                    <span aria-hidden="true" className="text-xs motion-safe:transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>
                  {/* os dois últimos grupos abrem para a esquerda, para o painel não sair da tela */}
                  <div
                    className={`absolute top-full z-40 mt-px hidden w-[24rem] border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block ${
                      i >= itens.length - 2 ? "right-0" : "left-0"
                    }`}
                  >
                    <p className="px-3 pb-2 pt-1 text-sm leading-snug text-carvao-muted">{item.grupo.resumo}</p>
                    {item.links.length > 0 && (
                      <ul aria-label={item.grupo.rotulo}>
                        {item.links.map((d) => (
                          <li key={d.slug}>
                            <ItemDestino d={d} atual={atual} comPergunta />
                          </li>
                        ))}
                      </ul>
                    )}
                    <EmPreparacao item={item} />
                  </div>
                </DetalhesFechaveis>
              </li>
            ))}
          </ul>
          {/* celular, tablet e desktop estreito: um botão com todos os destinos em seções, e onde o leitor está */}
          <div className="flex min-h-[44px] items-center gap-3 xl:hidden">
            <DetalhesFechaveis className="group shrink-0">
              <summary className="flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap pr-1 text-sm font-medium text-carvao hover:text-energia-dark [&::-webkit-details-marker]:hidden">
                {tx("Menu", "Menu")}
                <span aria-hidden="true" className="text-xs motion-safe:transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="absolute inset-x-0 top-full z-40 mt-px hidden border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block">
                <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                  {itens.map((item) => {
                    const idRotulo = `menu-energia-${item.grupo.id}`; // i18n: dado
                    return (
                      <div key={item.grupo.id} className="pb-2">
                        <p id={idRotulo} className="rotulo px-3 pb-1 pt-3 text-mineral">
                          {item.grupo.rotulo}
                        </p>
                        {item.links.length > 0 && (
                          <ul aria-labelledby={idRotulo}>
                            {item.links.map((d) => (
                              <li key={d.slug}>
                                <ItemDestino d={d} atual={atual} />
                              </li>
                            ))}
                          </ul>
                        )}
                        <EmPreparacao item={item} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </DetalhesFechaveis>
            {grupoAtual && (
              <p className="min-w-0 text-sm leading-tight text-carvao-muted" data-onde-estou="">
                <span className="sr-only">{tx("Você está em: ", "You are in: ")}</span>
                {grupoAtual.grupo.rotulo}
                {paginaAtual && <span className="text-carvao"> · {paginaAtual.rotulo}</span>}
              </p>
            )}
          </div>
        </div>
      </nav>
      {/* de 768 px em diante: a faixa com as páginas do grupo atual e, à direita, os atalhos de dados e método */}
      <div className="hidden border-t border-linha bg-energia-fundo md:block">
        <div className="ed-pagina flex items-center gap-6">
          {grupoAtual && (
            <ul id="modulos-energia" aria-label={tx(`Páginas do grupo ${grupoAtual.grupo.rotulo}`, `Pages in the ${grupoAtual.grupo.rotulo} group`)} className="tabela-scroll relative flex min-w-0 flex-1 gap-1">
              {grupoAtual.links.map((d) => {
                const ativo = d.slug === atual;
                return (
                  <li key={d.slug} className="shrink-0">
                    <Link
                      href={d.href}
                      prefetch={false}
                      aria-current={ativo ? "page" : undefined}
                      className={`inline-flex min-h-[40px] min-w-[44px] items-center justify-center gap-1 whitespace-nowrap border-b-2 px-3 text-sm ${
                        ativo ? "border-energia text-carvao" : "border-transparent text-carvao-muted hover:text-carvao"
                      }`}
                    >
                      {d.rotulo}
                      <MarcaIntegracao d={d} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-5">
            <Atalhos atual={atual} />
          </div>
        </div>
      </div>
      <AtivoVisivel alvo="modulos-energia" />
      <RetornoContexto rotulos={rotulosRetorno()} />
    </header>
  );
}

/** Atalhos de dados e método, à direita da faixa do grupo (de 768 px em diante; no celular estão no Menu). */
function Atalhos({ atual }: { atual: string }) {
  return (
    <>
      <Link
        href="/setor-eletrico/dados"
        prefetch={prefetchDoLink("/setor-eletrico/dados")}
        aria-current={atual === "dados" ? "page" : undefined}
        className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao-muted hover:text-energia-dark"
      >
        {tx("Dados e fontes", "Data and sources")}
      </Link>
      <Link
        href="/setor-eletrico/metodologia"
        prefetch={prefetchDoLink("/setor-eletrico/metodologia")}
        aria-current={atual === "metodologia" ? "page" : undefined}
        className="rotulo inline-flex min-h-[44px] items-center whitespace-nowrap text-carvao-muted hover:text-energia-dark"
      >
        {tx("Metodologia", "Methodology")}
      </Link>
    </>
  );
}

/** Link de um destino dentro de um painel aberto (grupo ou Menu). */
function ItemDestino({ d, atual, comPergunta = false }: { d: DestinoNavegacao; atual: string; comPergunta?: boolean }) {
  const ativo = d.slug === atual;
  return (
    <Link
      href={d.href}
      prefetch={prefetchDoLink(d.href)}
      aria-current={ativo ? "page" : undefined}
      className={`flex min-h-[44px] flex-col justify-center px-3 py-2 ${ativo ? "bg-energia-fundo" : "hover:bg-papel"}`}
    >
      <span className="flex items-center gap-1.5 text-sm text-carvao">
        {ativo && <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 bg-energia" />}
        {d.rotulo}
        <MarcaIntegracao d={d} />
      </span>
      {comPergunta && <span className="mt-0.5 text-[0.8rem] leading-snug text-carvao-muted">{d.pergunta}</span>}
    </Link>
  );
}

/** Módulo publicado que ainda não mostra números: marca discreta, com texto para leitor de tela. */
function MarcaIntegracao({ d }: { d: DestinoNavegacao }) {
  if (d.integrado) return null;
  return (
    <span className="text-xs tracking-normal text-carvao-muted" title={tx("Módulo em integração: escopo e fontes catalogadas, sem números publicados", "Module in integration: scope and sources cataloged, no figures published yet")}>
      <span aria-hidden="true">○</span>
      <span className="sr-only">{tx("(em integração)", "(in integration)")}</span>
    </span>
  );
}

/** Destinos do grupo que ainda não têm página: nomeados, nunca linkados. */
function EmPreparacao({ item }: { item: ItemMenu }) {
  if (!item.emPreparacao.length) return null;
  return (
    <p className="px-3 py-2 text-xs leading-snug text-mineral">
      {tx("Em preparação, ainda sem página: ", "In preparation, no page yet: ")}
      {listaPorExtenso(item.emPreparacao.map((d) => d.rotulo))}.
    </p>
  );
}
