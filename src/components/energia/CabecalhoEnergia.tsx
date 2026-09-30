import Link from "next/link";
import { LogoMark } from "@/components/ui/Logo";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";
import { DetalhesFechaveis } from "@/components/layout/DetalhesFechaveis";
import { AcessoConta } from "@/components/energia/AcessoConta";
import { AtivoVisivel } from "@/components/energia/AtivoVisivel";
import { listaPorExtenso, menuNavegacao, type DestinoNavegacao, type ItemMenu } from "@/lib/energia/navegacao";

/**
 * Cabeçalho do Observatório Brasileiro do Setor Elétrico: marca Scrutiniums
 * acima do observatório, switcher de domínio e navegação em seis grupos
 * (seção 5.1). Estático (sem leitura de sessão no servidor): a conta é
 * resolvida no cliente.
 *
 * A navegação tem três peças, todas renderizadas no servidor:
 *
 *  - em tela larga (xl), uma linha com os seis grupos; cada grupo é um
 *    disclosure (<details> fechável: abre por clique, toque ou teclado, Esc
 *    fecha e devolve o foco ao grupo, fecha quando o foco sai) com os destinos
 *    e a pergunta que cada um responde. Com os rótulos completos, os seis grupos
 *    só cabem numa linha a partir de 1280 px;
 *  - abaixo disso, um botão "Menu" com todos os destinos publicados em seções;
 *  - sempre, sob o grupo ativo, a faixa com os destinos desse grupo. Ela rola
 *    na horizontal no celular, e AtivoVisivel traz o destino atual para a vista.
 *
 * Destino sem página (publicado: false) nunca vira link: aparece como texto
 * "em preparação" no grupo, para o tema social não sumir do menu nem prometer
 * uma página que não existe. O destino atual leva aria-current="page".
 */
export function CabecalhoEnergia({ atual }: { atual: string }) {
  const { itens, grupoAtual } = menuNavegacao(atual);
  return (
    <header className="border-b border-linha bg-superficie">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 pt-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" aria-label="Scrutiniums: página inicial" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2.5 sm:justify-start">
            <LogoMark size={20} />
            <span className="hidden font-serif text-base uppercase tracking-wide2 text-carvao sm:inline">Scrutiniums</span>
          </Link>
          <span aria-hidden="true" className="h-5 w-px bg-linha" />
          <SwitcherObservatorio atual="energia" />
        </div>
        <div className="flex items-center gap-5">
          <Link
            href="/setor-eletrico/metodologia"
            aria-current={atual === "metodologia" ? "page" : undefined}
            className="rotulo hidden min-h-[44px] items-center text-carvao-muted hover:text-energia-dark md:inline-flex"
          >
            Metodologia
          </Link>
          <AcessoConta destino="/setor-eletrico" />
        </div>
      </div>
      <div className="mx-auto max-w-page px-6 pb-1 pt-2">
        <p className="font-serif text-lg leading-snug text-carvao md:text-xl">
          <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 bg-energia align-middle" />
          Observatório Brasileiro do Setor Elétrico
        </p>
      </div>
      <nav aria-label="Navegação do Observatório do Setor Elétrico" className="relative mx-auto max-w-page">
        {/* tela larga: os seis grupos numa linha */}
        <ul className="hidden flex-wrap gap-0.5 px-5 xl:flex">
          {itens.map((item, i) => (
            <li key={item.grupo.id}>
              <DetalhesFechaveis className="group relative">
                <summary
                  className={`rotulo flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap px-3 [&::-webkit-details-marker]:hidden ${
                    item.ativo ? "bg-energia-fundo text-carvao" : "text-carvao-muted hover:text-carvao"
                  }`}
                >
                  {item.grupo.rotulo}
                  {item.ativo && <span className="sr-only"> (grupo da página atual)</span>}
                  <span aria-hidden="true" className="text-[0.7em] motion-safe:transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                {/* os dois últimos grupos abrem para a esquerda, para o painel não sair da tela */}
                <div
                  className={`absolute top-full z-40 mt-1 hidden w-[24rem] border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block ${
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
        <div className={`flex items-stretch px-4 md:px-5 ${grupoAtual ? "xl:bg-energia-fundo" : ""}`}>
          {/* celular, tablet e desktop estreito: um botão com todos os destinos em seções */}
          <DetalhesFechaveis className="group shrink-0 xl:hidden">
            <summary className="rotulo flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center gap-1.5 whitespace-nowrap pl-1 pr-3 text-carvao hover:text-energia-dark [&::-webkit-details-marker]:hidden">
              Menu
              <span aria-hidden="true" className="text-[0.7em] motion-safe:transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="absolute inset-x-4 top-full z-40 mt-1 hidden border border-linha bg-superficie p-2 shadow-[0_8px_24px_rgba(26,29,33,0.12)] group-open:block md:inset-x-5">
              <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                {itens.map((item) => {
                  const idRotulo = `menu-energia-${item.grupo.id}`;
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
            <>
              <span aria-hidden="true" className="my-3 w-px shrink-0 bg-linha xl:hidden" />
              <ul
                id="modulos-energia"
                aria-label={`Páginas do grupo ${grupoAtual.grupo.rotulo}`}
                className="tabela-scroll relative flex min-w-0 flex-1 gap-0.5 pl-1"
              >
                {grupoAtual.links.map((d) => {
                  const ativo = d.slug === atual;
                  return (
                    <li key={d.slug} className="shrink-0">
                      <Link
                        href={d.href}
                        aria-current={ativo ? "page" : undefined}
                        className={`rotulo inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 whitespace-nowrap border-b-2 px-2 ${
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
            </>
          )}
        </div>
      </nav>
      <AtivoVisivel alvo="modulos-energia" />
    </header>
  );
}

/** Link de um destino dentro de um painel aberto (grupo ou Menu). */
function ItemDestino({ d, atual, comPergunta = false }: { d: DestinoNavegacao; atual: string; comPergunta?: boolean }) {
  const ativo = d.slug === atual;
  return (
    <Link
      href={d.href}
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
    <span className="text-[0.62rem] tracking-normal text-carvao-muted" title="Módulo em integração: escopo e fontes catalogadas, sem números publicados">
      <span aria-hidden="true">○</span>
      <span className="sr-only">(em integração)</span>
    </span>
  );
}

/** Destinos do grupo que ainda não têm página: nomeados, nunca linkados. */
function EmPreparacao({ item }: { item: ItemMenu }) {
  if (!item.emPreparacao.length) return null;
  return (
    <p className="px-3 py-2 text-xs leading-snug text-mineral">
      Em preparação, ainda sem página: {listaPorExtenso(item.emPreparacao.map((d) => d.rotulo))}.
    </p>
  );
}
