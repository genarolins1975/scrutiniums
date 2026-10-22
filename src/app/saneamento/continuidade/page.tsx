import type { Metadata } from "next";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import { Abertura, Fonte, NestaPagina, Nota, Numeros, Ressalva, Secao } from "@/components/saneamento/Editorial";
import { TabelaDados } from "@/components/saneamento/TabelaDados";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { FiguraJmp, MundoNoCapitulo } from "@/components/saneamento/ReferenciaMundial";
import { agregado, agregados, fichas, meta, municipios } from "@/lib/saneamento/gold";
import { capituloPorSlug, ROTA } from "@/lib/saneamento/capitulos";
import { razaoPct } from "@/lib/saneamento/municipios";
import { inteiro, numero } from "@/lib/saneamento/formato";
import { Qualidade } from "./Qualidade";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "A água chega regularmente e com qualidade monitorada?",
  description:
    "Paralisações, racionamento e rodízio declarados ao SINISA 2024, e qualidade da água no SISAGUA (controle do prestador, vigilância da saúde e plano de amostragem), 2024 e 2025, por UF e por município.",
  alternates: { canonical: "/saneamento/continuidade" },
};

export default function Pagina() {
  const cap = capituloPorSlug("continuidade")!;
  const br = agregado("BR");
  const c = br?.continuidade;
  const ufs = agregados().filter((a) => a.tipo === "UF");
  const pop = new Map(municipios().map((m) => [m.id, m]));

  const porUf = ufs
    .map((u) => ({
      id: u.id,
      rotulo: u.nome,
      pctInterrupcoes: razaoPct(u.continuidade.municipios_com_interrupcoes, u.continuidade.municipios_participantes),
    }))
    .sort((a, b) => (b.pctInterrupcoes ?? 0) - (a.pctInterrupcoes ?? 0));

  const tabelaUf = ufs.map((u) => {
    const k = u.continuidade;
    return {
      uf: u.nome,
      participantes: k.municipios_participantes,
      com_interrupcoes: k.municipios_com_interrupcoes,
      pct: razaoPct(k.municipios_com_interrupcoes, k.municipios_participantes),
      paralisacoes: k.paralisacoes,
      duracao_par: k.paralisacoes ? (k.horas_paralisacoes ?? 0) / k.paralisacoes : null,
      interrupcoes: k.interrupcoes_sistematicas,
      duracao_int: k.interrupcoes_sistematicas ? (k.horas_interrupcoes ?? 0) / k.interrupcoes_sistematicas : null,
    };
  });

  const linhasMun = fichas()
    .filter((f) => (f.sinisa.agua.tecnica?.GTA3003 ?? 0) > 0)
    .map((f) => {
      const t = f.sinisa.agua.tecnica ?? {};
      return {
        municipio: f.nome,
        uf: f.uf,
        href: `${ROTA}/municipio/${f.id}`,
        moradores: pop.get(f.id)?.pop22 ?? null,
        interrupcoes: t.GTA3003 ?? null,
        horas: t.GTA3008 ?? null,
        duracao: t.GTA3003 ? (t.GTA3008 ?? 0) / t.GTA3003 : null,
        economias: t.GTA3005 ?? null,
        motivo: f.sinisa.agua.motivo_interrupcoes ?? null,
      };
    });

  return (
    <>
      <header>
        <CabecalhoPlataforma colecao="saneamento" destinoConta="/saneamento" />
        <NavegacaoColecao colecao="saneamento" />
      </header>
      <MarcaVisita secao="saneamento:continuidade" />
      <main id="conteudo" className="ed-pagina pb-20 pt-8">
        <Abertura
          capitulo={3}
          titulo={cap.pergunta}
          texto={
            <p>
              Ter rede não garante água na torneira. Os prestadores declaram ao SINISA quantas paralisações com falta de água ocorreram e quantas
              interrupções sistemáticas, com racionamento ou rodízio, houve no ano, com duração e economias atingidas.
              São declarações do prestador, sem auditoria do SINISA. A qualidade da água vem de outra base, o SISAGUA, do Ministério da Saúde,
              com o controle do prestador e a vigilância das secretarias de saúde em registros separados.
            </p>
          }
          recorte={
            <>
              Continuidade: {inteiro(c?.municipios_participantes)} municípios do módulo de água do SINISA 2024 (ano de referência). Qualidade: análises
              do SISAGUA de 2024 e 2025 nos {inteiro(meta()?.sisagua.por_ano["2024"]?.municipios.universo)} municípios do IBGE.
            </>
          }
          situacao={cap.situacao}
          pendencia={cap.pendencia}
        />
        <NestaPagina
          itens={[
            { id: "por-uf", rotulo: "Racionamento por UF" },
            { id: "municipios", rotulo: "Municípios com racionamento" },
            { id: "mundo", rotulo: "No mundo" },
            { id: "qualidade", rotulo: "Monitoramento da qualidade" },
            { id: "qualidade-resultados", rotulo: "O que os registros mostram" },
            { id: "qualidade-procedencia", rotulo: "E. coli na vigilância" },
            { id: "qualidade-atlas", rotulo: "Atlas da qualidade" },
            { id: "qualidade-plano", rotulo: "Análises exigidas" },
            { id: "qualidade-populacao", rotulo: "População com controle" },
            { id: "qualidade-quimica", rotulo: "Substâncias químicas" },
            { id: "qualidade-serie", rotulo: "Evolução desde 2014" },
            { id: "qualidade-uf", rotulo: "Qualidade por UF" },
            { id: "qualidade-conferencia", rotulo: "Conferência dos registros" },
          ]}
        />

        <Numeros
          colunas={4}
          itens={[
            {
              rotulo: "Paralisações com falta de água",
              valor: inteiro(c?.paralisacoes),
              contexto: <>Duração média de {numero(br?.sinisa.agua.indicadores.IAG3004, 1)} horas (IAG3004), SINISA 2024.</>,
            },
            {
              rotulo: "Interrupções sistemáticas (racionamento ou rodízio)",
              valor: inteiro(c?.interrupcoes_sistematicas),
              contexto: <>Duração média de {numero(br?.sinisa.agua.indicadores.IAG3005, 1)} horas (IAG3005).</>,
            },
            {
              rotulo: "Municípios com ao menos uma interrupção sistemática",
              valor: inteiro(c?.municipios_com_interrupcoes),
              contexto: <>{numero(razaoPct(c?.municipios_com_interrupcoes, c?.municipios_participantes), 1)}% dos municípios do módulo.</>,
            },
            {
              rotulo: "Municípios com dias de colapso do sistema declarados",
              valor: inteiro(c?.municipios_com_colapso),
              contexto: (
                <>
                  {inteiro(c?.dias_colapso)} dias somados; {inteiro(c?.municipios_informaram_colapso)} municípios informaram o campo.{" "}
                  <a className="text-obee-dark underline underline-offset-2" href={`${ROTA}/resiliencia`}>
                    Ver capítulo 14
                  </a>
                  .
                </>
              ),
            },
          ]}
        />
        <Nota titulo="Economias atingidas não são domicílios distintos">
          O SINISA soma as economias atingidas em cada evento. Uma casa afetada por dez paralisações conta dez vezes: por isso o total nacional
          declarado ({inteiro(c?.economias_atingidas_paralisacoes)} economias em paralisações) supera o número de economias existentes. O Observatório
          não converte esse total em pessoas.
        </Nota>

        <Secao
          id="por-uf"
          titulo="Onde o racionamento é mais frequente?"
          texto="Proporção dos municípios do módulo de água em que o prestador declarou ao menos uma interrupção sistemática em 2024."
        >
          <GraficoBarras
            titulo="Municípios com interrupção sistemática declarada, por UF (% dos municípios do módulo)"
            dados={porUf.map((u) => ({ id: u.id, rotulo: u.rotulo, v: u.pctInterrupcoes }))}
            chaveCategoria="id"
            chaveRotulo="rotulo"
            series={[{ id: "v", rotulo: "%", cor: "var(--escala-seq-4)" }]}
            unidade="%"
            casas={1}
            orientacao="horizontal"
            referencias={[{ valor: razaoPct(c?.municipios_com_interrupcoes, c?.municipios_participantes) ?? 0, rotulo: "Brasil" }]}
            limiteInicial={14}
          />
          <div className="mt-10">
            <TabelaDados
              titulo="Continuidade por UF"
              arquivo="saneamento-continuidade-uf-2024.csv"
              colunas={[
                { id: "uf", rotulo: "UF" },
                { id: "participantes", rotulo: "Municípios no módulo", tipo: "inteiro" },
                { id: "com_interrupcoes", rotulo: "Com interrupção sistemática", tipo: "inteiro" },
                { id: "pct", rotulo: "% dos municípios", tipo: "pct" },
                { id: "paralisacoes", rotulo: "Paralisações", tipo: "inteiro" },
                { id: "duracao_par", rotulo: "Horas por paralisação", tipo: "numero" },
                { id: "interrupcoes", rotulo: "Interrupções sistemáticas", tipo: "inteiro" },
                { id: "duracao_int", rotulo: "Horas por interrupção", tipo: "numero" },
              ]}
              linhas={tabelaUf}
              limite={27}
              busca={false}
              ordemInicial={{ coluna: "pct", direcao: "desc" }}
              rotuloLinhas={{ singular: "UF", plural: "UFs" }}
            />
          </div>
          <Ressalva
            permite="Ver onde os prestadores declaram racionamento ou rodízio e por quanto tempo, em média, cada evento dura."
            naoPermite="Comparar a qualidade do serviço entre UFs com segurança: o registro de eventos depende do controle de cada prestador, e quem não registra aparece com zero."
          />
          <Fonte>
            Ministério das Cidades, SINISA 2025 (ano de referência 2024), base municipal de água: GTA3001, GTA3003, GTA3005, GTA3006, GTA3007 e
            GTA3008. Horas por evento = soma das horas ÷ soma dos eventos, a mesma fórmula do IAG3004 e do IAG3005.
          </Fonte>
        </Secao>

        <Secao
          id="municipios"
          titulo="Em quais municípios houve racionamento ou rodízio?"
          texto="Todos os municípios com interrupção sistemática declarada em 2024, com o motivo informado pelo prestador. Ordenados pelo número de interrupções."
        >
          <TabelaDados
            titulo="Municípios com interrupção sistemática"
            arquivo="saneamento-interrupcoes-sistematicas-2024.csv"
            colunas={[
              { id: "municipio", rotulo: "Município", href: "href" },
              { id: "uf", rotulo: "UF" },
              { id: "moradores", rotulo: "Moradores (Censo 2022)", tipo: "inteiro" },
              { id: "interrupcoes", rotulo: "Interrupções", tipo: "inteiro" },
              { id: "duracao", rotulo: "Horas por interrupção", tipo: "numero" },
              { id: "economias", rotulo: "Economias atingidas (soma por evento)", tipo: "inteiro" },
              { id: "motivo", rotulo: "Motivo declarado" },
            ]}
            linhas={linhasMun}
            ordemInicial={{ coluna: "interrupcoes", direcao: "desc" }}
            rotuloLinhas={{ singular: "município", plural: "municípios" }}
          />
          <Ressalva
            permite="Localizar os municípios com racionamento declarado e o motivo informado."
            naoPermite="Ordenar municípios por desempenho: o número de eventos depende de como cada prestador registra, e municípios grandes tendem a ter mais setores e mais eventos."
          />
        </Secao>

        <Secao
          id="mundo"
          titulo="Água disponível e sem contaminação: como fica o Brasil no mundo?"
          texto="Dois dos componentes que o JMP exige para chamar a água de gerenciada com segurança: estar disponível quando necessária e livre de contaminação. São estimativas por país, com fontes próprias, e não substituem as declarações ao SINISA nem as análises do SISAGUA desta página."
        >
          <MundoNoCapitulo>
            <FiguraJmp campo="disponivel" />
            <FiguraJmp campo="sem_contaminacao" />
          </MundoNoCapitulo>
        </Secao>

        <Qualidade />
      </main>
    </>
  );
}
