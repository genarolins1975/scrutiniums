import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, Fonte, NestaPagina, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { AtlasMunicipal } from "@/components/saneamento/AtlasMunicipal";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { FiguraOds, MundoNoCapitulo } from "@/components/saneamento/ReferenciaMundial";
import { agregado, agregados, meta, municipios } from "@/lib/saneamento/gold";
import { referencias } from "@/lib/saneamento/referencias";
import { capituloPorSlug } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { data, inteiro, numero } from "@/lib/saneamento/formato";
import { medida } from "@/lib/saneamento/medidas";
import { ATENDIMENTO_REDE, CASAS_ATENDIMENTO } from "@/lib/saneamento/atendimento";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Quantas pessoas ainda estão sem atendimento adequado?",
  description:
    "Moradores sem ligação à rede de água e sem rede de esgoto nos 5.570 municípios, pelo Censo 2022, e população não atendida declarada pelos prestadores ao SINISA 2024.",
  alternates: { canonical: "/saneamento/acesso" },
};

const ATLAS = [
  "c22-agua-sem-ligacao",
  "c22-esgoto-sem-rede-nem-septica",
  "c22-esgoto-sem-rede",
  "c22-agua-ligacao-outra-fonte",
  "sinisa-agua-atendida",
  "sinisa-esgoto-atendida",
  "sinisa-agua-nao-atendida",
  "sinisa-esgoto-nao-atendida",
  "evolucao-agua-rede",
  "evolucao-esgoto-rede",
];

const FONTES_AGUA: [string, string, string][] = [
  ["poco_profundo", "Poço profundo ou artesiano", "var(--serie-comp-4)"],
  ["poco_raso", "Poço raso, freático ou cacimba", "var(--serie-comp-1)"],
  ["nascente", "Fonte, nascente ou mina", "var(--serie-comp-3)"],
  ["carro_pipa", "Carro-pipa", "var(--serie-comp-2)"],
  ["chuva", "Água da chuva armazenada", "var(--escala-seq-3)"],
  ["rio", "Rios, açudes, córregos, lagos e igarapés", "var(--san-div-neg-2)"],
  ["outra", "Outra", "var(--serie-2)"],
];

export default function Pagina() {
  const cap = capituloPorSlug("acesso")!;
  const m = meta();
  const ags = agregados();
  const br = agregado("BR");
  const lista = municipios();
  const refs = referencias(ags, lista, ATLAS);
  const ufs = ags.filter((a) => a.tipo === "UF");
  const nomesUf = Object.fromEntries(ufs.map((u) => [u.id, u.nome]));
  const mor = br?.censo2022.moradores;
  const semRedeNemSeptica = mor?.esgoto.sem_rede_nem_septica ?? null;
  const naoAt = br ? (br.cobertura_sinisa.agua_dfe0001 ?? 0) - (br.sinisa.agua.pop_atendida ?? 0) : null;

  const porUf = ufs
    .map((u) => ({
      id: u.id,
      rotulo: u.nome,
      pessoas: u.censo2022.moradores?.agua.sem_ligacao ?? null,
      pct: razaoPct(u.censo2022.moradores?.agua.sem_ligacao, u.censo2022.moradores?.agua.total),
      esPessoas: u.censo2022.moradores?.esgoto.sem_rede_nem_septica ?? null,
      esPct: razaoPct(u.censo2022.moradores?.esgoto.sem_rede_nem_septica, u.censo2022.moradores?.esgoto.total),
    }))
    .sort((a, b) => (b.pessoas ?? 0) - (a.pessoas ?? 0));

  const evolucao = ufs.map((u) => ({
    id: u.id,
    rotulo: u.nome,
    valor: razaoPct(u.censo2022.moradores?.agua.rede, u.censo2022.moradores?.agua.total),
    referencia: razaoPct(u.censo2010?.agua_rede, u.censo2010?.moradores),
  }));
  const evolucaoEsgoto = ufs.map((u) => ({
    id: u.id,
    rotulo: u.nome,
    valor: razaoPct(u.censo2022.moradores?.esgoto.rede_pluvial, u.censo2022.moradores?.esgoto.total),
    referencia: razaoPct(u.censo2010?.esgoto_rede_pluvial, u.censo2010?.esgoto_moradores),
  }));

  // População atendida com rede declarada pelos prestadores (IAG0001 e IES0001), consolidado oficial por UF, na ordem do atendimento de água
  const atendimentoUf = ufs
    .map((u) => ({ id: u.id, rotulo: u.nome, agua: u.sinisa.agua.indicadores.IAG0001 ?? null, esgoto: u.sinisa.esgoto.indicadores.IES0001 ?? null }))
    .sort((a, b) => (b.agua ?? -1) - (a.agua ?? -1) || a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  const composicao = [br!, ...ufs].map((a) => {
    const f = a.censo2022.moradores?.agua.sem_ligacao_fontes;
    const tot = a.censo2022.moradores?.agua.sem_ligacao ?? null;
    const linha: Record<string, string | number | null> = { id: a.id, rotulo: a.id === "BR" ? "Brasil" : a.nome };
    for (const [k] of FONTES_AGUA) linha[k] = razaoPct(f?.[k as keyof typeof f] ?? null, tot);
    return linha;
  });

  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:acesso" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={1}
          titulo={cap.pergunta}
          texto={
            <p>
              Duas fontes respondem de jeitos diferentes. O Censo 2022 pergunta a cada domicílio como chega a água e para onde vai o esgoto.
              O SINISA 2024 reúne o que os prestadores declaram sobre a população que atendem com rede. Os números ficam lado a lado, nunca
              somados, porque a população, o ano e o conceito são outros.
            </p>
          }
          recorte={
            <>
              5.570 municípios no Censo 2022 (moradores em domicílios particulares permanentes ocupados).{" "}
              {m ? `${inteiro(m.cobertura.agua_participantes)} municípios no módulo de água e ${inteiro(m.cobertura.esgoto_participantes)} com indicadores de esgoto no SINISA 2024` : ""}{" "}
              (população estimada pelo IBGE para 2024).
            </>
          }
        />
        <NestaPagina
          itens={[
            { id: "atlas", rotulo: "Onde faltam" },
            { id: "atendimento-declarado", rotulo: "Atendidos com rede" },
            { id: "pessoas-ou-proporcao", rotulo: "Pessoas ou proporção" },
            { id: "sem-rede-usa", rotulo: "Quem não tem rede usa o quê" },
            { id: "evolucao", rotulo: "Evolução entre os Censos" },
            { id: "mundo", rotulo: "No mundo" },
            { id: "conceitos", rotulo: "Conceitos" },
          ]}
        />

        <Numeros
          colunas={4}
          itens={[
            {
              rotulo: "Moradores sem ligação à rede geral de água",
              valor: inteiro(mor?.agua.sem_ligacao),
              contexto: <>Censo 2022 · {numero(razaoPct(mor?.agua.sem_ligacao, mor?.agua.total), 1)}% dos {inteiro(mor?.agua.total)} moradores. Inclui quem usa poço profundo ou cisterna.</>,
            },
            {
              rotulo: "Ligados à rede, mas com outra fonte principal",
              valor: inteiro(mor?.agua.lig_outra),
              contexto: <>Censo 2022 · {numero(razaoPct(mor?.agua.lig_outra, mor?.agua.total), 1)}% dos moradores.</>,
            },
            {
              rotulo: "Moradores sem rede de esgoto nem fossa séptica",
              valor: inteiro(semRedeNemSeptica),
              contexto: <>Censo 2022 · {numero(razaoPct(semRedeNemSeptica, mor?.esgoto.total), 1)}%: fossa rudimentar, vala, rio, lago ou mar, outra forma ou sem banheiro.</>,
            },
            {
              rotulo: "Não atendidos por rede de água, segundo os prestadores",
              valor: inteiro(naoAt),
              contexto: (
                <>
                  SINISA 2024 · {numero(100 - (br?.sinisa.agua.indicadores.IAG0001 ?? NaN), 2)}% da população dos {inteiro(br?.cobertura_sinisa.agua_participantes)} municípios do
                  módulo (IAG0001 = {numero(br?.sinisa.agua.indicadores.IAG0001, 2)}%).
                </>
              ),
            },
          ]}
        />
        <Nota titulo="Por que os números não se somam">
          Quem está sem água e quem está sem esgoto pode ser a mesma pessoa. Contar a privação simultânea exige microdados ou uma tabulação que
          cruze as duas perguntas; o Censo 2022 não publicou esse cruzamento por município. Por isso o Observatório não soma as carências.
        </Nota>

        <Secao
          id="atlas"
          titulo="Onde faltam água e esgoto, em pessoas e em proporção?"
          texto="Escolha a medida, alterne entre proporção e número de pessoas e localize o município. A referência da UF e do Brasil vem da tabulação oficial de cada nível, não de média de percentuais municipais."
        >
          <AtlasMunicipal ids={ATLAS} referencias={refs} nomesUf={nomesUf} titulo="Atlas municipal de carência de água e esgoto" />
          <Fonte>
            IBGE, Censo Demográfico 2022, tabelas SIDRA 6894 e 7555; Censo 2010, tabelas 3217 e 3216; Ministério das Cidades, SINISA 2025
            (ano de referência 2024), base municipal com retificação de água de 25/05/2026. Malha municipal do IBGE.
          </Fonte>
        </Secao>

        <Secao
          id="atendimento-declarado"
          titulo="Quanto da população a rede atende, segundo os prestadores?"
          texto="A população que cada prestador declara atender com rede de água e com rede coletora de esgoto, dividida pela população estimada pelo IBGE para 2024. Mede quem o prestador declara atender, não quem falta, e não se soma ao Censo."
        >
          <Numeros
            colunas={2}
            itens={[
              {
                rotulo: `${ATENDIMENTO_REDE.agua.rotulo} (IAG0001), Brasil, 2024`,
                valor: `${numero(br?.sinisa.agua.indicadores.IAG0001, CASAS_ATENDIMENTO)}%`,
                contexto: (
                  <>
                    {inteiro(br?.sinisa.agua.pop_atendida)} pessoas atendidas declaradas, de {inteiro(br?.cobertura_sinisa.agua_dfe0001)} residentes dos{" "}
                    {inteiro(br?.cobertura_sinisa.agua_participantes)} municípios do módulo de água. Fórmula: {ATENDIMENTO_REDE.agua.formula}.
                  </>
                ),
              },
              {
                rotulo: `${ATENDIMENTO_REDE.esgoto.rotulo} (IES0001), Brasil, 2024`,
                valor: `${numero(br?.sinisa.esgoto.indicadores.IES0001, CASAS_ATENDIMENTO)}%`,
                contexto: (
                  <>
                    {inteiro(br?.sinisa.esgoto.pop_atendida)} pessoas atendidas declaradas, de {inteiro(br?.cobertura_sinisa.esgoto_dfe0001)} residentes no
                    consolidado de esgoto, que inclui os {inteiro(br?.cobertura_sinisa.esgoto_delegacao_sem_atendimento)} municípios com delegação sem
                    atendimento. Fórmula: {ATENDIMENTO_REDE.esgoto.formula}.
                  </>
                ),
              },
            ]}
          />
          <div className="mt-8">
            <GraficoBarras
              titulo="População atendida com rede de água (IAG0001) e com rede coletora de esgoto (IES0001), por UF (% da população estimada, 2024)"
              dados={atendimentoUf}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[
                { id: "agua", rotulo: "Rede de água (IAG0001)", cor: "var(--cor-obee)" },
                { id: "esgoto", rotulo: "Rede coletora de esgoto (IES0001)", cor: "var(--serie-comp-3)" },
              ]}
              unidade="%"
              casas={1}
              orientacao="horizontal"
              limiteInicial={12}
            />
          </div>
          <Ressalva permite={medida(ATENDIMENTO_REDE.agua.medida).permite} naoPermite={medida(ATENDIMENTO_REDE.agua.medida).naoPermite} />
          <Nota>
            Esgoto: {medida(ATENDIMENTO_REDE.esgoto.medida).naoPermite} No atlas acima, as duas medidas aparecem por município, em percentual e em
            pessoas atendidas.
          </Nota>
          <Fonte>
            Ministério das Cidades, SINISA 2025 (ano de referência 2024), consolidado por UF e base municipal com retificação de água de{" "}
            {data(m?.sinisa.retificacao_agua_municipal)}; população residente estimada pelo IBGE para 2024 (DFE0001).
          </Fonte>
        </Secao>

        <Secao
          id="pessoas-ou-proporcao"
          titulo="O problema é maior em número de pessoas ou em proporção?"
          texto="As UFs com mais moradores sem ligação à rede de água não são, necessariamente, as de maior proporção. As duas leituras orientam decisões diferentes."
        >
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <GraficoBarras
              titulo="Moradores sem ligação à rede geral de água, por UF (Censo 2022)"
              dados={porUf.map((u) => ({ id: u.id, rotulo: u.rotulo, v: u.pessoas }))}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "v", rotulo: "moradores", cor: "var(--cor-obee)" }]}
              unidade="moradores"
              casas={0}
              orientacao="horizontal"
              limiteInicial={12}
            />
            <GraficoBarras
              titulo="Proporção dos moradores sem ligação à rede geral de água, por UF (Censo 2022)"
              dados={[...porUf].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)).map((u) => ({ id: u.id, rotulo: u.rotulo, v: u.pct }))}
              chaveCategoria="id"
              chaveRotulo="rotulo"
              series={[{ id: "v", rotulo: "%", cor: "var(--escala-seq-4)" }]}
              unidade="%"
              casas={1}
              orientacao="horizontal"
              referencias={[{ valor: razaoPct(mor?.agua.sem_ligacao, mor?.agua.total) ?? 0, rotulo: "Brasil" }]}
              limiteInicial={12}
            />
          </div>
          <Ressalva
            permite="Comparar UFs pelo contingente e pela proporção da mesma medida, com o mesmo universo."
            naoPermite="Ordenar UFs por qualidade de gestão: a medida descreve acesso à rede, não desempenho de governo ou prestador."
          />
        </Secao>

        <Secao
          id="sem-rede-usa"
          titulo="Quem não tem ligação à rede usa o quê?"
          texto="Ausência de rede não é ausência de solução. Em parte do país, poço profundo e cisterna são a fonte principal; em outras, carro-pipa e rios. O gráfico mostra a composição dos moradores sem ligação, por fonte principal."
        >
          <GraficoBarras
            titulo="Fonte principal dos moradores sem ligação à rede geral de água (Censo 2022, % dos sem ligação)"
            dados={composicao}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={FONTES_AGUA.map(([id, rotulo, cor]) => ({ id, rotulo, cor }))}
            unidade="%"
            casas={1}
            orientacao="horizontal"
            empilhado
          />
          <Ressalva
            permite="Ver de que fonte depende quem está fora da rede e onde predominam fontes de maior risco de interrupção."
            naoPermite="Afirmar potabilidade: o Censo não mede qualidade da água, tratamento nem regularidade de nenhuma fonte."
          />
        </Secao>

        <Secao
          id="evolucao"
          titulo="Como a carência evoluiu entre os Censos?"
          texto="Proporção de moradores com a rede geral como forma principal de abastecimento e com rede geral de esgoto ou pluvial, em 2010 e 2022, por UF. A categoria é aproximada entre os dois questionários, não idêntica."
        >
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <GraficoPontos
              titulo="Rede geral de água como forma principal (% dos moradores)"
              itens={evolucao}
              unidade="%"
              casas={1}
              rotuloValor="2022"
              rotuloReferencia="2010"
              unidadeDiferenca="p.p."
              ordemInicial={{ por: "diferenca", direcao: "desc" }}
              textoSentido={{ acima: "acima de 2010", abaixo: "abaixo de 2010", igual: "igual a 2010" }}
            />
            <GraficoPontos
              titulo="Rede geral de esgoto ou pluvial (% dos moradores)"
              itens={evolucaoEsgoto}
              unidade="%"
              casas={1}
              rotuloValor="2022"
              rotuloReferencia="2010"
              unidadeDiferenca="p.p."
              ordemInicial={{ por: "diferenca", direcao: "desc" }}
              textoSentido={{ acima: "acima de 2010", abaixo: "abaixo de 2010", igual: "igual a 2010" }}
            />
          </div>
          <Ressalva
            permite="Comparar a mesma categoria nos dois Censos, em pontos percentuais, por UF; no atlas, por município."
            naoPermite="Atribuir a mudança a uma política. Em esgoto, 2022 separa a fossa ligada à rede, que fica fora desta comparação; 2010 usa domicílios particulares permanentes e 2022, os ocupados."
          />
        </Secao>

        <Secao
          id="mundo"
          titulo="Como o Brasil se compara no mundo?"
          texto="O JMP, da OMS e do UNICEF, estima para cada país a população com água e esgotamento gerenciados com segurança, com a mesma definição. É outra pergunta que a do Censo e a do SINISA, por isso aparece ao lado, nunca somada."
        >
          <MundoNoCapitulo>
            <FiguraOds codigo="SH_H2O_SAFE" titulo="Água gerenciada com segurança" />
            <FiguraOds codigo="SH_SAN_SAFE" titulo="Esgotamento gerenciado com segurança" />
          </MundoNoCapitulo>
        </Secao>

        <Secao
          id="conceitos"
          titulo="Rede disponível, ligação efetiva e atendimento declarado"
          texto="Três coisas diferentes, medidas por fontes diferentes."
        >
          <dl className="grid grid-cols-1 max-w-5xl gap-x-10 gap-y-6 text-sm leading-relaxed md:grid-cols-3">
            <div>
              <dt className="font-medium text-carvao">Rede disponível sem ligação</dt>
              <dd className="mt-1 text-carvao-muted">
                Imóveis com rede na frente que não se ligaram (conexões factíveis). Os prestadores declararam {inteiro(br?.factiveis.agua.imoveis)} imóveis em
                água ({inteiro(br?.factiveis.agua.municipios_informantes)} municípios informantes) e {inteiro(br?.factiveis.esgoto.imoveis)} em esgoto (
                {inteiro(br?.factiveis.esgoto.municipios_informantes)} municípios). SINISA 2024, GTA0007 e GTE0005; quem não informou fica fora da soma.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-carvao">Ligação ao domicílio</dt>
              <dd className="mt-1 text-carvao-muted">
                O que o morador declarou ao Censo: se o domicílio tem ligação à rede geral e se ela é a forma principal. Mede o domicílio, não o
                prestador.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-carvao">Atendimento declarado</dt>
              <dd className="mt-1 text-carvao-muted">
                A população que o prestador informa atender com rede (GTA0001 e GTA0002), dividida pela população estimada (DFE0001). Não é
                verificado domicílio a domicílio pelo SINISA.
              </dd>
            </div>
          </dl>
          <Fonte>IBGE, Censo 2022; Ministério das Cidades, SINISA 2025, base municipal.</Fonte>
        </Secao>
      </main>
    </>
  );
}
