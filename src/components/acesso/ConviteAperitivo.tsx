"use client";

import { Cadeado } from "./SeloComConta";
import { hrefEntrar, textosAcesso, useSessao } from "./sessao";

/**
 * Fecho de toda página aperitivo (princípio do aperitivo, decisão do dono de 20/10/2026): diz o que o
 * painel completo mostra a quem tem conta e leva ao login com a volta para o mesmo endereço. A página
 * aperitivo é servida no endereço público do tema a quem não tem sessão (src/middleware.ts); quem tem
 * conta recebe ali o painel completo. Por isso o convite recebe a `rota` pública explicitamente: o
 * caminho interno da versão aperitivo nunca aparece em link.
 */
export function ConviteAperitivo({ rota, comConta, className = "" }: { rota: string; comConta: readonly string[]; className?: string }) {
  const en = rota === "/en" || rota.startsWith("/en/");
  const t = textosAcesso(rota);
  // páginas abertas que já são o aperitivo (Combustíveis, Crédito) chegam também a quem tem conta: para ele, o painel direto
  const logado = useSessao() === true;
  return (
    <section data-convite-aperitivo="" aria-labelledby="convite-aperitivo-titulo" className={`border-t border-linha py-6 ${className}`}>
      <h2 id="convite-aperitivo-titulo" className="font-serif text-xl text-carvao">
        {logado ? (en ? "In the full panel" : "No painel completo") : en ? "The full panel, with a free account" : "O painel completo, com a conta gratuita"}
      </h2>
      <ul className="mt-3 max-w-prose2 space-y-1.5 text-sm leading-relaxed text-carvao">
        {comConta.map((item) => (
          <li key={item} className="flex items-baseline gap-2">
            <span className="text-mineral">
              <Cadeado />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4">
        <a href={logado ? rota : hrefEntrar(rota)} className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
          {logado ? (en ? "Open the full panel" : "Abrir o painel completo") : t.entrar}
        </a>
      </p>
    </section>
  );
}
