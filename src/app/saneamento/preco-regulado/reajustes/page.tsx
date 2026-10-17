import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Nota, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { SubnavPreco } from "@/components/saneamento/PrecoRegulado";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { ROTA } from "@/lib/saneamento/capitulos";
import dados from "@/lib/saneamento/dados/atos.json";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Por que a conta aumentou? Reajustes e revisões tarifárias",
  description: "Catálogo de atos tarifários de 2023 a 2026 com prestador, regulador, tipo, pedido, decisão, data do ato, vigência e documento.",
  alternates: { canonical: `${ROTA}/preco-regulado/reajustes` },
};

type Ato = {
  id: string;
  prestador: string;
  area: string;
  regulador: string;
  tipo: string;
  pedido: string;
  decisao: string;
  ato: string;
  data: string | null;
  vigencia: string;
  url: string;
  verificado: boolean;
  obs: string;
};

/** Ordem de apresentação; prestador fora da lista entra depois, em ordem alfabética, e nunca some da página. */
const ORDEM = ["SABESP", "SANEPAR", "COPASA", "COMPESA", "CAESB", "SANEAGO", "CASAN", "CORSAN"];

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

export default function Pagina() {
  const { atos, levantado_em, levantado_por_prestador } = dados as { atos: Ato[]; levantado_em: string; levantado_por_prestador: Record<string, string> };
  const prestadores = [...ORDEM.filter((p) => atos.some((a) => a.prestador === p)), ...[...new Set(atos.map((a) => a.prestador))].filter((p) => !ORDEM.includes(p)).sort()];
  const grupos = prestadores.map((p) => ({ p, lista: atos.filter((a) => a.prestador === p).sort((x, y) => (x.data ?? "").localeCompare(y.data ?? "")) })).filter((g) => g.lista.length);
  return (
    <>
      <Cabecalho atual="preco-regulado/reajustes" />
      <MarcaVisita secao="saneamento:preco-reajustes" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={5}
          rotuloExtra="5.3"
          titulo="Por que a conta aumentou?"
          texto={
            <p>
              Cada mudança de tabela tem um ato: reajuste pela inflação e fatores definidos, revisão periódica dos custos, revisão extraordinária ou
              mudança de estrutura. O catálogo separa o pedido, a decisão, a data do ato e o início da vigência, que podem distar semanas.
            </p>
          }
          recorte={
            <>
              {atos.length} atos de 2023 a 2026 de {prestadores.length} prestadores; {atos.filter((a) => a.verificado).length} lidos no texto oficial. Levantamento em {dataBr(levantado_em)}
              {Object.entries(levantado_por_prestador).map(([p, d]) => `; ${p} em ${dataBr(d)}`).join("")}.
            </>
          }
          situacao="parcial"
          pendencia="A evolução da conta padronizada exige as tabelas anteriores a cada ato, ainda não coletadas; por isso não há, nesta entrega, série de conta comparada à inflação e à renda."
        />
        <SubnavPreco atual="reajustes" />

        <Secao id="linha-do-tempo" titulo="Linha do tempo por prestador" texto="Data do ato à esquerda; vigência, decisão e pedido à direita. Percentual médio não é o aumento de toda conta: o efeito varia com a categoria e o consumo.">
          {grupos.map((g) => (
            <section key={g.p} aria-labelledby={`atos-${g.p}`} className="mb-10">
              <h3 id={`atos-${g.p}`} className="font-serif text-xl text-carvao">
                {g.p} <span className="text-base text-carvao-muted">· {[...new Set(g.lista.map((a) => a.regulador))].join(", ")}</span>
              </h3>
              <ol className="mt-3 border-l-2 border-obee">
                {g.lista.map((a) => (
                  <li key={a.id} className="relative grid grid-cols-1 gap-x-6 border-b border-linha py-3 pl-5 text-sm md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1.2fr)]">
                    <span aria-hidden="true" className="absolute -left-[5px] top-4 h-2 w-2 bg-obee" />
                    <span className="font-medium tabular-nums text-carvao">{a.data ? a.data.split("-").reverse().join("/") : "sem data"}</span>
                    <span className="text-carvao">
                      <span className="font-medium">{a.tipo}</span>
                      <span className="block text-carvao-muted">{a.area}</span>
                      <a href={a.url} className="mt-1 inline-block text-obee-dark underline underline-offset-2" rel="noopener noreferrer">
                        {a.ato}
                      </a>
                      {!a.verificado && <span className="ml-2 border border-aviso px-1.5 text-xs text-aviso">não verificado no texto oficial</span>}
                    </span>
                    <span className="text-carvao">
                      <span className="block">
                        <span className="text-carvao-muted">Decisão: </span>
                        {a.decisao}
                      </span>
                      <span className="block">
                        <span className="text-carvao-muted">Vigência: </span>
                        {a.vigencia}
                      </span>
                      <span className="block">
                        <span className="text-carvao-muted">Pedido: </span>
                        {a.pedido}
                      </span>
                      {a.obs && <span className="mt-1 block text-xs text-carvao-muted">{a.obs}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <Ressalva
            permite="Saber quem pediu, quem decidiu, quando a decisão entrou em vigor e onde está o documento."
            naoPermite="Tratar o percentual médio como aumento igual para todos, nem comparar com o IPCA como se fosse o índice do contrato: cada ato aplica sua própria janela e seus próprios fatores."
          />
          <Nota>
            Águas do Rio (AGENERSA) ficou fora: o site do regulador respondeu com erro a todas as consultas, e nenhum ato foi verificado. Atos marcados
            como não verificados vêm de fonte secundária (página de relações com investidores do prestador) e permanecem sinalizados.
          </Nota>
          <Fonte>Sites dos reguladores e diários oficiais, consulta em {dataBr(levantado_em)}{Object.entries(levantado_por_prestador).map(([p, d]) => `; ${p} em ${dataBr(d)}`).join("")}; curadoria em pipeline/observatorio_saneamento/curadoria.</Fonte>
        </Secao>
      </main>
    </>
  );
}
