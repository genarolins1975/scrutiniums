import type { ReactNode } from "react";
import { AlternarExemplos } from "@/components/energia/AlternarExemplos";
import { ModeloDidatico } from "@/components/energia/Didatica";
import { Nome } from "@/components/i18n/Nome";
import { dataBR, num } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { nomeSm } from "@/lib/energia/territorio";
import type { ExemploTerritorio } from "@/lib/energia/territorio-exemplos";
import { hrefNoIdioma } from "@/lib/i18n-href";

/**
 * Artefato "Um endereço, cinco áreas" de Minha região: a maior cidade de cada submercado e, em caixas uma dentro da outra, o número de
 * cada área que a atende (submercado, distribuidora, conjunto elétrico e município). Ensina a regra da página (cada número fica na área
 * da sua fonte) com um caso real antes do mapa. Os valores vêm de `exemplosTerritorio` (gold territorial e índice municipal).
 */

const nome = (t: string): ReactNode => tx<ReactNode>(t, <Nome>{t}</Nome>);

function Caixa({ rotulo, titulo, alcance, children, nivel }: { rotulo: string; titulo: ReactNode; alcance: ReactNode; children: ReactNode; nivel: 1 | 2 | 3 | 4 }) {
  const fundo = nivel === 1 ? "bg-papel" : nivel === 2 ? "bg-superficie" : nivel === 3 ? "bg-papel" : "bg-energia-fundo";
  return (
    <div className={`border border-linha ${fundo} p-3 sm:p-4`} data-area-exemplo={nivel}>
      <p className="text-xs text-carvao-muted">
        <span className="rotulo mr-2 text-mineral">{rotulo}</span>
        <span className="font-medium text-carvao">{titulo}</span>
        <span className="ml-1">· {alcance}</span>
      </p>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-carvao">{children}</div>
    </div>
  );
}

function Exemplo({ e, dataMmgd, anoPop }: { e: ExemploTerritorio; dataMmgd: string | null; anoPop: number | null }) {
  const idioma = idiomaEnergia();
  const sd = tx("sem dado publicado", "no published data");
  const dists = e.distribuidoras;
  return (
    <Caixa
      nivel={1}
      rotulo={tx("Submercado", "Submarket")}
      titulo={nomeSm(e.sm, idioma)}
      alcance={tx(`o mesmo número para as ${e.ufsDoSm} UFs do submercado`, `the same figure for the ${e.ufsDoSm} states of the submarket`)}
    >
      <ul className="space-y-1">
        <li>
          {tx("Preço de curto prazo (PLD médio do dia): ", "Short-term price (daily average PLD): ")}
          {e.pldDia ? (
            <strong className="font-medium tabular-nums">
              R$ {num(e.pldDia.valor, 2)}/MWh {tx(`em ${dataBR(e.pldDia.dia)}`, `on ${dataBR(e.pldDia.dia)}`)}
            </strong>
          ) : (
            sd
          )}
        </li>
        <li>
          {tx("Água guardada nos reservatórios (energia armazenada): ", "Water stored in the reservoirs (stored energy): ")}
          {e.ear ? (
            <strong className="font-medium tabular-nums">
              {num(e.ear.pct, 2)}% {tx(`da capacidade em ${dataBR(e.ear.dia)}`, `of capacity on ${dataBR(e.ear.dia)}`)}
            </strong>
          ) : (
            sd
          )}
        </li>
      </ul>
      {dists.length > 1 && (
        <p className="text-xs text-carvao-muted">
          {tx(
            `O município está na área de ${dists.length} distribuidoras; a página mostra todas e não escolhe uma.`,
            `The municipality is in the area of ${dists.length} distribution utilities; the page shows all of them and does not choose one.`,
          )}
        </p>
      )}
      <div className="space-y-3">
        {dists.map((d) => (
          <Caixa
            key={d.cnpj}
            nivel={2}
            rotulo={tx("Distribuidora", "Distribution utility")}
            titulo={nome(d.sigla)}
            alcance={tx(`o mesmo número para os ${num(d.municipiosNaArea, 0)} municípios da área`, `the same figure for the ${num(d.municipiosNaArea, 0)} municipalities in the area`)}
          >
            <ul className="space-y-1">
              <li>
                {tx("Tarifa residencial (B1, sem impostos): ", "Residential tariff (B1, before taxes): ")}
                {d.tarifa ? (
                  <strong className="font-medium tabular-nums">
                    R$ {num(d.tarifa.valor, 2)}/MWh {d.tarifa.data ? tx(`vigente em ${dataBR(d.tarifa.data)}`, `in force on ${dataBR(d.tarifa.data)}`) : ""}
                  </strong>
                ) : (
                  sd
                )}
              </li>
              <li>
                {tx("Perdas de energia na rede da distribuidora: ", "Energy losses on the utility's grid: ")}
                {d.perdas ? (
                  <strong className="font-medium tabular-nums">
                    {num(d.perdas.pct, 2)}% {d.perdas.ano ? tx(`em ${d.perdas.ano}`, `in ${d.perdas.ano}`) : ""}
                    {d.perdas.parcial ? tx(" (ano parcial)", " (partial year)") : ""}
                  </strong>
                ) : (
                  sd
                )}
              </li>
              <li>
                {tx("Continuidade da área inteira: ", "Continuity of the whole area: ")}
                {d.continuidade ? (
                  <strong className="font-medium tabular-nums">
                    {tx(
                      `DEC de ${num(d.continuidade.dec, 2)} h e FEC de ${num(d.continuidade.fec, 2)} interrupções por consumidor${d.continuidade.ano ? ` em ${d.continuidade.ano}` : ""}`,
                      `DEC of ${num(d.continuidade.dec, 2)} h and FEC of ${num(d.continuidade.fec, 2)} interruptions per consumer${d.continuidade.ano ? ` in ${d.continuidade.ano}` : ""}`,
                    )}
                  </strong>
                ) : (
                  sd
                )}
              </li>
            </ul>
          </Caixa>
        ))}
        <Caixa
          nivel={3}
          rotulo={tx("Conjuntos elétricos", "Consumer sets")}
          titulo={tx(`${num(e.conjuntos.n, 0)} conjuntos atendem o município`, `${num(e.conjuntos.n, 0)} consumer sets serve the municipality`)}
          alcance={tx("cada conjunto pode cobrir outros municípios ou só um pedaço deste", "each set may cover other municipalities or only a part of this one")}
        >
          <p>
            {e.conjuntos.decMin !== null && e.conjuntos.decMax !== null
              ? tx(
                  <>
                    Horas sem energia por consumidor (DEC){e.conjuntos.ano ? ` em ${e.conjuntos.ano}` : ""}: de{" "}
                    <strong className="font-medium tabular-nums">{num(e.conjuntos.decMin, 2)} h</strong> a{" "}
                    <strong className="font-medium tabular-nums">{num(e.conjuntos.decMax, 2)} h</strong>, conforme o conjunto ({num(e.conjuntos.comValor, 0)} com valor publicado).
                  </>,
                  <>
                    Hours without power per consumer (DEC){e.conjuntos.ano ? ` in ${e.conjuntos.ano}` : ""}: from{" "}
                    <strong className="font-medium tabular-nums">{num(e.conjuntos.decMin, 2)} h</strong> to{" "}
                    <strong className="font-medium tabular-nums">{num(e.conjuntos.decMax, 2)} h</strong>, depending on the set ({num(e.conjuntos.comValor, 0)} with a published value).
                  </>,
                )
              : sd}
          </p>
          <Caixa
            nivel={4}
            rotulo={tx("Município", "Municipality")}
            titulo={
              <>
                {nome(e.nome)} ({e.uf})
              </>
            }
            alcance={tx("números publicados para o próprio município", "figures published for the municipality itself")}
          >
            <ul className="space-y-1">
              <li>
                {tx("População estimada: ", "Estimated population: ")}
                <strong className="font-medium tabular-nums">{e.municipio.pop !== null ? num(e.municipio.pop, 0) : sd}</strong>
                {anoPop ? tx(` (IBGE, ${anoPop})`, ` (IBGE, ${anoPop})`) : ""}
              </li>
              <li>
                {tx("Micro e minigeração (painéis nos telhados e pequenas usinas): ", "Micro and mini generation (rooftop panels and small plants): ")}
                {e.municipio.mmgdUn !== null && e.municipio.mmgdKw !== null ? (
                  <strong className="font-medium tabular-nums">
                    {tx(
                      `${num(e.municipio.mmgdUn, 0)} unidades, ${num(e.municipio.mmgdKw / 1000, 1)} MW`,
                      `${num(e.municipio.mmgdUn, 0)} units, ${num(e.municipio.mmgdKw / 1000, 1)} MW`,
                    )}
                  </strong>
                ) : (
                  sd
                )}
                {dataMmgd ? tx(` (cadastro da ANEEL de ${dataBR(dataMmgd)})`, ` (ANEEL register of ${dataBR(dataMmgd)})`) : ""}
              </li>
              <li>
                {tx("Usinas em operação declaradas só neste município: ", "Operating plants declared only in this municipality: ")}
                <strong className="font-medium tabular-nums">
                  {tx(`${num(e.municipio.usinasN, 0)}, com ${num(e.municipio.usinasMw, 1)} MW`, `${num(e.municipio.usinasN, 0)}, with ${num(e.municipio.usinasMw, 1)} MW`)}
                </strong>
              </li>
            </ul>
            <p className="text-xs">
              <a href={hrefNoIdioma(`/setor-eletrico/territorio?sel=mun:${e.ibge}#p002`, idioma)} className="text-energia-dark underline underline-offset-4">
                {tx("Abrir a ficha completa no mapa", "Open the full sheet on the map")}
              </a>
            </p>
          </Caixa>
        </Caixa>
      </div>
    </Caixa>
  );
}

export function TerritorioAreas({ exemplos, dataMmgd, anoPop, fonte }: { exemplos: ExemploTerritorio[]; dataMmgd: string | null; anoPop: number | null; fonte: ReactNode }) {
  if (!exemplos.length) return null;
  return (
    <ModeloDidatico
      id="um-endereco-cinco-areas"
      titulo={tx("Um endereço, várias áreas: de quem é cada número", "One address, several areas: whose figure is each one")}
      intro={tx(
        <>
          Quem mora numa cidade está, ao mesmo tempo, num submercado (que tem o preço de curto prazo e os reservatórios), na área de uma distribuidora (que cobra a tarifa e tem
          as perdas), em conjuntos elétricos (onde se medem as interrupções) e no próprio município. As caixas mostram, para a maior cidade de cada submercado, o número de cada
          área. Um número de fora vale igual para todos os lugares de dentro: não diz nada que distinga a cidade das vizinhas.
        </>,
        <>
          Someone living in a city is, at the same time, in a submarket (which has the short-term price and the reservoirs), in a distribution utility&apos;s area (which charges
          the tariff and has the losses), in consumer sets (where interruptions are measured) and in the municipality itself. The boxes show, for the largest city of each
          submarket, the figure of each area. A figure from an outer box is the same for every place inside it: it says nothing that sets the city apart from its neighbors.
        </>,
      )}
      deixaDeFora={[
        tx(
          "As caixas não são mapa: a área de uma distribuidora pode atravessar UFs, e um conjunto elétrico pode cobrir parte de um município e parte de outro.",
          "The boxes are not a map: a utility's area can cross states, and a consumer set can cover part of one municipality and part of another.",
        ),
        tx(
          "A conta de luz não é o PLD nem só a tarifa: inclui impostos, bandeira e outros itens, na página Conta de luz.",
          "The electricity bill is neither the PLD nor just the tariff: it includes taxes, the tariff flag and other items, on the Electricity bill page.",
        ),
        tx(
          "A cidade escolhida é a mais populosa de cada submercado (regra fixa, população estimada do IBGE); não é amostra representativa.",
          "The chosen city is the most populous in each submarket (fixed rule, IBGE population estimate); it is not a representative sample.",
        ),
      ]}
      fonte={fonte}
    >
      <AlternarExemplos
        rotulo={tx("Cidade de exemplo", "Example city")}
        nome="territorio-exemplo"
        opcoes={exemplos.map((e) => ({ id: e.ibge, rotulo: <>{nome(e.nome)} ({e.uf})</> }))}
      >
        {exemplos.map((e) => (
          <Exemplo key={e.ibge} e={e} dataMmgd={dataMmgd} anoPop={anoPop} />
        ))}
      </AlternarExemplos>
    </ModeloDidatico>
  );
}
