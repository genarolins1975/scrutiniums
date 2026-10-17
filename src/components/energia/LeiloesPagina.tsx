import type { ReactNode } from "react";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { COR_CATEGORIA_LEILAO, CURTO_CATEGORIA, logoDoGrupo, mwmed, type EntradaLogo, type FraseCitavel } from "@/lib/energia/leiloes";
import { num } from "@/lib/energia/formato";
import { tx } from "@/lib/energia/idioma";
import { SEM_VINCULO_LEILAO_EN, comNomes, temTraducao, traduzir } from "@/lib/energia/i18n/empresas-leiloes";
import type { LeiloesGold } from "@/lib/energia/tipos-leiloes";

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function LeiloesIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="leiloes" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo={tx("Leilões indisponíveis nesta publicação", "Auctions unavailable in this release")}
          motivo={
            motivo ??
            tx(
              "A gold do módulo Leilões (public/energia/gold/leiloes.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe.",
              "The Auctions module gold (public/energia/gold/leiloes.json) was not generated or did not pass validation; the last valid release is kept when there is one.",
            )
          }
        />
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ diagrama do ACR */

type Caminho = { id: string; titulo: string; traco: string; passos: [string, string][]; nota: string };

function caminhos(): Caminho[] {
  return [
    {
      id: "contrato",
      titulo: tx("Caminho do contrato", "Contract path"),
      traco: "solid",
      passos: [
        [
          tx("Vendedor", "Seller"),
          tx("a usina vencedora assina um contrato com cada distribuidora compradora (CCEAR)", "the winning plant signs a contract with each buying distribution utility (CCEAR)"),
        ],
        [
          tx("Distribuidoras", "Distribution utilities"),
          tx("cada uma recebe uma fatia proporcional à demanda que declarou para aquele leilão", "each one receives a share proportional to the demand it declared for that auction"),
        ],
        ["CCEE", tx("registra os contratos e contabiliza o que foi contratado e o que foi medido", "registers the contracts and accounts for what was contracted and what was metered")],
      ],
      nota: tx(
        "Na energia de reserva o contrato é com a CCEE, não com a distribuidora (Decreto nº 6.353/2008).",
        "For reserve energy the contract is with the CCEE, not with the distribution utility (Decree No. 6,353/2008).",
      ),
    },
    {
      id: "dinheiro",
      titulo: tx("Caminho do dinheiro", "Money path"),
      traco: "dashed",
      passos: [
        [
          tx("Consumidor cativo", "Captive consumer"),
          tx(
            "paga a conta de luz; a parcela de energia da tarifa (TE) cobre as compras da distribuidora",
            "pays the electricity bill; the energy portion of the tariff (TE) covers the distribution utility's purchases",
          ),
        ],
        [tx("Distribuidora", "Distribution utility"), tx("paga a cada vendedor o preço do contrato, atualizado conforme o contrato", "pays each seller the contract price, adjusted as the contract provides")],
        [
          tx("Mercado de curto prazo", "Short-term market"),
          tx("diferenças entre o contratado e o medido são liquidadas ao PLD na CCEE", "differences between what was contracted and what was metered are settled at the PLD at the CCEE"),
        ],
      ],
      nota: tx(
        "Na energia de reserva, o custo é rateado entre os consumidores por encargo, inclusive os do mercado livre.",
        "For reserve energy, the cost is shared among consumers through a charge, including those on the free market.",
      ),
    },
    {
      id: "fisico",
      titulo: tx("Caminho físico", "Physical path"),
      traco: "dotted",
      passos: [
        [tx("Usina", "Plant"), tx("gera quando o ONS despacha, não quando o contrato manda", "generates when the ONS dispatches it, not when the contract says")],
        [tx("Rede", "Grid"), tx("a energia de todas as usinas se mistura na rede interligada", "the energy from all plants mixes in the interconnected grid")],
        [
          tx("Consumo", "Consumption"),
          tx(
            "a energia que chega à casa não é a da usina com que a distribuidora contratou",
            "the energy that reaches a home is not that of the plant the distribution utility contracted with",
          ),
        ],
      ],
      nota: tx(
        "Contrato é obrigação financeira de entregar uma quantidade; a operação física segue o despacho centralizado.",
        "A contract is a financial obligation to deliver a quantity; physical operation follows centralized dispatch.",
      ),
    },
  ];
}

function papeis(): [string, string][] {
  return [
    ["MME", tx("define as diretrizes de cada leilão em portaria e fixa a garantia física das usinas", "sets each auction's guidelines by ordinance and fixes the plants' physical guarantee")],
    ["EPE", tx("habilita tecnicamente os projetos e calcula a garantia física", "technically qualifies the projects and calculates the physical guarantee")],
    [
      "ANEEL",
      tx(
        "aprova o edital e promove o leilão, diretamente ou por meio da CCEE (Lei nº 10.848/2004)",
        "approves the tender and runs the auction, directly or through the CCEE (Law No. 10,848/2004)",
      ),
    ],
    [tx("Distribuidoras", "Distribution utilities"), tx("declaram quanto precisam comprar para atender o próprio mercado", "declare how much they need to buy to serve their own market")],
    [tx("Vendedores", "Sellers"), tx("disputam o preço; quem vence assina os contratos", "compete on price; the winners sign the contracts")],
  ];
}

export function DiagramaAcr() {
  return (
    <div className="space-y-6" data-diagrama="acr">
      <ol className="grid gap-2 sm:grid-cols-5" aria-label={tx("Quem faz o quê num leilão do ACR, em ordem", "Who does what in an ACR auction, in order")}>
        {papeis().map(([quem, faz], i) => (
          <li key={quem} className="relative border-t-2 border-carvao bg-superficie px-3 py-2">
            <span className="rotulo text-mineral">{i + 1}</span>
            <p className="font-medium text-carvao">{quem}</p>
            <p className="mt-1 text-xs leading-relaxed text-carvao-muted">{faz}</p>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 md:grid-cols-3">
        {caminhos().map((c) => (
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
        {tx(
          "Traço contínuo: contrato. Tracejado: pagamento. Pontilhado: fluxo físico. Os três caminhos são diferentes: a usina pode vender num leilão, ser despachada em outra hora e receber pelo contrato mesmo sem gerar, acertando a diferença no mercado de curto prazo.",
          "Solid line: contract. Dashed: payment. Dotted: physical flow. The three paths are different: a plant can sell in an auction, be dispatched at another time and be paid under the contract even without generating, settling the difference in the short-term market.",
        )}
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
        {tx(
          <>
            <span className="font-medium">Grupo que controla a usina no cadastro de {dataSiga}</span>, não a vencedora na data do leilão: a usina
            pode ter mudado de dono, e a vencedora publicada pode ser um cotista do consórcio. Logotipo só quando o grupo, ou uma holding na cadeia de
            controle dele, é uma companhia com logotipo oficial no acervo do observatório.
          </>,
          <>
            <span className="font-medium">Group that controls the plant in the registry as of {dataSiga}</span>, not the winner on the auction date: the
            plant may have changed owners, and the published winner may be a consortium member. A logo appears only when the group, or a holding company in
            its control chain, is a company with an official logo in the observatory&apos;s collection.
          </>,
        )}
      </p>
      <div
        className="tabela-scroll"
        tabIndex={0}
        role="region"
        aria-label={tx("Energia contratada por grupo que controla a usina (tabela rolável)", "Energy contracted by group that controls the plant (scrollable table)")}
      >
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">
            {tx(
              `Energia contratada nos leilões do ACR por grupo que controla a usina, cadastro de ${dataSiga}`,
              `Energy contracted in ACR auctions by group that controls the plant, registry as of ${dataSiga}`,
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-linha px-2 py-1.5 text-left text-xs font-medium text-mineral">
                {tx(`Grupo que controla em ${dataSiga}`, `Controlling group on ${dataSiga}`)}
              </th>
              <th scope="col" className="border-b border-linha px-2 py-1.5 text-right text-xs font-medium text-mineral">
                {tx("Vendas", "Sales")}
              </th>
              <th scope="col" className="border-b border-linha px-2 py-1.5 text-left text-xs font-medium text-mineral">
                {tx("Energia contratada (MWmédio)", "Energy contracted (MWavg)")}
              </th>
              <th scope="col" className="border-b border-linha px-2 py-1.5 text-left text-xs font-medium text-mineral">
                {tx("Fontes", "Sources")}
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
                        <ListadasLogo
                          logo={{ arquivo: logo.src, fundo: logo.fundo, largura: logo.largura, altura: logo.altura, papel: logo.papel ?? "" }}
                          nome={logo.nome}
                          tamanho="sm"
                        />
                      ) : algumLogo ? (
                        <ListadasLogo logo={null} nome="" tamanho="sm" decorativo />
                      ) : null}
                      <span>
                        {x.nome ? <Nome>{x.nome}</Nome> : tx("nome não publicado", "name not published")}
                        {logo && !logo.noTopo && (
                          <span className="block text-xs text-carvao-muted">
                            {tx(
                              <>logotipo: {logo.nome}, na cadeia de controle</>,
                              <>
                                logo: <Nome>{logo.nome}</Nome>, in the control chain
                              </>,
                            )}
                          </span>
                        )}
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
                {tx(`Demais ${num(g.demais.grupos, 0)} grupos`, `Other ${num(g.demais.grupos, 0)} groups`)}
              </th>
              <td className="px-2 py-2 text-right tabular-nums text-carvao-muted">{num(g.demais.empreendimentos, 0)}</td>
              <td className="px-2 py-2 tabular-nums text-carvao-muted">{num(g.demais.energia_mwmed, 1)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <p className="text-sm font-medium text-carvao">{tx("Sem vínculo provado com um grupo, contado à parte", "No proven link to a group, counted separately")}</p>
        <ul className="mt-1 space-y-1 text-sm text-carvao-muted">
          {g.sem_vinculo
            .filter((s) => s.empreendimentos > 0)
            .map((s) => {
              const rotulo = temTraducao(SEM_VINCULO_LEILAO_EN, s.rotulo) ? traduzir(SEM_VINCULO_LEILAO_EN, s.rotulo) : <TrechoPortugues regiao="leiloes-sem-vinculo">{s.rotulo}</TrechoPortugues>;
              const parcela = total ? ` (${num((100 * s.energia_mwmed) / total, 1)}% ${tx("da energia", "of the energy")})` : "";
              return (
                <li key={s.id}>
                  {rotulo}: {num(s.empreendimentos, 0)} {tx("vendas", s.empreendimentos === 1 ? "sale" : "sales")}, {mwmed(s.energia_mwmed)}
                  {parcela}.
                </li>
              );
            })}
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
  const mwmedio = tx("MWmédio", "MWavg");
  return (
    <figure className="space-y-3">
      <figcaption className="text-sm font-medium text-carvao">{titulo}</figcaption>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-carvao-muted" aria-label={tx("Legenda", "Legend")}>
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
              {l.rotulo}{" "}
              <span className="tabular-nums text-carvao-muted">
                ({num(l.total, 0)} {mwmedio})
              </span>
            </span>
            <span
              className="flex h-4 w-full overflow-hidden bg-superficie"
              role="img"
              aria-label={`${l.rotulo}: ${ordem
                .filter((k) => l.valores[k] > 0)
                .map((k) => `${rotulos[k]} ${num(p(l.valores[k], l.total), 1)}%`)
                .join("; ")}`}
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
          <p className="mt-1 text-xs leading-relaxed text-carvao-muted">
            {tx("Fonte", "Source")}: {comNomes(f.referencia)}
          </p>
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
