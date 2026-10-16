import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { COR_CATEGORIA_LEILAO, CURTO_CATEGORIA, logoDoGrupo, mwmed, type EntradaLogo, type FraseCitavel } from "@/lib/energia/leiloes";
import { num } from "@/lib/energia/formato";
import type { LeiloesGold } from "@/lib/energia/tipos-leiloes";

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function LeiloesIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="leiloes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Leilões indisponíveis nesta publicação"
          motivo={
            motivo ??
            "A gold do módulo Leilões (public/energia/gold/leiloes.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
          }
        />
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ diagrama do ACR */

type Caminho = { id: string; titulo: string; traco: string; passos: [string, string][]; nota: string };

const CAMINHOS: Caminho[] = [
  {
    id: "contrato",
    titulo: "Caminho do contrato",
    traco: "solid",
    passos: [
      ["Vendedor", "a usina vencedora assina um contrato com cada distribuidora compradora (CCEAR)"],
      ["Distribuidoras", "cada uma recebe uma fatia proporcional à demanda que declarou para aquele leilão"],
      ["CCEE", "registra os contratos e contabiliza o que foi contratado e o que foi medido"],
    ],
    nota: "Na energia de reserva o contrato é com a CCEE, não com a distribuidora (Decreto nº 6.353/2008).",
  },
  {
    id: "dinheiro",
    titulo: "Caminho do dinheiro",
    traco: "dashed",
    passos: [
      ["Consumidor cativo", "paga a conta de luz; a parcela de energia da tarifa (TE) cobre as compras da distribuidora"],
      ["Distribuidora", "paga a cada vendedor o preço do contrato, atualizado conforme o contrato"],
      ["Mercado de curto prazo", "diferenças entre o contratado e o medido são liquidadas ao PLD na CCEE"],
    ],
    nota: "Na energia de reserva, o custo é rateado entre os consumidores por encargo, inclusive os do mercado livre.",
  },
  {
    id: "fisico",
    titulo: "Caminho físico",
    traco: "dotted",
    passos: [
      ["Usina", "gera quando o ONS despacha, não quando o contrato manda"],
      ["Rede", "a energia de todas as usinas se mistura na rede interligada"],
      ["Consumo", "a energia que chega à casa não é a da usina com que a distribuidora contratou"],
    ],
    nota: "Contrato é obrigação financeira de entregar uma quantidade; a operação física segue o despacho centralizado.",
  },
];

const PAPEIS: [string, string][] = [
  ["MME", "define as diretrizes de cada leilão em portaria e fixa a garantia física das usinas"],
  ["EPE", "habilita tecnicamente os projetos e calcula a garantia física"],
  ["ANEEL", "aprova o edital e promove o leilão, diretamente ou por meio da CCEE (Lei nº 10.848/2004)"],
  ["Distribuidoras", "declaram quanto precisam comprar para atender o próprio mercado"],
  ["Vendedores", "disputam o preço; quem vence assina os contratos"],
];

export function DiagramaAcr() {
  return (
    <div className="space-y-6" data-diagrama="acr">
      <ol className="grid gap-2 sm:grid-cols-5" aria-label="Quem faz o quê num leilão do ACR, em ordem">
        {PAPEIS.map(([quem, faz], i) => (
          <li key={quem} className="relative border-t-2 border-carvao bg-superficie px-3 py-2">
            <span className="rotulo text-mineral">{i + 1}</span>
            <p className="font-medium text-carvao">{quem}</p>
            <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{faz}</p>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 md:grid-cols-3">
        {CAMINHOS.map((c) => (
          <section key={c.id} aria-labelledby={`caminho-${c.id}`} className="space-y-2">
            <h4 id={`caminho-${c.id}`} className="font-serif text-base text-carvao">
              {c.titulo}
            </h4>
            <ol className="space-y-0">
              {c.passos.map(([quem, o], i) => (
                <li key={quem} className="pl-3" style={{ borderLeft: `3px ${c.traco} var(--cor-energia-dark)` }}>
                  <p className="pt-1 text-sm font-medium text-carvao">{quem}</p>
                  <p className="pb-2 text-xs leading-relaxed text-carvao-muted">{o}</p>
                  {i < c.passos.length - 1 && (
                    <span aria-hidden="true" className="-ml-[1.1rem] block text-xs text-energia-dark">
                      ▼
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <p className="text-xs leading-relaxed text-carvao-muted">{c.nota}</p>
          </section>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-carvao-muted">
        Traço contínuo: contrato. Tracejado: pagamento. Pontilhado: fluxo físico. Os três caminhos são diferentes: a usina pode vender num leilão,
        ser despachada em outra hora e receber pelo contrato mesmo sem gerar, acertando a diferença no mercado de curto prazo.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ quem venceu */

export function GruposControle({ g, logos, dataSiga }: { g: NonNullable<LeiloesGold["grupos_controle"]>; logos: readonly EntradaLogo[]; dataSiga: string }) {
  const total = g.energia_vinculada_mwmed + g.sem_vinculo.reduce((s, x) => s + x.energia_mwmed, 0);
  const maior = Math.max(...g.maiores.map((x) => x.energia_mwmed), 1);
  const comLogo = g.maiores.map((x) => logoDoGrupo(logos, x));
  const algumLogo = comLogo.some(Boolean);
  return (
    <div className="space-y-4">
      <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
        <span className="font-medium">Grupo que controla a usina no cadastro de {dataSiga}</span>, não a vencedora na data do leilão: a usina
        pode ter mudado de dono, e a vencedora publicada pode ser um cotista do consórcio. Logotipo só quando o grupo, ou uma holding na cadeia de
        controle dele, é uma companhia com logotipo oficial no acervo do observatório.
      </p>
      <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Energia contratada por grupo que controla a usina (tabela rolável)">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">Energia contratada nos leilões do ACR por grupo que controla a usina, cadastro de {dataSiga}</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-linha px-2 py-1.5 text-left text-xs font-medium text-mineral">
                Grupo que controla em {dataSiga}
              </th>
              <th scope="col" className="border-b border-linha px-2 py-1.5 text-right text-xs font-medium text-mineral">
                Contratos
              </th>
              <th scope="col" className="border-b border-linha px-2 py-1.5 text-left text-xs font-medium text-mineral">
                Energia contratada (MWmédio)
              </th>
              <th scope="col" className="border-b border-linha px-2 py-1.5 text-left text-xs font-medium text-mineral">
                Fontes
              </th>
            </tr>
          </thead>
          <tbody>
            {g.maiores.map((x, i) => {
              const logo = comLogo[i];
              return (
                <tr key={x.cnpj} className="border-b border-linha align-top">
                  <th scope="row" className="px-2 py-2 text-left font-normal text-carvao">
                    <span className="flex items-center gap-2">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logo.src}
                          alt={logo.nome}
                          width={56}
                          height={20}
                          loading="lazy"
                          className="h-5 w-14 shrink-0 object-contain object-left"
                          title={`${logo.noTopo ? "Logotipo do grupo" : "Logotipo de holding na cadeia de controle"}: ${logo.nome}${logo.origem ? `; origem: ${logo.origem}` : ""}${logo.data ? `, ${logo.data}` : ""}`}
                        />
                      ) : algumLogo ? (
                        <span aria-hidden="true" className="inline-block h-5 w-14 shrink-0" />
                      ) : null}
                      <span>
                        {x.nome ?? "nome não publicado"}
                        {logo && !logo.noTopo && <span className="block text-xs text-carvao-muted">logotipo: {logo.nome}, na cadeia de controle</span>}
                      </span>
                    </span>
                  </th>
                  <td className="px-2 py-2 text-right tabular-nums text-carvao">{num(x.empreendimentos, 0)}</td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="inline-block h-2.5 bg-energia" style={{ width: `${Math.max(2, (100 * x.energia_mwmed) / maior) * 0.8}px` }} />
                      <span className="tabular-nums text-carvao">{num(x.energia_mwmed, 1)}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-carvao-muted">
                    {x.categorias.map((c) => (
                      <span key={c} className="mr-2 inline-flex items-center gap-1 whitespace-nowrap">
                        <span aria-hidden="true" className="inline-block h-2 w-2" style={{ background: COR_CATEGORIA_LEILAO[c] }} />
                        {CURTO_CATEGORIA[c]}
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
            <tr className="border-b border-linha">
              <th scope="row" className="px-2 py-2 text-left font-normal text-carvao-muted">
                Demais {num(g.demais.grupos, 0)} grupos
              </th>
              <td className="px-2 py-2 text-right tabular-nums text-carvao-muted">{num(g.demais.empreendimentos, 0)}</td>
              <td className="px-2 py-2 tabular-nums text-carvao-muted">{num(g.demais.energia_mwmed, 1)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <p className="text-sm font-medium text-carvao">Sem vínculo provado com um grupo, contado à parte</p>
        <ul className="mt-1 space-y-1 text-sm text-carvao-muted">
          {g.sem_vinculo.filter((s) => s.empreendimentos > 0).map((s) => (
            <li key={s.id}>
              {s.rotulo}: {num(s.empreendimentos, 0)} contratos, {mwmed(s.energia_mwmed)}
              {total ? ` (${num((100 * s.energia_mwmed) / total, 1)}% da energia)` : ""}.
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ situação por fonte */

/**
 * Barras de 100% por fonte com a parcela da energia contratada em cada situação: leve (HTML puro, sem cliente) e com o valor
 * escrito em cada linha. A cor não é o único portador: a legenda e o texto da linha dizem a situação e o percentual.
 */
export function BarrasSituacao({
  linhas,
  ordem,
  cores,
  rotulos,
  titulo,
}: {
  linhas: { id: string; rotulo: string; total: number; valores: Record<string, number> }[];
  ordem: readonly string[];
  cores: Record<string, string>;
  rotulos: Record<string, string>;
  titulo: string;
}) {
  const p = (v: number, t: number) => (t ? (100 * v) / t : 0);
  return (
    <figure className="space-y-3">
      <figcaption className="text-sm font-medium text-carvao">{titulo}</figcaption>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-carvao-muted" aria-label="Legenda">
        {ordem.map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5" style={{ background: cores[k] }} />
            {rotulos[k]}
          </li>
        ))}
      </ul>
      <ul className="space-y-2">
        {linhas.map((l) => (
          <li key={l.id} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center sm:gap-3">
            <span className="text-sm text-carvao">
              {l.rotulo} <span className="tabular-nums text-carvao-muted">({num(l.total, 0)} MWmédio)</span>
            </span>
            <span
              className="flex h-4 w-full overflow-hidden bg-superficie"
              role="img"
              aria-label={`${l.rotulo}: ${ordem.filter((k) => l.valores[k] > 0).map((k) => `${rotulos[k]} ${num(p(l.valores[k], l.total), 1)}%`).join("; ")}`}
            >
              {ordem.map((k) => (l.valores[k] > 0 ? <span key={k} style={{ width: `${p(l.valores[k], l.total)}%`, background: cores[k] }} /> : null))}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ------------------------------------------------------------------ números citáveis */

export function FrasesCitaveis({ frases, rotulo }: { frases: FraseCitavel[]; rotulo: string }) {
  return (
    <ol className="space-y-4" aria-label={rotulo}>
      {frases.map((f) => (
        <li key={f.id} id={`citar-${f.id}`} className="border-l-2 border-energia pl-4">
          <p className="max-w-prose2 text-base leading-relaxed text-carvao">{f.texto}</p>
          <p className="mt-1 text-xs leading-relaxed text-carvao-muted">Fonte: {f.referencia}</p>
        </li>
      ))}
    </ol>
  );
}

/** Lista de definição curta (rótulo e texto), usada nos blocos de regras. */
export function ListaRegras({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-[12rem_minmax(0,1fr)]">
      {itens.map(([r, t]) => (
        <div key={r} className="contents">
          <dt className="font-medium text-carvao">{r}</dt>
          <dd className="leading-relaxed text-carvao-muted">{t}</dd>
        </div>
      ))}
    </dl>
  );
}
