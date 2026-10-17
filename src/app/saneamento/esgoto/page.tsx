import type { Metadata } from "next";
import { Cabecalho } from "@/components/saneamento/Cabecalho";
import { Abertura, Fonte, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { AtlasMunicipal } from "@/components/saneamento/AtlasMunicipal";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Histograma } from "@/components/energia/Histograma";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { montaHistograma } from "@/lib/energia/distribuicao";
import { acimaDaCapacidade, agregado, agregados, etes, meta, municipios } from "@/lib/saneamento/gold";
import { referencias } from "@/lib/saneamento/referencias";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero } from "@/lib/saneamento/formato";
import { URL_GOLD } from "@/lib/saneamento/gold";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Para onde vai o esgoto?",
  description:
    "Destino do esgoto dos moradores pelo Censo 2022, coleta e tratamento declarados ao SINISA 2024 com denominadores explícitos, ligações possíveis ainda não feitas e as estações de tratamento informadas.",
  alternates: { canonical: "/saneamento/esgoto" },
};

const ATLAS = [
  "c22-esgoto-sem-rede-nem-septica",
  "c22-esgoto-sem-rede",
  "sinisa-esgoto-nao-atendida",
  "sinisa-esgoto-tratado-coletado",
  "sinisa-esgoto-tratado-consumido",
  "evolucao-esgoto-rede",
];

/** Destinos do Censo 2022, na ordem do questionário; somam o total de moradores. */
const DESTINOS: [string, string, string][] = [
  ["rede_pluvial", "Rede geral ou pluvial", "var(--cor-obee)"],
  ["fossa_ligada", "Fossa séptica ligada à rede", "var(--serie-comp-4)"],
  ["septica", "Fossa séptica não ligada à rede", "var(--serie-comp-3)"],
  ["rudimentar", "Fossa rudimentar ou buraco", "var(--serie-comp-1)"],
  ["vala", "Vala", "var(--serie-comp-2)"],
  ["corpo_dagua", "Rio, lago, córrego ou mar", "var(--san-div-neg-2)"],
  ["outra", "Outra forma", "var(--serie-2)"],
  ["sem_banheiro", "Sem banheiro nem sanitário", "var(--escala-seq-5)"],
];

export default function Pagina() {
  const cap = capituloPorSlug("esgoto")!;
  const m = meta();
  const ags = agregados();
  const br = agregado("BR");
  const lista = municipios();
  const refs = referencias(ags, lista, ATLAS);
  const ufs = ags.filter((a) => a.tipo === "UF");
  const nomesUf = Object.fromEntries(ufs.map((u) => [u.id, u.nome]));
  const ind = br?.sinisa.esgoto.indicadores ?? {};
  const mor = br?.censo2022.moradores?.esgoto;

  const destinos = [br!, ...ufs].map((a) => {
    const e = a.censo2022.moradores?.esgoto;
    const linha: Record<string, string | number | null> = { id: a.id, rotulo: a.id === "BR" ? "Brasil" : a.nome };
    for (const [k] of DESTINOS) linha[k] = razaoPct(e?.[k as keyof typeof e] ?? null, e?.total ?? null);
    return linha;
  });

  const volumesUf = ufs
    .map((u) => ({ id: u.id, rotulo: u.nome, coletado: u.sinisa.esgoto.indicadores.IES2002 ?? null, tratado: u.sinisa.esgoto.indicadores.IES2003 ?? null }))
    .sort((a, b) => (b.tratado ?? -1) - (a.tratado ?? -1));

  const todas = etes();
  const operando = todas.filter((e) => e.em_operacao === "Sim");
  const porNivel = ["Preliminar/acondicionamento", "Primário", "Secundário", "Terciário"].map((n) => ({
    id: n,
    rotulo: n,
    v: operando.filter((e) => e.nivel === n).length,
  }));
  const semNivel = operando.filter((e) => !e.nivel).length;
  const util = operando.map((e) => e.utilizacao_pct).filter((v): v is number => v != null);
  const utilGrafico = util.filter((v) => v <= 200);
  const foraGrafico = util.length - utilGrafico.length;
  const histUtil = utilGrafico.length >= 5 ? montaHistograma(utilGrafico, { limites: [0, 25, 50, 75, 100, 125, 150, 175, 200] }) : null;
  const acima100 = operando.filter((e) => acimaDaCapacidade(e) === true).length;
  const etesUf = ufs
    .map((u) => ({ id: u.id, rotulo: u.nome, v: operando.filter((e) => e.uf === u.id).length }))
    .sort((a, b) => b.v - a.v);

  return (
    <>
      <Cabecalho atual="esgoto" />
      <MarcaVisita secao="saneamento:esgoto" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={4}
          titulo={cap.pergunta}
          texto={
            <p>
              Coletar não é tratar, e tratar o que é coletado não é tratar o esgoto gerado. Este capítulo separa cada etapa e diz sobre qual base
              cada percentual é calculado: moradores, domicílios ou volumes. O Censo descreve o destino declarado pelo morador; o SINISA, o que o
              prestador declara coletar e tratar.
            </p>
          }
          recorte={
            <>
              Censo 2022: {inteiro(mor?.total)} moradores em domicílios particulares permanentes ocupados. SINISA 2024:{" "}
              {inteiro(m?.cobertura.esgoto_participantes)} municípios com indicadores de esgoto e {inteiro(m?.cobertura.esgoto_delegacao_sem_atendimento)} com
              serviço delegado sem atendimento, que entram no denominador da consolidação oficial.
            </>
          }
        />

        <Numeros
          colunas={4}
          itens={[
            {
              rotulo: "População total atendida com rede coletora (IES0001)",
              valor: `${numero(ind.IES0001, 1)}%`,
              contexto: (
                <>
                  SINISA 2024 · {inteiro(br?.sinisa.esgoto.pop_atendida)} pessoas sobre {inteiro(br?.cobertura_sinisa.esgoto_dfe0001)} habitantes do
                  módulo.
                </>
              ),
            },
            {
              rotulo: "Domicílios com coleta e tratamento (IES0007)",
              valor: `${numero(ind.IES0007, 1)}%`,
              contexto: <>SINISA 2024 · economias residenciais ativas com tratamento sobre domicílios informados pelo município (OGM4006).</>,
            },
            {
              rotulo: "Esgoto tratado sobre coletado (IES2004)",
              valor: `${numero(ind.IES2004, 1)}%`,
              contexto: <>SINISA 2024 · volumes; inclui esgoto importado de outro município.</>,
            },
            {
              rotulo: "Esgoto tratado sobre a água consumida (IES2003)",
              valor: `${numero(ind.IES2003, 1)}%`,
              contexto: <>SINISA 2024 · aproxima o tratamento do esgoto gerado, usando o consumo de água como referência.</>,
            },
          ]}
        />
        <Nota titulo="Por que 85% e 52% não se contradizem">
          O primeiro percentual divide o tratado pelo que a rede coletou; o segundo, pelo volume de água consumida, que aproxima o que foi gerado.
          A diferença é o esgoto que não chega à rede. Os dois vêm da consolidação oficial do SINISA e não são média de percentuais municipais.
        </Nota>

        <Secao
          id="destino"
          titulo="Para onde vai o esgoto de cada morador?"
          texto="Destino declarado ao Censo 2022, em proporção dos moradores. As oito categorias somam 100%. Fossa séptica não ligada à rede é solução individual que pode ser adequada; fossa rudimentar, vala e lançamento direto não são."
        >
          <GraficoBarras
            titulo="Destino do esgoto dos moradores, por UF (Censo 2022, % dos moradores)"
            dados={destinos}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={DESTINOS.map(([id, rotulo, cor]) => ({ id, rotulo, cor }))}
            unidade="%"
            casas={1}
            orientacao="horizontal"
            empilhado
          />
          <Ressalva
            permite="Ver a composição do destino do esgoto em cada UF, com o mesmo universo de moradores, e onde predominam soluções precárias."
            naoPermite="Afirmar que o esgoto coletado é tratado, nem que a fossa séptica funciona como projetada: o Censo não pergunta sobre tratamento nem manutenção."
          />
          <Fonte>IBGE, Censo Demográfico 2022, tabela SIDRA 7555 (moradores) e 6805 (domicílios).</Fonte>
        </Secao>

        <Secao
          id="cadeia"
          titulo="Do volume consumido ao volume tratado"
          texto="Para cada 100 m³ de água consumida, quanto volta como esgoto coletado e quanto é tratado, segundo os prestadores. Ordenado pelo tratado."
        >
          <GraficoBarras
            titulo="Esgoto coletado e tratado referidos à água consumida, por UF (SINISA 2024, %)"
            dados={volumesUf.map((u) => ({ id: u.id, rotulo: u.rotulo, coletado: u.coletado, tratado: u.tratado }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[
              { id: "coletado", rotulo: "Coletado sobre consumido (IES2002)", cor: "var(--escala-seq-3)" },
              { id: "tratado", rotulo: "Tratado sobre consumido (IES2003)", cor: "var(--cor-obee)" },
            ]}
            unidade="%"
            casas={1}
            orientacao="horizontal"
            referencias={[{ valor: ind.IES2003 ?? 0, rotulo: "Brasil, tratado" }]}
          />
          <Ressalva
            permite="Comparar, entre UFs, quanto do volume equivalente ao consumo de água chega à rede e quanto é tratado."
            naoPermite="Converter volumes em pessoas, nem medir a carga poluidora removida: o indicador ignora a eficiência da estação e a água que não vira esgoto."
          />
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), consolidado por UF, indicadores IES2002 e IES2003.</Fonte>
        </Secao>

        <Secao
          id="atlas"
          titulo="Onde o esgoto fica sem coleta ou sem tratamento?"
          texto="Medidas do Censo e do SINISA no mesmo atlas, sempre com a fonte, o período e o universo de cada uma. As referências da UF e do Brasil vêm das tabulações oficiais."
        >
          <AtlasMunicipal ids={ATLAS} referencias={refs} nomesUf={nomesUf} titulo="Atlas municipal do destino do esgoto" />
          <Fonte>
            IBGE, Censos 2010 e 2022; Ministério das Cidades, SINISA 2025 (ano de referência 2024), base municipal de esgoto publicada em
            18/12/2025.
          </Fonte>
        </Secao>

        <Secao
          id="factiveis"
          titulo="Quantas ligações possíveis ainda não foram feitas?"
          texto="Imóveis em frente a uma rede de esgoto disponível que não se ligaram a ela. É carência que não depende de nova obra de rede."
        >
          <Numeros
            colunas={2}
            itens={[
              {
                rotulo: "Imóveis com rede de esgoto disponível e sem ligação (GTE0005)",
                valor: inteiro(br?.factiveis.esgoto.imoveis),
                contexto: <>Soma dos {inteiro(br?.factiveis.esgoto.municipios_informantes)} municípios que informaram o campo ao SINISA 2024.</>,
              },
              {
                rotulo: "Imóveis com rede de água disponível e sem ligação (GTA0007)",
                valor: inteiro(br?.factiveis.agua.imoveis),
                contexto: <>Soma dos {inteiro(br?.factiveis.agua.municipios_informantes)} municípios que informaram o campo.</>,
              },
            ]}
          />
          <Ressalva
            permite="Dimensionar uma carência que se resolve com ligação domiciliar, fiscalização e apoio à obra intradomiciliar."
            naoPermite="Extrapolar para o Brasil: municípios que não informaram ficam fora da soma, e informar zero é diferente de não informar."
          />
        </Secao>

        <Secao
          id="estacoes"
          titulo="Estações de tratamento declaradas"
          texto="Cadastro de estações de tratamento de esgoto (ETEs) informadas pelos prestadores ao SINISA 2024, com nível de tratamento, capacidade e volume tratado quando informados."
        >
          <Numeros
            colunas={3}
            itens={[
              {
                rotulo: "Estações declaradas em operação",
                valor: inteiro(operando.length),
                contexto: <>De {inteiro(todas.length)} estações cadastradas; {inteiro(todas.length - operando.length)} declaradas fora de operação.</>,
              },
              {
                rotulo: "Em operação sem nível de tratamento informado",
                valor: inteiro(semNivel),
                contexto: <>{numero(razaoPct(semNivel, operando.length), 1)}% das estações em operação.</>,
              },
              {
                rotulo: "Com volume tratado declarado acima da capacidade nominal",
                valor: inteiro(acima100),
                contexto: (
                  <>
                    Entre {inteiro(util.length)} estações com volume e capacidade informados. Inclui sobrecarga real e prováveis erros de unidade ou de
                    capacidade desatualizada.
                  </>
                ),
              },
            ]}
          />
          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
            <GraficoBarras
              titulo="Estações em operação por nível de tratamento informado"
              dados={porNivel}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "v", rotulo: "estações", cor: "var(--cor-obee)" }]}
              unidade="estações"
              casas={0}
              orientacao="horizontal"
              rotulosValor
            />
            <GraficoBarras
              titulo="Estações em operação por UF"
              dados={etesUf}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "v", rotulo: "estações", cor: "var(--escala-seq-4)" }]}
              unidade="estações"
              casas={0}
              orientacao="horizontal"
              limiteInicial={12}
            />
          </div>
          {histUtil && (
            <div className="mt-10">
              <Histograma
                titulo="Utilização da capacidade nominal das estações em operação"
                dados={histUtil}
                rotuloX="Volume tratado sobre a capacidade nominal"
                unidade="%"
                casas={0}
                contagem={{ singular: "estação", plural: "estações" }}
                periodo="2024"
                nota={`Utilização calculada pelo Observatório: volume tratado no ano (GTE2119) ÷ capacidade nominal (GTE2111, L/s) convertida para o ano. ${inteiro(foraGrafico)} estações acima de 200% ficam fora do gráfico e permanecem no CSV. Cada estação conta uma vez.`}
              />
            </div>
          )}
          <Ressalva
            permite="Saber quantas estações cada UF declara, com que nível de tratamento e quão perto da capacidade operam."
            naoPermite="Avaliar a qualidade do efluente nem o cumprimento de licença ambiental: o SINISA não traz monitoramento do lançamento, e a eficiência de remoção é declarada por poucas estações."
          />
          <Nota>
            As coordenadas geográficas do cadastro de estações vêm com latitude e longitude aparentemente trocadas em parte dos registros; por isso o
            Observatório não publica mapa de estações nesta entrega.{" "}
            <a className="text-obee-dark underline underline-offset-2" href={`${URL_GOLD}/etes.csv`} download>
              Baixar o cadastro de estações (CSV)
            </a>
            .
          </Nota>
          <Fonte>Ministério das Cidades, SINISA 2025 (ano de referência 2024), planilha de estações de tratamento de esgoto.</Fonte>
        </Secao>
      </main>
    </>
  );
}
