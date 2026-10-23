import Link from "next/link";
import type { ReactNode } from "react";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import type { Dominio } from "@/lib/dominios";
import type { ColecaoEntrada } from "@/lib/observatorios/colecoes";

export type { ColecaoEntrada } from "@/lib/observatorios/colecoes";

/** Painéis à vista em cada coleção; os demais ficam em "Mais painéis", no HTML. */
const VISIVEIS = 8;

function ListaPaineis({ paineis }: Readonly<{ paineis: ColecaoEntrada["paineis"] }>) {
  return (
    // no celular, duas colunas (a origem desce para baixo do nome); de 640 px em diante, uma lista por coleção, com a origem à direita
    <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-1">
      {paineis.map((p) => (
        <li key={p.href} className="min-w-0">
          <Link href={p.href} prefetch={false} className="group flex min-h-[44px] flex-col justify-center gap-0.5 border-t border-linha py-2 text-sm text-carvao sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <span className="group-hover:underline">{p.titulo}</span>
            {p.origem && <span className="shrink-0 text-xs text-mineral">{p.origem}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Entrada com conta de um observatório que reúne várias coleções: o molde único EntradaColecao com `tipo="observatorio"`
 * (Iniciativa 4 do parecer de UX de 21/10/2026). Pergunta e escala na primeira tela, as perguntas do leitor sobre o próprio caso
 * ("Para você"), as coleções a um clique, um modelo didático do mecanismo, caminhos por pergunta e método recolhido no fim.
 */
export function EntradaObservatorio({
  rota, acento, pergunta, descricao, escala, paraVoce = null, colecoes, artefato, caminhos, metodo, frescor = null, frescorMetodo = null, parceria = null,
}: Readonly<{
  /** Endereço da entrada (/observatorios/<id>): o rótulo de contexto lê o observatório por ele. */
  rota: string;
  acento: Dominio["acento"];
  pergunta: string;
  descricao: string;
  escala: NumeroPorta[];
  /** Bloco "Para você" (ParaVoce), logo depois dos números de abertura. */
  paraVoce?: ReactNode;
  colecoes: ColecaoEntrada[];
  /** Um ModeloDidatico. */
  artefato: ReactNode;
  caminhos: { pergunta: string; resumo: string; href: string; colecao: string }[];
  metodo: ReactNode;
  /** Faixa de frescor da primeira tela (FaixaFrescor, variante "linha"). */
  frescor?: ReactNode;
  /** Frescor por fonte no rodapé de método (FaixaFrescor, variante "metodo"). */
  frescorMetodo?: ReactNode;
  /** Crédito de parceria técnica (ParceriaTecnica compacta), à direita do rótulo. */
  parceria?: ReactNode;
}>) {
  return (
    <EntradaColecao
      tipo="observatorio"
      rota={rota}
      acento={acento}
      titulo={pergunta}
      frase={descricao}
      aoLadoDoRotulo={parceria}
      frescor={frescor}
      escala={escala}
      paraVoce={paraVoce}
      destinos={<ColecoesDoObservatorio colecoes={colecoes} />}
      artefato={artefato}
      caminhos={caminhos.map((c) => ({ pergunta: c.pergunta, resumo: c.resumo, href: c.href, rotulo: c.colecao }))}
      metodo={metodo}
      frescorMetodo={frescorMetodo}
    />
  );
}

/** Fatia "Destinos" de uma entrada de observatório: as coleções, cada uma com os seus painéis. */
function ColecoesDoObservatorio({ colecoes }: Readonly<{ colecoes: ColecaoEntrada[] }>) {
  return (
    <section aria-labelledby="colecoes-titulo" className="mx-auto max-w-page px-6 py-10 md:py-16">
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <h2 id="colecoes-titulo" className="font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">As coleções</h2>
          <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
            Os painéis do observatório, agrupados pelo que cada um responde. Os marcados com a origem são mantidos por
            outro observatório e aparecem aqui como atalho.
          </p>
        </div>
        <div className="grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:col-span-8">
          {colecoes.map((c, i) => (
            <section
              key={c.id}
              aria-labelledby={`colecao-${c.id}`}
              className={`bg-papel p-5 ${i === colecoes.length - 1 && colecoes.length % 2 === 1 ? "sm:col-span-2" : ""}`}
            >
              <h3 id={`colecao-${c.id}`} className="font-serif text-xl leading-snug text-carvao">
                <Link href={c.href} prefetch={false} className="hover:underline">{c.nome}</Link>
              </h3>
              <ListaPaineis paineis={c.paineis.slice(0, VISIVEIS)} />
              {c.paineis.length > VISIVEIS && (
                <details className="group/mais">
                  <summary className="flex min-h-[44px] cursor-pointer items-center border-t border-linha text-sm text-carvao-muted hover:text-carvao">
                    <span className="group-open/mais:hidden">Mais {c.paineis.length - VISIVEIS} painéis</span>
                    <span className="hidden group-open/mais:inline">Menos painéis</span>
                  </summary>
                  <ListaPaineis paineis={c.paineis.slice(VISIVEIS)} />
                </details>
              )}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
