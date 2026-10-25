"use client";

import { Cadeado } from "./SeloComConta";
import { aoEntrarComRecorteEm, hrefEntrar, textosAcesso, useSessao } from "./sessao";

/**
 * Fecho de toda página aperitivo (princípio do aperitivo, decisão do dono de 20/10/2026): diz o que o
 * painel completo mostra a quem tem conta e leva ao login com a volta para o mesmo endereço. A página
 * aperitivo é servida no endereço público do tema a quem não tem sessão (src/middleware.ts); quem tem
 * conta recebe ali o painel completo. Por isso o convite recebe a `rota` pública explicitamente: o
 * caminho interno da versão aperitivo nunca aparece em link.
 *
 * O href do HTML vale sem JavaScript (a rota pública); no clique, a volta leva também o recorte escolhido na
 * página (?territorio= da Minha capital, ?uf= do Gás e dos Combustíveis), lido da janela (`aoEntrarComRecorteEm`).
 *
 * A lista ocupa duas colunas em tela larga, na ordem das seções (de cima para baixo), para não deixar meia
 * página vazia ao lado de uma coluna estreita; a ação é um botão de contorno, com resposta ao toque.
 */
export function ConviteAperitivo({ rota, comConta, className = "", idTitulo = "convite-aperitivo-titulo" }: { rota: string; comConta: readonly string[]; className?: string; idTitulo?: string }) {
  const en = rota === "/en" || rota.startsWith("/en/");
  const t = textosAcesso(rota);
  // páginas abertas que já são o aperitivo (Combustíveis, Crédito) chegam também a quem tem conta: para ele, o painel direto
  const logado = useSessao() === true;
  return (
    <section data-convite-aperitivo="" aria-labelledby={idTitulo} className={`border-t border-linha pb-6 pt-8 ${className}`}>
      <h2 id={idTitulo} className="font-serif text-xl text-carvao sm:text-2xl">
        {logado ? (en ? "In the full panel" : "No painel completo") : en ? "The full panel, with a free account" : "O painel completo, com a conta gratuita"}
      </h2>
      <ul className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao lg:max-w-none lg:columns-2 lg:gap-x-12">
        {comConta.map((item) => (
          <li key={item} className="mb-2 flex break-inside-avoid items-baseline gap-2">
            <span className="text-mineral">
              <Cadeado />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6">
        <a
          href={logado ? rota : hrefEntrar(rota)}
          onClick={logado ? undefined : aoEntrarComRecorteEm(rota)}
          className="inline-flex min-h-[44px] items-center border border-carvao px-5 text-sm font-medium text-carvao transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:active:scale-[0.97] [@media(hover:hover)]:hover:bg-carvao [@media(hover:hover)]:hover:text-papel"
        >
          {logado ? (en ? "Open the full panel" : "Abrir o painel completo") : t.entrar}
        </a>
      </p>
    </section>
  );
}
