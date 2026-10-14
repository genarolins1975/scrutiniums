import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Indisponivel, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { AtlasMunicipal } from "@/components/saneamento/AtlasMunicipal";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { agregado, agregados, municipios } from "@/lib/saneamento/gold";
import { referencias } from "@/lib/saneamento/referencias";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { medida, agregarMedida } from "@/lib/saneamento/medidas";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero, reaisCompacto } from "@/lib/saneamento/formato";
import type { Municipio } from "@/lib/saneamento/tipos";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Onde o investimento está chegando?",
  description:
    "Investimento em água e esgoto declarado ao SINISA 2024 por município e UF, por habitante, por destino (ampliação, reposição e outros) e ao lado da carência medida pelo Censo 2022.",
  alternates: { canonical: "/saneamento/investimento" },
};

const ATLAS = ["sinisa-investimento-por-habitante"];
const MED = "sinisa-investimento-por-habitante";

const carenciaEsgoto = (m: Municipio) => razaoPct(m.c22_es_precario == null || m.c22_es_sem_banheiro == null ? null : m.c22_es_precario + m.c22_es_sem_banheiro, m.pop22);

export default function Pagina() {
  const cap = capituloPorSlug("investimento")!;
  const ags = agregados();
  const br = agregado("BR");
  const lista = municipios();
  const refs = referencias(ags, lista, ATLAS);
  const ufs = ags.filter((a) => a.tipo === "UF");
  const nomesUf = Object.fromEntries(ufs.map((u) => [u.id, u.nome]));
  const med = medida(MED);
  const ia = br?.sinisa.agua.investimento;
  const ie = br?.sinisa.esgoto.investimento;
  const total = (ia?.total ?? 0) + (ie?.total ?? 0);
  const brHab = refs[MED]?.BR?.pct ?? null;
  const declarantes = lista.filter((m) => m.inv_ag != null || m.inv_es != null);
  const zero = declarantes.filter((m) => (m.inv_ag ?? 0) + (m.inv_es ?? 0) === 0).length;

  const porUf = ufs
    .map((u) => ({ id: u.id, rotulo: u.nome, v: agregarMedida(med, lista.filter((m) => m.uf === u.id)).pct }))
    .sort((a, b) => (b.v ?? 0) - (a.v ?? 0));

  const pd = ia?.prestador_destino ?? {};
  const ed = ia?.estado_destino ?? {};
  const pe = ie?.prestador_destino ?? {};
  const ee = ie?.estado_destino ?? {};
  const s = (...xs: (number | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
  const destinos = [
    {
      id: "agua",
      rotulo: "Água",
      ampliacao: s(pd.ampliacao_producao, pd.ampliacao_distribuicao, ed.ampliacao_producao, ed.ampliacao_distribuicao) / 1e9,
      reposicao: s(pd.reposicao_producao, pd.reposicao_distribuicao, ed.reposicao_producao, ed.reposicao_distribuicao) / 1e9,
      outras: s(pd.outras, ed.outras) / 1e9,
    },
    {
      id: "esgoto",
      rotulo: "Esgoto",
      ampliacao: s(pe.ampliacao_coleta, pe.ampliacao_tratamento, ee.ampliacao_coleta, ee.ampliacao_tratamento) / 1e9,
      reposicao: s(pe.reposicao_coleta, pe.reposicao_tratamento, ee.reposicao_coleta, ee.reposicao_tratamento) / 1e9,
      outras: s(pe.outras, ee.outras) / 1e9,
    },
  ];
  const somaDestinos = destinos.reduce((a, d) => a + d.ampliacao + d.reposicao + d.outras, 0) * 1e9;

  // Carência × investimento: quintos de municípios pela proporção sem rede nem fossa séptica (Censo 2022).
  const comAmbos = declarantes
    .map((m) => ({ m, c: carenciaEsgoto(m) }))
    .filter((x): x is { m: Municipio; c: number } => x.c != null && x.m.dfe0001 != null && x.m.dfe0001 > 0)
    .sort((a, b) => a.c - b.c || a.m.id.localeCompare(b.m.id));
  const quintos = Array.from({ length: 5 }, (_, q) => {
    const fatia = comAmbos.slice(Math.floor((q * comAmbos.length) / 5), Math.floor(((q + 1) * comAmbos.length) / 5));
    const inv = fatia.reduce((a, x) => a + (x.m.inv_ag ?? 0) + (x.m.inv_es ?? 0), 0);
    const invEs = fatia.reduce((a, x) => a + (x.m.inv_es ?? 0), 0);
    const hab = fatia.reduce((a, x) => a + (x.m.dfe0001 ?? 0), 0);
    const carentes = fatia.reduce((a, x) => a + (x.m.c22_es_precario ?? 0) + (x.m.c22_es_sem_banheiro ?? 0), 0);
    const mor = fatia.reduce((a, x) => a + (x.m.pop22 ?? 0), 0);
    return {
      id: `q${q + 1}`,
      rotulo: `${q + 1}º quinto`,
      faixa: `${numero(fatia[0]?.c, 1)}% a ${numero(fatia[fatia.length - 1]?.c, 1)}%`,
      municipios: fatia.length,
      carenciaPct: razaoPct(carentes, mor),
      porHab: hab ? inv / hab : null,
      esgotoPorHab: hab ? invEs / hab : null,
      porCarente: carentes ? invEs / carentes : null,
    };
  });

  return (
    <>
      <Cabecalho atual="investimento" />
      <MarcaVisita secao="saneamento:investimento" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={9}
          titulo={cap.pergunta}
          texto={
            <p>
              Prestadores e governos estaduais declaram ao SINISA quanto investiram em cada município, em água e em esgoto, com a origem do dinheiro
              e o destino: ampliar, repor ou outros itens. Este capítulo põe esse investimento ao lado da população e da carência medida pelo Censo.
              Valores correntes de 2024, sem correção.
            </p>
          }
          recorte={
            <>
              {inteiro(declarantes.length)} municípios com investimento declarado em água ou esgoto no SINISA 2024. A soma municipal reproduz o
              consolidado nacional publicado.
            </>
          }
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />

        <Numeros
          colunas={4}
          itens={[
            { rotulo: "Investimento declarado em água e esgoto", valor: reaisCompacto(total), contexto: <>SINISA 2024, valores correntes; prestador e Estado.</> },
            { rotulo: "Em água", valor: reaisCompacto(ia?.total), contexto: <>Do qual {reaisCompacto(ia?.estado)} declarado pelos Estados.</> },
            { rotulo: "Em esgoto", valor: reaisCompacto(ie?.total), contexto: <>Do qual {reaisCompacto(ie?.estado)} declarado pelos Estados.</> },
            {
              rotulo: "Por habitante, nos municípios declarantes",
              valor: `R$ ${numero(brHab, 0)}`,
              contexto: <>Soma do investimento ÷ população estimada de 2024 dos mesmos municípios. {inteiro(zero)} municípios declararam zero.</>,
            },
          ]}
        />

        <Secao
          id="atlas"
          titulo="Quanto foi investido por habitante em cada município?"
          texto="Investimento de 2024 em água e esgoto, somando prestador e Estado, dividido pela população estimada pelo IBGE para 2024."
        >
          <AtlasMunicipal ids={ATLAS} referencias={refs} nomesUf={nomesUf} titulo="Atlas municipal do investimento por habitante" />
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), informações financeiras GFI2024, GFI2036, GFI2124 e GFI2136; IBGE, estimativa de população 2024.</Fonte>
        </Secao>

        <Secao id="por-uf" titulo="Como o investimento por habitante varia entre UFs?" texto="Soma do investimento dos municípios declarantes de cada UF dividida pela população estimada desses municípios.">
          <GraficoBarras
            titulo="Investimento em água e esgoto por habitante, por UF (R$ correntes de 2024)"
            dados={porUf}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: "R$/hab.", cor: "var(--cor-obee)" }]}
            unidade="R$/hab."
            casas={0}
            orientacao="horizontal"
            referencias={brHab != null ? [{ valor: brHab, rotulo: "Brasil" }] : undefined}
            limiteInicial={14}
          />
          <Ressalva
            permite="Comparar o esforço de investimento declarado em 2024 entre UFs, em relação à população."
            naoPermite="Concluir que uma UF investe pouco ou muito em relação à necessidade: um ano isolado reflete o ciclo de obras, e o custo por habitante varia com densidade, relevo e o estágio da rede."
          />
        </Secao>

        <Secao
          id="destino"
          titulo="Ampliar ou repor?"
          texto="Destino declarado do investimento: ampliação (produção e distribuição de água; coleta e tratamento de esgoto), reposição dos mesmos sistemas e outros investimentos, em bilhões de reais."
        >
          <GraficoBarras
            titulo="Investimento por destino declarado (R$ bilhões correntes de 2024)"
            dados={destinos}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[
              { id: "ampliacao", rotulo: "Ampliação", cor: "var(--cor-obee)" },
              { id: "reposicao", rotulo: "Reposição", cor: "var(--serie-comp-3)" },
              { id: "outras", rotulo: "Outros investimentos", cor: "var(--serie-2)" },
            ]}
            unidade="R$ bi"
            casas={2}
            orientacao="horizontal"
            empilhado
          />
          <Nota>
            Os destinos detalhados somam {reaisCompacto(somaDestinos)}, {numero(razaoPct(somaDestinos, total), 1)}% do total declarado de{" "}
            {reaisCompacto(total)}; a diferença foi declarada sem destino. &quot;Outros investimentos&quot; é a maior parcela nos dois serviços, e o
            SINISA não a detalha.
          </Nota>
          <Ressalva
            permite="Ver a parcela declarada como expansão de sistemas e a parcela de reposição."
            naoPermite="Medir o aumento de atendimento que o investimento produz: o SINISA não liga valores a obras, metas físicas ou entrada em operação."
          />
        </Secao>

        <Secao
          id="carencia"
          titulo="O investimento chega onde a carência é maior?"
          texto="Municípios declarantes divididos em cinco grupos de mesmo tamanho pela proporção de moradores sem rede de esgoto nem fossa séptica no Censo 2022. Para cada grupo, investimento somado sobre população somada."
        >
          <div className="tabela-scroll" tabIndex={0} role="region" aria-label="Investimento por quinto de carência (rolável)">
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">Investimento por habitante segundo a carência de esgoto do município</caption>
              <thead>
                <tr className="border-b border-carvao text-right align-bottom">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Grupo (menor para maior carência)</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Faixa de carência</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Municípios</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Moradores sem rede nem fossa séptica (% do grupo)</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Água e esgoto, R$ por habitante</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Esgoto, R$ por habitante</th>
                  <th scope="col" className="py-2 font-medium">Esgoto, R$ por morador sem rede nem fossa séptica</th>
                </tr>
              </thead>
              <tbody>
                {quintos.map((q) => (
                  <tr key={q.id} className="border-b border-linha text-right tabular-nums">
                    <th scope="row" className="py-2 pr-4 text-left font-normal text-carvao">{q.rotulo}</th>
                    <td className="py-2 pr-4">{q.faixa}</td>
                    <td className="py-2 pr-4">{inteiro(q.municipios)}</td>
                    <td className="py-2 pr-4">{numero(q.carenciaPct, 1)}%</td>
                    <td className="py-2 pr-4">{numero(q.porHab, 0)}</td>
                    <td className="py-2 pr-4">{numero(q.esgotoPorHab, 0)}</td>
                    <td className="py-2">{numero(q.porCarente, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ressalva
            permite="Ver se, em 2024, o investimento declarado por habitante foi maior ou menor nos municípios com mais carência de esgoto."
            naoPermite="Inferir causalidade nem eficiência: os períodos diferem (carência de 2022, investimento de 2024), municípios com carência alta podem ser atendidos por soluções individuais, e um investimento regional pode ter sido lançado num único município."
          />
          <Fonte>IBGE, Censo 2022 (tabela 7555); SINISA 2025 (2024), base municipal financeira; população estimada IBGE 2024. Grupos com o mesmo número de municípios, ordenados pela proporção municipal.</Fonte>
        </Secao>

        <Secao id="obras" titulo="As obras viram serviço?">
          <Indisponivel titulo="Execução de obras ainda não integrada">
            <p>
              Para saber se o investimento se converte em atendimento é preciso ligar valores a obras identificadas, com cronograma, avanço físico e
              entrada em operação. Essas bases (contratos de financiamento, Transferegov, PAC) não foram integradas. O Observatório não estima
              conversão de investimento em atendimento.
            </p>
          </Indisponivel>
        </Secao>
      </main>
    </>
  );
}
