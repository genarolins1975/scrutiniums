import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";

/**
 * Barra superior comum da Scrutiniums (achado A7 da banca de 19/10/2026: eram cinco cabeçalhos diferentes). Duas linhas:
 *
 *  1. a marca, o seletor de observatório (quando há) e, à direita, a busca da plataforma (BuscaPlataforma) e a conta;
 *  2. as abas dos seis observatórios, na ordem e com os rótulos do registro (src/lib/observatorios/lista.ts), e o que a página
 *     acrescenta à direita (o seletor de idioma onde há tradução).
 *
 * O estilo mora em public/observatorios.css (classes bp-*), que a SPA do Crédito também carrega: a barra da SPA
 * (public/obs/index.html, gerada por src/lib/observatorios/barraSpa.ts) sai com a mesma marca, a mesma ordem e os mesmos
 * rótulos. Abaixo da barra, cada observatório mantém a sua navegação de módulo.
 *
 * Dois usos: CabecalhoPlataforma (observatórios e painéis, com conta) e PublicHeaderView (camada aberta: home, perguntas,
 * imprensa e institucionais), que muda só os destinos das abas e os botões de acesso.
 */
export function BarraPlataforma({
  marca,
  seletor,
  busca,
  acoes,
  abas,
}: {
  marca: { href: string; rotulo: string; nomeNoCelular?: boolean };
  /** Seletor ao lado da marca (coleção corrente ▾); com ele, no celular, o nome escrito dá lugar ao monograma. */
  seletor?: ReactNode;
  /** Linha da marca, à esquerda da conta: o campo da busca da plataforma (no celular, a lupa que abre a busca em tela cheia). */
  busca?: ReactNode;
  /** Linha da marca, à direita: conta e acesso. */
  acoes: ReactNode;
  /** Segunda linha: as abas dos observatórios e o que vem à direita delas. */
  abas: ReactNode;
}) {
  return (
    <div className="bp" data-barra-plataforma="">
      <div className="bp-linha">
        <MarcaScrutiniums href={marca.href} rotulo={marca.rotulo} compacta={!marca.nomeNoCelular} />
        {seletor && (
          <>
            <span aria-hidden="true" className="bp-divisor" />
            {seletor}
          </>
        )}
        {busca}
        <div className="bp-acoes">{acoes}</div>
      </div>
      <div className="bp-abas">{abas}</div>
    </div>
  );
}

/**
 * Marca da plataforma: o monograma e "Scrutiniums" em serifa, caixa alta espaçada, igual em todas as páginas. `compacta`:
 * abaixo de 640 px fica só o monograma, com o alvo de toque de 44 px, para caber o seletor de observatório na mesma linha.
 */
export function MarcaScrutiniums({ href, rotulo, compacta = true }: { href: string; rotulo: string; compacta?: boolean }) {
  return (
    <Link href={href} aria-label={rotulo} className={compacta ? "bp-marca bp-marca--compacta" : "bp-marca"}>
      <LogoMark size={20} />
      {/* // i18n: dado (marca, igual nos dois idiomas) */}
      <span className="bp-marca-nome">Scrutiniums</span>
    </Link>
  );
}
