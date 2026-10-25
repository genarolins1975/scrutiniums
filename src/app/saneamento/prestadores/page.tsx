import { rotuloSinisa } from "@/lib/saneamento/edicao";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, Fonte, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { agregado, controleSocietario, meta, prestador, prestadores } from "@/lib/saneamento/gold";
import { controladoresDiretos, resumoControlador } from "@/lib/saneamento/controle";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { data, inteiro, numero } from "@/lib/saneamento/formato";
import { NATUREZA_CURTA } from "@/lib/saneamento/rotulos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quem presta o serviço de água e esgoto?",
  description:
    `Cadastro dos 1.797 prestadores declarados ao ${rotuloSinisa()}, com natureza jurídica, abrangência, municípios, população atendida, perdas e investimento, e ficha de cada um.`,
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

  const companhias = controleSocietario();
  const cvm = meta()?.cvm;
  const popCompanhias = companhias.reduce((s, c) => s + ((c.prestador && prestador(c.prestador)?.populacao_atendida_agua) || 0), 0);
  const semControlador = companhias.filter((c) => !c.controlador_declarado);
  const siglaDe = (c: (typeof companhias)[number]) => (c.prestador && prestador(c.prestador)?.sigla) || c.nome;

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
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:prestadores" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={7}
          titulo={cap.pergunta}
          texto={
            <p>
              O serviço é do município, que pode prestá-lo diretamente, por autarquia ou empresa municipal, ou delegá-lo a uma companhia estadual ou a
              uma empresa privada por contrato. O cadastro abaixo reúne quem declarou prestar água ou esgoto ao {rotuloSinisa()}, com a natureza jurídica
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
            { rotulo: "Prestadores declarados", valor: inteiro(lista.length), contexto: <>Locais e regionais, água ou esgoto, {rotuloSinisa()}.</> },
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
            naoPermite="Inferir quem controla as empresas: natureza jurídica não é controle societário. Participações acionárias e grupos econômicos não aparecem no SINISA; para as companhias abertas, a seção seguinte traz a posição acionária declarada à CVM."
          />
          <Nota>
            Municípios com mais de um prestador (por exemplo, água de um e esgoto de outro, ou concessões parciais) contam em cada natureza em que
            aparecem; por isso a coluna de municípios não soma o total do Brasil.
          </Nota>
        </Secao>

        {cvm && companhias.length > 0 && (
          <Secao
            id="controle"
            titulo="Quem controla as companhias abertas?"
            texto="Para as companhias com registro na CVM, o Formulário de Referência informa os acionistas, o controlador e a cadeia de controle. Cada companhia foi ligada ao prestador do SINISA pelo CNPJ que os municípios declararam."
          >
            <Numeros
              colunas={3}
              itens={[
                {
                  rotulo: "Companhias abertas com posição acionária",
                  valor: inteiro(companhias.length),
                  contexto: <>De {inteiro(lista.length)} prestadores declarados; os outros {inteiro(lista.length - companhias.length)} não publicam a posição acionária neste formato.</>,
                },
                {
                  rotulo: "População atendida com água por essas companhias",
                  valor: `${numero(razaoPct(popCompanhias, popAguaTotal), 1)}%`,
                  contexto: <>{inteiro(popCompanhias)} de {inteiro(popAguaTotal)} pessoas atendidas com rede de água declaradas no Brasil, {rotuloSinisa()}.</>,
                },
                {
                  rotulo: "Sem controlador declarado",
                  valor: `${inteiro(semControlador.length)} de ${inteiro(companhias.length)}`,
                  contexto: <>{semControlador.map(siglaDe).join(", ") || "Nenhuma"}. Sem controlador declarado não significa sem controle.</>,
                },
              ]}
            />
            <div className="tabela-scroll mt-8" tabIndex={0} role="region" aria-label="Controle das companhias abertas (rolável)">
              <table className="w-full min-w-[44rem] border-collapse text-sm">
                <caption className="sr-only">Companhias abertas prestadoras de água e esgoto, controlador declarado e acordo de acionistas</caption>
                <thead>
                  <tr className="border-b border-carvao text-left">
                    <th scope="col" className="py-2 pr-4 font-medium">Companhia</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Controlador declarado</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Acordo de acionistas</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Municípios</th>
                    <th scope="col" className="py-2 font-medium">Documento na CVM</th>
                  </tr>
                </thead>
                <tbody>
                  {companhias.map((c) => (
                    <tr key={c.cnpj} className="border-b border-linha align-top">
                      <th scope="row" className="py-2 pr-4 text-left font-normal">
                        {c.prestador ? (
                          <Link href={`${ROTA}/prestadores/${c.prestador}#controle`} className="text-obee-dark underline underline-offset-2">
                            {c.nome}
                          </Link>
                        ) : (
                          c.nome
                        )}
                        <span className="block text-xs text-carvao-muted">CNPJ {c.cnpj}</span>
                      </th>
                      <td className={`py-2 pr-4 ${controladoresDiretos(c).length === 0 ? "text-carvao-muted" : "text-carvao"}`}>{resumoControlador(c)}</td>
                      <td className="py-2 pr-4">{c.acordo_acionistas ? "Sim" : "Não"}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{inteiro(c.municipios_declarados)}</td>
                      <td className="py-2 text-xs text-carvao-muted">
                        FRE versão {c.documento.versao}, recebido em {data(c.documento.recebido_em)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Ressalva
              permite="Ver quem cada companhia aberta declara como controlador e participante de acordo de acionistas, e abrir a cadeia completa na ficha do prestador."
              naoPermite="Concluir que prestador fora da tabela não tem controle definido: empresas fechadas, sociedades sem registro na CVM, autarquias e serviços municipais não aparecem neste formato. Também não dá para acompanhar mudanças posteriores ao último documento recebido."
            />
            <Nota>
              Municípios é a contagem dos que declararam o CNPJ da companhia como prestador de água ou esgoto no módulo Gestão Municipal do {rotuloSinisa()}.
              A posição é a do último FRE de {cvm.ano} recebido pela CVM até a captura, em {data(cvm.capturado_em)}.
            </Nota>
            <Fonte>
              CVM, dados abertos, Formulário de Referência {cvm.ano}, arquivo posicao_acionaria. Árvore completa por companhia em{" "}
              <a className="text-obee-dark underline" href="/saneamento/gold/controle_societario.csv">controle_societario.csv</a>.
            </Fonte>
          </Secao>
        )}

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
            Ministério das Cidades, {rotuloSinisa()}, planilhas por prestador e município (Locais e Regionais). Perdas: fórmula
            do IAG2013 sobre as somas de volumes do prestador.
          </Fonte>
        </Secao>
      </main>
    </>
  );
}
