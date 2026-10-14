import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { agregado, prestadores } from "@/lib/saneamento/gold";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero } from "@/lib/saneamento/formato";
import { NATUREZA_CURTA } from "@/lib/saneamento/rotulos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quem presta o serviço de água e esgoto?",
  description:
    "Cadastro dos 1.797 prestadores declarados ao SINISA 2024, com natureza jurídica, abrangência, municípios, população atendida, perdas e investimento, e ficha de cada um.",
  alternates: { canonical: "/saneamento/prestadores" },
};

export default function Pagina() {
  const cap = capituloPorSlug("prestadores")!;
  const lista = prestadores();
  const br = agregado("BR");
  const popAguaTotal = br?.sinisa.agua.pop_atendida ?? null;

  const porNat = new Map<string, { n: number; pop: number; mun: Set<string> }>();
  for (const p of lista) {
    const k = p.natureza ?? "Não informada";
    const acc = porNat.get(k) ?? { n: 0, pop: 0, mun: new Set<string>() };
    acc.n += 1;
    acc.pop += p.populacao_atendida_agua ?? 0;
    for (const m of p.municipios_agua) acc.mun.add(m);
    porNat.set(k, acc);
  }
  const nat = [...porNat.entries()]
    .map(([k, v]) => ({ id: k, rotulo: NATUREZA_CURTA[k] ?? k, prestadores: v.n, pop: v.pop / 1e6, municipios: v.mun.size }))
    .sort((a, b) => b.pop - a.pop);
  const regionais = lista.filter((p) => p.abrangencia === "Regional");
  const popRegionais = regionais.reduce((s, p) => s + (p.populacao_atendida_agua ?? 0), 0);

  const linhas = lista.map((p) => ({
    nome: p.nome ?? p.id,
    href: `${ROTA}/prestadores/${p.id}`,
    sigla: p.sigla,
    natureza: p.natureza ? NATUREZA_CURTA[p.natureza] ?? p.natureza : null,
    abrangencia: p.abrangencia,
    ufs: p.ufs.join(", "),
    mun_agua: p.municipios_agua.length,
    mun_esgoto: p.municipios_esgoto.length,
    pop_agua: p.populacao_atendida_agua,
    pop_esgoto: p.populacao_atendida_esgoto,
    perdas: p.perdas_distribuicao_pct,
  }));

  return (
    <>
      <Cabecalho atual="prestadores" />
      <MarcaVisita secao="saneamento:prestadores" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={7}
          titulo={cap.pergunta}
          texto={
            <p>
              O serviço é do município, que pode prestá-lo diretamente, por autarquia ou empresa municipal, ou delegá-lo a uma companhia estadual ou a
              uma empresa privada por contrato. O cadastro abaixo reúne quem declarou prestar água ou esgoto ao SINISA 2024, com a natureza jurídica
              informada e o perímetro de atuação.
            </p>
          }
          recorte={<>{inteiro(lista.length)} prestadores com atuação declarada em 2024; {inteiro(regionais.length)} de abrangência regional.</>}
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />

        <Numeros
          colunas={3}
          itens={[
            { rotulo: "Prestadores declarados", valor: inteiro(lista.length), contexto: <>Locais e regionais, água ou esgoto, SINISA 2024.</> },
            {
              rotulo: "População atendida com água por prestadores regionais",
              valor: `${numero(razaoPct(popRegionais, popAguaTotal), 1)}%`,
              contexto: <>{inteiro(popRegionais)} de {inteiro(popAguaTotal)} pessoas atendidas com rede de água declaradas no Brasil.</>,
            },
            {
              rotulo: "Administração direta municipal",
              valor: inteiro(porNat.get("Município")?.n),
              contexto: <>Prestadores locais em que a própria prefeitura opera o serviço.</>,
            },
          ]}
        />

        <Secao id="natureza" titulo="Que tipo de organização presta o serviço?" texto="População atendida com água por natureza jurídica do prestador, em milhões de pessoas.">
          <GraficoBarras
            titulo="População atendida com água por natureza jurídica do prestador (milhões de pessoas, 2024)"
            dados={nat.map((n) => ({ id: n.id, rotulo: n.rotulo, v: n.pop }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: "milhões de pessoas", cor: "var(--cor-obee)" }]}
            unidade="mi pessoas"
            casas={1}
            orientacao="horizontal"
            rotulosValor
          />
          <div className="tabela-scroll mt-8" tabIndex={0} role="region" aria-label="Prestadores por natureza jurídica (rolável)">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <caption className="sr-only">Prestadores, municípios e população por natureza jurídica</caption>
              <thead>
                <tr className="border-b border-carvao text-right">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Natureza jurídica declarada</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Prestadores</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Municípios com água</th>
                  <th scope="col" className="py-2 font-medium">População atendida com água</th>
                </tr>
              </thead>
              <tbody>
                {nat.map((n) => (
                  <tr key={n.id} className="border-b border-linha text-right tabular-nums">
                    <th scope="row" className="py-2 pr-4 text-left font-normal">{n.rotulo}</th>
                    <td className="py-2 pr-4">{inteiro(n.prestadores)}</td>
                    <td className="py-2 pr-4">{inteiro(n.municipios)}</td>
                    <td className="py-2">{inteiro(n.pop * 1e6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Ver o peso de cada forma de prestação no atendimento declarado de água."
            naoPermite="Inferir quem controla as empresas: natureza jurídica não é controle societário. Participações acionárias e grupos econômicos não aparecem no SINISA."
          />
          <Nota>
            Municípios com mais de um prestador (por exemplo, água de um e esgoto de outro, ou concessões parciais) contam em cada natureza em que
            aparecem; por isso a coluna de municípios não soma o total do Brasil.
          </Nota>
        </Secao>

        <Secao
          id="cadastro"
          titulo="Cadastro de prestadores"
          texto={
            <>
              Busque pelo nome, sigla, UF ou natureza. Cada nome leva à ficha do prestador. Para pôr até quatro lado a lado, use o{" "}
              <Link href={`${ROTA}/prestadores/comparar`} className="text-obee-dark underline underline-offset-2">
                comparador de prestadores
              </Link>
              .
            </>
          }
        >
          <TabelaDados
            titulo="Prestadores"
            arquivo="saneamento-prestadores-2024.csv"
            colunas={[
              { id: "nome", rotulo: "Prestador", href: "href", detalhe: "sigla" },
              { id: "natureza", rotulo: "Natureza" },
              { id: "abrangencia", rotulo: "Abrangência" },
              { id: "ufs", rotulo: "UF" },
              { id: "mun_agua", rotulo: "Municípios com água", tipo: "inteiro" },
              { id: "mun_esgoto", rotulo: "Municípios com esgoto", tipo: "inteiro" },
              { id: "pop_agua", rotulo: "População atendida, água", tipo: "inteiro" },
              { id: "perdas", rotulo: "Perdas na distribuição", tipo: "pct" },
            ]}
            linhas={linhas}
            ordemInicial={{ coluna: "pop_agua", direcao: "desc" }}
            rotuloLinhas={{ singular: "prestador", plural: "prestadores" }}
          />
          <Fonte>
            Ministério das Cidades, SINISA 2025 (ano de referência 2024), planilhas por prestador e município (Locais e Regionais). Perdas: fórmula
            do IAG2013 sobre as somas de volumes do prestador.
          </Fonte>
        </Secao>
      </main>
    </>
  );
}
