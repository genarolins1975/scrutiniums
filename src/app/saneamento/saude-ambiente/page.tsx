import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Indisponivel, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { AtlasMunicipal } from "@/components/saneamento/AtlasMunicipal";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { FiguraOds, MundoNoCapitulo } from "@/components/saneamento/ReferenciaMundial";
import { DiagramaF } from "@/components/saneamento/Ilustracoes";
import { agregados, meta, municipiosComSaude, URL_SAUDE_MUNICIPIOS } from "@/lib/saneamento/gold";
import { referencias } from "@/lib/saneamento/referencias";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { ANOS_SAUDE, MEDIDAS_SAUDE, agregarMedida, medida } from "@/lib/saneamento/medidas";
import { razaoPct } from "@/lib/saneamento/municipios";
import { data, inteiro, numero } from "@/lib/saneamento/formato";
import type { Municipio } from "@/lib/saneamento/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Onde há mais internações e óbitos por doenças ligadas ao saneamento?",
  description:
    "Internações no SUS e óbitos por infecções intestinais, leptospirose e esquistossomose, por município de residência, de 2022 a 2024, ao lado da carência de esgoto do Censo 2022.",
  alternates: { canonical: "/saneamento/saude-ambiente" },
};

const ATLAS = MEDIDAS_SAUDE.map((m) => m.id);
const JANELA = `${ANOS_SAUDE[0]} a ${ANOS_SAUDE[ANOS_SAUDE.length - 1]}`;

/** Doenças do recorte, a ligação de transmissão com o saneamento e o que cada medida usa. */
const DOENCAS = [
  {
    id: "intestinais",
    rotulo: "Infecções intestinais",
    cid: "A00 a A09",
    ligacao: "Passam por água e alimentos contaminados por fezes e pela falta de higiene. Incluem as diarreias infecciosas, a febre tifoide e a cólera.",
  },
  {
    id: "leptospirose",
    rotulo: "Leptospirose",
    cid: "A27",
    ligacao: "Passa pelo contato com água ou lama contaminada por urina de roedores, típica de enchentes e de áreas com drenagem e coleta de lixo precárias.",
  },
  {
    id: "esquistossomose",
    rotulo: "Esquistossomose",
    cid: "B65",
    ligacao: "Passa pelo contato com águas onde vivem os caramujos hospedeiros do parasita, em áreas sem esgoto tratado.",
  },
] as const;

/** Medidas do quadro por carência: o grupo, o sistema e o rótulo da coluna. */
const COLUNAS_CARENCIA = [
  { id: "sd-intestinais-sih-int", rotulo: "Infecções intestinais, internações" },
  { id: "sd-intestinais-sim-obt", rotulo: "Infecções intestinais, óbitos" },
  { id: "sd-leptospirose-sih-int", rotulo: "Leptospirose, internações" },
  { id: "sd-esquistossomose-sim-obt", rotulo: "Esquistossomose, óbitos" },
] as const;

const carenciaEsgoto = (m: Municipio) =>
  razaoPct(m.c22_es_precario == null || m.c22_es_sem_banheiro == null ? null : m.c22_es_precario + m.c22_es_sem_banheiro, m.pop22);

export default function Pagina() {
  const cap = capituloPorSlug("saude-ambiente")!;
  const m = meta();
  const sd = m?.saude;
  const lista = municipiosComSaude();
  const ags = agregados();
  const ufs = ags.filter((a) => a.tipo === "UF");
  const nomesUf = Object.fromEntries(ufs.map((u) => [u.id, u.nome]));
  const refs = referencias(ags, lista, ATLAS);
  const taxaBr = (id: string) => refs[id]?.BR?.pct ?? null;
  const total = (id: string) => sd?.totais_tabnet[id] ?? null;

  // Quadro por UF e Brasil: taxa anual por 100 mil moradores do Censo 2022, soma de numeradores e denominadores municipais.
  const linhasUf = [
    { id: "BR", nome: "Brasil", membros: lista },
    ...ufs.map((u) => ({ id: u.id, nome: u.nome, membros: lista.filter((x) => x.uf === u.id) })),
  ].map((t) => {
    const linha: Record<string, string | number | null> = { territorio: t.nome };
    for (const med of MEDIDAS_SAUDE) linha[med.id] = agregarMedida(med, t.membros).pct;
    return linha;
  });

  // Municípios em cinco grupos de mesmo tamanho pela carência de esgoto (Censo 2022), com a taxa do grupo.
  const comCarencia = lista
    .map((x) => ({ x, c: carenciaEsgoto(x) }))
    .filter((v): v is { x: Municipio; c: number } => v.c != null && v.x.pop22 != null && v.x.pop22 > 0)
    .sort((a, b) => a.c - b.c || a.x.id.localeCompare(b.x.id));
  const quintos = Array.from({ length: 5 }, (_, q) => {
    const fatia = comCarencia.slice(Math.floor((q * comCarencia.length) / 5), Math.floor(((q + 1) * comCarencia.length) / 5));
    const membros = fatia.map((v) => v.x);
    const carentes = membros.reduce((a, x) => a + (x.c22_es_precario ?? 0) + (x.c22_es_sem_banheiro ?? 0), 0);
    const moradores = membros.reduce((a, x) => a + (x.pop22 ?? 0), 0);
    const taxas = Object.fromEntries(COLUNAS_CARENCIA.map((c) => [c.id, agregarMedida(medida(c.id), membros).pct]));
    return {
      id: `q${q + 1}`,
      rotulo: `${q + 1}º quinto`,
      faixa: `${numero(fatia[0]?.c, 1)}% a ${numero(fatia[fatia.length - 1]?.c, 1)}%`,
      municipios: fatia.length,
      carenciaPct: razaoPct(carentes, moradores),
      taxas,
    };
  });
  const primeiro = quintos[0];
  const ultimo = quintos[quintos.length - 1];
  const idInt = COLUNAS_CARENCIA[0].id;

  const conferencias = sd?.conferencias ?? [];
  const semMunicipio = Object.values(sd?.municipio_ignorado ?? {}).reduce((a, b) => a + b, 0);
  const notasSim = sd?.consultas.find((c) => c.sistema === "sim")?.notas;
  const notasSih = sd?.consultas.find((c) => c.sistema === "sih")?.notas;

  return (
    <>
      <Cabecalho atual="saude-ambiente" />
      <MarcaVisita secao="saneamento:saude-ambiente" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={13}
          titulo={cap.pergunta}
          texto={
            <p>
              Infecções intestinais, leptospirose e esquistossomose são doenças cuja transmissão passa pela água, pelo esgoto e pelo lixo. Este
              capítulo mostra, por município de residência, quantas internações no SUS e quantos óbitos o Ministério da Saúde registrou nessas três
              doenças de {JANELA}, e põe o resultado ao lado da carência de esgoto medida pelo Censo 2022. Ele mostra onde as doenças aparecem, não por
              que aparecem.
            </p>
          }
          recorte={
            <>
              Internações pagas pelo SUS (SIH) e óbitos por causa básica (SIM), pelo município de residência, somados de {JANELA}. Taxas por 100 mil
              moradores do Censo 2022 ao ano. {inteiro(lista.length)} municípios.
            </>
          }
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />

        <Numeros
          colunas={4}
          itens={[
            {
              rotulo: `Internações por infecções intestinais, ${JANELA}`,
              valor: inteiro(total("sih-intestinais-int")),
              contexto: <>{numero(taxaBr("sd-intestinais-sih-int"), 1)} por 100 mil moradores ao ano. Internações pagas pelo SUS, por residência.</>,
            },
            {
              rotulo: `Óbitos por infecções intestinais, ${JANELA}`,
              valor: inteiro(total("sim-intestinais-obt")),
              contexto: <>{numero(taxaBr("sd-intestinais-sim-obt"), 1)} por 100 mil moradores ao ano. Causa básica, SIM.</>,
            },
            {
              rotulo: `Internações por leptospirose, ${JANELA}`,
              valor: inteiro(total("sih-leptospirose-int")),
              contexto: <>{numero(taxaBr("sd-leptospirose-sih-int"), 2)} por 100 mil moradores ao ano.</>,
            },
            {
              rotulo: `Óbitos por esquistossomose, ${JANELA}`,
              valor: inteiro(total("sim-esquistossomose-obt")),
              contexto: <>{numero(taxaBr("sd-esquistossomose-sim-obt"), 2)} por 100 mil moradores ao ano. Causa básica, SIM.</>,
            },
          ]}
        />

        <Secao
          id="doencas"
          titulo="Que doenças entram, e por quê?"
          texto="Três grupos com ligação conhecida entre o modo de transmissão e a água, o esgoto ou o lixo. A lista é curta de propósito: cada grupo tem código de diagnóstico definido e pode ser separado nas duas fontes."
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Doenças do recorte e ligação com o saneamento (rolável)">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">Grupos de doenças do capítulo, código CID-10 e modo de transmissão</caption>
              <thead>
                <tr className="border-b border-carvao text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">Grupo</th>
                  <th scope="col" className="py-2 pr-4 font-medium">CID-10</th>
                  <th scope="col" className="py-2 font-medium">Como passa de uma pessoa a outra</th>
                </tr>
              </thead>
              <tbody>
                {DOENCAS.map((d) => (
                  <tr key={d.id} className="border-b border-linha align-top">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">{d.rotulo}</th>
                    <td className="py-2 pr-4 tabular-nums">{d.cid}</td>
                    <td className="py-2 text-carvao-muted">{d.ligacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Nota titulo="O que ficou de fora">
            Dengue, malária e outras doenças transmitidas por vetores, a hepatite A e doenças de pele ligadas à higiene não entram: a ligação com o
            saneamento é mais indireta, ou o grupo não se separa nas tabulações públicas (a hepatite A fica dentro de &ldquo;outras hepatites virais&rdquo; na
            Lista de Morbidade do SIH).
          </Nota>
          <div className="mt-10">
            <DiagramaF />
          </div>
        </Secao>

        <Secao
          id="atlas"
          titulo="Onde estão as internações e os óbitos?"
          texto="Escolha a doença e o sistema. O mapa, a tabela e a contagem usam a mesma taxa; as referências de UF e Brasil somam os municípios, sem tirar média de percentuais."
        >
          <AtlasMunicipal
            ids={ATLAS}
            referencias={refs}
            nomesUf={nomesUf}
            titulo="Atlas municipal de internações e óbitos por doenças ligadas ao saneamento"
            complemento={URL_SAUDE_MUNICIPIOS}
          />
          <Ressalva
            permite="Ver onde há mais internações pelo SUS de moradores e onde mais moradores morreram com cada doença, em taxa por 100 mil habitantes ao ano, e comparar com a UF e o Brasil."
            naoPermite="Ler a taxa de um município pequeno como tendência: poucos casos a mudam muito, e o ranking só inclui municípios de porte maior. Zero significa nenhum caso registrado na janela, não falta de dado."
          />
        </Secao>

        <Secao
          id="carencia"
          titulo="Municípios com mais carência de esgoto têm taxas maiores?"
          texto="Todos os municípios divididos em cinco grupos de mesmo tamanho pela proporção de moradores sem rede de esgoto nem fossa séptica no Censo 2022. Para cada grupo, casos somados sobre moradores somados."
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Taxas por quinto de carência de esgoto (rolável)">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <caption className="sr-only">Internações e óbitos por 100 mil moradores ao ano, segundo a carência de esgoto do município</caption>
              <thead>
                <tr className="border-b border-carvao text-right align-bottom">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Grupo (menor para maior carência)</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Faixa de carência</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Municípios</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Sem rede nem fossa séptica (% dos moradores do grupo)</th>
                  {COLUNAS_CARENCIA.map((c) => (
                    <th key={c.id} scope="col" className="py-2 pr-4 font-medium">{c.rotulo}, por 100 mil ao ano</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quintos.map((q) => (
                  <tr key={q.id} className="border-b border-linha text-right tabular-nums">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">{q.rotulo}</th>
                    <td className="py-2 pr-4">{q.faixa}</td>
                    <td className="py-2 pr-4">{inteiro(q.municipios)}</td>
                    <td className="py-2 pr-4">{numero(q.carenciaPct, 1)}%</td>
                    {COLUNAS_CARENCIA.map((c) => (
                      <td key={c.id} className="py-2 pr-4">{numero(q.taxas[c.id], medida(c.id).casas)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao">
            Nas internações por infecções intestinais, a taxa do primeiro quinto é {numero(primeiro?.taxas[idInt], 1)} e a do último é{" "}
            {numero(ultimo?.taxas[idInt], 1)} por 100 mil moradores ao ano.
          </p>
          <Ressalva
            permite="Ver se, em conjunto, os municípios com mais moradores sem rede de esgoto nem fossa séptica registram mais ou menos internações e óbitos."
            naoPermite="Concluir que a carência de esgoto explica a diferença. Renda, idade da população, clima, oferta de hospital e qualidade do registro mudam junto com o saneamento, e a comparação é entre grupos de municípios, não entre pessoas."
          />
          <Fonte>
            Ministério da Saúde, SIH/SUS e SIM (TabNet); IBGE, Censo 2022 (tabela 7555 e população). Grupos com o mesmo número de municípios, ordenados
            pela proporção municipal.
          </Fonte>
        </Secao>

        <Secao
          id="ufs"
          titulo="Como ficam o Brasil e as UFs?"
          texto="Taxa anual por 100 mil moradores do Censo 2022, de 2022 a 2024, somando os municípios de cada território."
        >
          <TabelaDados
            titulo="Brasil e UFs: internações e óbitos por 100 mil moradores ao ano, 2022 a 2024"
            arquivo="saneamento-saude-ambiente-brasil-ufs-2022-2024.csv"
            linhas={linhasUf}
            limite={28}
            busca={false}
            ordemInicial={{ coluna: "sd-intestinais-sih-int", direcao: "desc" }}
            rotuloLinhas={{ singular: "território", plural: "territórios" }}
            colunas={[
              { id: "territorio", rotulo: "Território" },
              ...MEDIDAS_SAUDE.map((med) => ({ id: med.id, rotulo: med.titulo, tipo: "numero" as const, casas: med.casas })),
            ]}
          />
        </Secao>

        <Secao
          id="mundo"
          titulo="E no mundo?"
          texto="A OMS estima, para cada país, as mortes atribuíveis a água, esgoto e higiene inseguros, e cada país relata à ONU a qualidade ambiental dos corpos d'água que monitora. As duas réguas dão contexto internacional; nenhuma mede o mesmo que as contagens do SUS deste capítulo."
        >
          <MundoNoCapitulo>
            <FiguraOds codigo="SH_STA_WASHARI" />
            <FiguraOds codigo="EN_H2O_WBAMBQ" />
          </MundoNoCapitulo>
        </Secao>

        <Secao id="dados" titulo="Conferir os números e a cobertura" texto="O que a fonte devolveu, o que foi conferido e o que ela própria avisa sobre os dados.">
          <ul className="max-w-prose2 list-disc space-y-2 pl-5 text-sm leading-relaxed text-carvao">
            <li>
              Cada consulta ao TabNet foi gravada como veio, com o sha256 do original, em {data(sd?.capturado_em?.slice(0, 10))}. Os parâmetros, as notas da fonte e
              os hashes estão em <a className="text-obee-dark underline" href="/saneamento/gold/meta.json">meta.json</a>.
            </li>
            <li>
              Conferência: em cada uma das {inteiro(conferencias.length)} consultas, a soma dos municípios mais os casos sem município de residência
              identificado é igual ao total que o TabNet devolve. Divergências: {inteiro(conferencias.filter((c) => c.diferenca !== 0).length)}.
            </li>
            <li>
              Casos sem município de residência identificado, somando as consultas: {inteiro(semMunicipio)}. Eles entram no total nacional, não em
              município algum.
            </li>
            {notasSim && <li>SIM: {notasSim.replace(/^Fonte:\s*/, "")}</li>}
            {notasSih && <li>SIH: {notasSih.replace(/^Fonte:\s*/, "")}</li>}
          </ul>
          <Nota titulo="Zero, ausência e denominador">
            Zero é nenhum caso registrado na janela. Município sem moradores no Censo 2022 fica sem taxa. O denominador é fixo (moradores do Censo 2022
            multiplicados por três anos), não a população estimada de cada ano. A taxa do SIH é de internações, não de pessoas: quem foi internado mais
            de uma vez na janela entra mais de uma vez. Nos óbitos, cada declaração conta uma vez.
          </Nota>
          <Indisponivel titulo="O que este capítulo ainda não mostra">
            <p>
              Taxas ajustadas por idade, o recorte por faixa etária e a série anual completa; dengue e demais doenças de vetor; hepatite A; e a qualidade
              da água bruta dos rios e mananciais, que depende das redes de monitoramento da ANA e dos órgãos estaduais e não foi integrada.
            </p>
          </Indisponivel>
          <Fonte>
            Ministério da Saúde, DATASUS, TabNet: Morbidade Hospitalar do SUS por local de residência (SIH/SUS) e Mortalidade por residência (SIM),
            consultas por município de residência; IBGE, Censo 2022. Arquivo municipal em{" "}
            <a className="text-obee-dark underline" href="/saneamento/gold/saude_municipios.csv">saude_municipios.csv</a>.
          </Fonte>
        </Secao>
      </main>
    </>
  );
}
