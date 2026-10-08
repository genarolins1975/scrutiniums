import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { CabecalhoModulo, Bloco } from "@/components/energia/CabecalhoModulo";
import { ContaComposicao } from "@/components/energia/ContaComposicao";
import { ContaHistorico } from "@/components/energia/ContaHistorico";
import { ContaLinkFiltros } from "@/components/energia/ContaLinkPainel";
import { ContaSimulador } from "@/components/energia/ContaSimulador";
import { ContaSobDemanda } from "@/components/energia/ContaSobDemanda";
import { ContaTarifas } from "@/components/energia/ContaTarifas";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import {
  linhasEvolucao,
  mudancaComposicao,
  mudancaTarifa,
  respostaBandeira,
  respostaCde,
  respostaComposicao,
  respostaReajustes,
  respostaSubsidios,
  minuscula,
  rotuloDistribuidora,
  vereditoBandeira,
  vereditoComposicao,
  vereditoReajustes,
  vereditoSubsidios,
} from "@/lib/energia/conta";
import { carimbo, dataBR, mesAno, num, reais } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import type { ColunaTabela } from "@/lib/energia/tabela";
import type { ContaGold } from "@/lib/energia/tipos-conta";
import { Auditoria, FONTE_TARIFAS, ROTA_REAJUSTES, Recorte, Seguir } from "./partes";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Conta de luz: tarifas, composição, simulador e reajustes",
  description:
    "Tarifa B1 residencial de aplicação de cada distribuidora (ANEEL), custo de perfis de consumo comparáveis, composição da tarifa, simulador sem tributos, variação contra o IPCA, bandeiras, subsídios tarifários e orçamento da CDE.",
  alternates: { canonical: "/setor-eletrico/conta-de-luz" },
};

const COLUNAS_SEM_VIGENTE: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
  { id: "inicio", rotulo: "Início da última vigência", tipo: "data" },
  { id: "fim", rotulo: "Fim da última vigência", tipo: "data" },
  { id: "ato", rotulo: "Ato", tipo: "texto" },
  { id: "dias", rotulo: "Dias sem tarifa", tipo: "numero", casas: 0 },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "motivo", rotulo: "Motivo", tipo: "texto" },
];

const COLUNAS_ATIPICAS: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "codigo", rotulo: "Componente", tipo: "texto", categorica: true },
  { id: "valor", rotulo: "Valor", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "pct", rotulo: "Da tarifa", tipo: "percentual", casas: 1 },
  {
    id: "mediana",
    rotulo: "Mediana do módulo",
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
  { id: "grupo_codigo", rotulo: "Grupo pelo código", tipo: "texto" },
  { id: "grupo_usado", rotulo: "Grupo usado", tipo: "texto" },
  { id: "criterios", rotulo: "Critério", tipo: "texto" },
];

const COLUNAS_CASOS: ColunaTabela[] = [
  { id: "classe", rotulo: "Classe", tipo: "texto", categorica: true },
  { id: "kwh", rotulo: "Consumo", tipo: "numero", unidade: "kWh", casas: 0 },
  { id: "ligacao", rotulo: "Ligação", tipo: "texto", categorica: true },
  { id: "bandeira", rotulo: "Bandeira", tipo: "texto", categorica: true },
  {
    id: "total",
    rotulo: "Estimativa",
    tipo: "numero",
    unidade: "R$/mês",
    casas: 2,
  },
  {
    id: "parcela_bandeira",
    rotulo: "Parcela da bandeira",
    tipo: "numero",
    unidade: "R$/mês",
    casas: 2,
  },
];

export default function ContaDeLuzPage() {
  const g = lerGold<ContaGold>("conta.json");
  if (!integra(g)) {
    return (
      <>
        <CabecalhoEnergia atual="conta-de-luz" />
        <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6 py-14">
          <Indisponivel
            titulo="Conta de luz indisponível nesta publicação"
            motivo={
              g?.motivo ??
              "A gold do módulo Conta de luz (public/energia/gold/conta.json) não foi gerada ou não passou na validação; a última publicação válida é mantida quando existe."
            }
          />
        </main>
      </>
    );
  }

  const t = g.tarifas;
  const comp = g.composicao;
  const sim = g.simulador;
  const reaj = g.reajustes;
  const band = g.bandeiras;
  const sub = g.subsidios;
  const cde = g.financiamento_cde;
  const ref = g.data_referencia;
  const evolucao = linhasEvolucao(t.evolucao);
  const ultimoIpca = reaj.comparacao_inflacao?.ultimo_ipca ?? null;
  const janela12 = reaj.comparacao_inflacao?.janelas.find((j) => j.meses === 12) ?? null;

  const entidades = [
    ...t.vigentes.map((v) => ({
      id: v.cnpj,
      rotulo: rotuloDistribuidora(v.sigla, v.cnpj),
      detalhe: v.nome ?? undefined,
      sinonimos: [v.cnpj],
    })),
    ...t.sem_vigente.map((v) => ({
      id: v.cnpj,
      rotulo: rotuloDistribuidora(v.sigla, v.cnpj),
      detalhe: `${v.nome ?? ""} (sem tarifa vigente)`.trim(),
      sinonimos: [v.cnpj],
    })),
  ];

  const linhasSemVigente = t.sem_vigente.map((s) => ({
    id: s.cnpj,
    sigla: rotuloDistribuidora(s.sigla, s.cnpj),
    cnpj: s.cnpj,
    inicio: s.ultima_vigencia.inicio,
    fim: s.ultima_vigencia.fim,
    ato: s.ultima_vigencia.ato,
    dias: s.dias_sem_tarifa,
    situacao: s.incorporada_por ? "incorporada" : s.dias_sem_tarifa <= 90 ? "vigência encerrada há até 90 dias" : "sem tarifa há mais de 90 dias",
    motivo: s.motivo,
  }));

  const rotuloGrupo = new Map(comp.grupos.map((x) => [x.id, x.rotulo]));
  const linhasAtipicas = comp.componentes_atipicas.map((a) => ({
    id: `${a.cnpj}|${a.codigo}`,
    sigla: rotuloDistribuidora(a.sigla, a.cnpj),
    codigo: a.codigo,
    valor: a.valor,
    pct: a.pct_tarifa,
    mediana: a.mediana_modulo_rs_mwh,
    grupo_codigo: rotuloGrupo.get(a.grupo_pelo_codigo) ?? a.grupo_pelo_codigo,
    grupo_usado: rotuloGrupo.get(a.grupo_usado) ?? a.grupo_usado,
    criterios: a.criterios.join("; "),
  }));

  const rotuloClasse = new Map(sim.classes.map((c) => [c.id, c.rotulo]));
  const linhasCasos = sim.casos_referencia.casos.map(([classe, kwh, ligacao, bandeira, total, parcela], i) => ({
    id: String(i),
    classe: rotuloClasse.get(classe) ?? classe,
    kwh,
    ligacao,
    bandeira,
    total,
    parcela_bandeira: parcela,
  }));

  return (
    <>
      <CabecalhoEnergia atual="conta-de-luz" />
      <MarcaVisita secao="energia:conta-de-luz" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-page px-6">
        <CabecalhoModulo siglas={["PLD", "REN", "ANEEL", "ONS"]}
          rotulo="Conta de luz"
          titulo="Quanto custa a energia ao consumidor e o que compõe a conta?"
          referencia={
            <>
              Tarifas de aplicação da ANEEL vigentes em {dataBR(ref)} (arquivo gerado pela fonte em {dataBR(g.gerado_pela_fonte_em)}); bandeira de{" "}
              {band.vigente ? mesAno(`${band.vigente.mes}-01`) : "mês não publicado"}; IPCA até {ultimoIpca ? mesAno(`${ultimoIpca}-01`) : "mês não publicado"}. Processado em{" "}
              {carimbo(g.gerado_em)}.
            </>
          }
        >
          A distribuidora cobra pela energia (TE) e pelo uso da rede (TUSD) os valores que a ANEEL homologa para cada área. Esta página compara essas tarifas entre distribuidoras,
          mostra do que elas são feitas e estima a conta para um consumo; a variação contra a inflação, as bandeiras e quem paga os descontos estão em{" "}
          <ContaLinkFiltros href={ROTA_REAJUSTES} className="text-energia-dark underline underline-offset-4">
            reajustes, bandeiras e subsídios
          </ContaLinkFiltros>
          . Tributos e iluminação pública ficam fora: não há base oficial estruturada que os leve à tarifa de cada distribuidora.
        </CabecalhoModulo>

        <section aria-labelledby="tres-numeros" className="pb-6">
          <h2 id="tres-numeros" className="sr-only">
            Três números diferentes que costumam ser chamados de conta de luz
          </h2>
          <ul className="grid gap-px border border-linha bg-linha md:grid-cols-3">
            <li className="bg-superficie p-5">
              <p className="rotulo text-mineral">Tarifa homologada (usada aqui)</p>
              <p className="mt-2 text-sm leading-relaxed text-carvao">{g.definicoes.tarifa_homologada}</p>
            </li>
            <li className="bg-superficie p-5">
              <p className="rotulo text-mineral">Tarifa média de fornecimento (não publicada)</p>
              <p className="mt-2 text-sm leading-relaxed text-carvao">{g.definicoes.tarifa_media_fornecimento}</p>
              <p className="mt-2 text-xs leading-relaxed text-carvao-muted">
                Não há base oficial estruturada com receita, energia e tributos que sirva para calcular a tarifa média; o observatório não a publica.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-carvao-muted" data-nivel="analisar">
                Motivo da coleta: {g.tarifa_media_fornecimento.motivo}
              </p>
            </li>
            <li className="bg-superficie p-5">
              <p className="rotulo text-mineral">Conta simulada (estimativa)</p>
              <p className="mt-2 text-sm leading-relaxed text-carvao">{g.definicoes.conta_simulada}</p>
            </li>
          </ul>
          <p className="mt-3 text-sm text-carvao-muted">{g.definicoes.nao_e_conta}</p>
        </section>

        <nav aria-label="Perguntas desta página" className="pb-4">
          <ol className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["#tarifa", "Quanto custa um perfil comparável?"],
              ["#composicao", "Para onde vai o valor da conta?"],
              ["#simulador", "Como minha conta varia com consumo e perfil?"],
              ["#p050", "O que mudou e quem financia os benefícios?"],
            ].map(([href, rot], i) => (
              <li key={href}>
                <a href={href} className="flex min-h-[44px] items-center gap-2 border border-linha bg-superficie px-3 py-2 text-carvao hover:border-energia">
                  <span className="rotulo text-mineral">{i + 1}</span>
                  {rot}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <ModoProfundidade>
          {/* ---------------- P047 ---------------- */}
          <Bloco id="tarifa">
            <PainelEvidencia
              id="p047"
              pergunta="Quanto custa um perfil comparável em cada distribuidora?"
              subtitulo="Tarifa B1 residencial convencional de aplicação (TE + TUSD) · R$/mês por perfil e R$/MWh"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  A <Termo slug="tarifa-te-tusd">tarifa homologada</Termo> é a parte da conta que a ANEEL fixa para cada distribuidora: o mesmo consumo custa diferente conforme a
                  área de concessão. Comparar o mesmo perfil, na mesma classe, modalidade e base, isola essa diferença.
                </>
              }
              oQueMudou={mudancaTarifa(ref, t.resumo, evolucao)}
              comoInterpretar={
                <>
                  Cada barra é uma distribuidora (subgrupo B1, residencial, modalidade convencional, tarifa de aplicação). O perfil é kWh × (TE + TUSD) ÷ 1000;{" "}
                  {Math.min(...g.perfis_kwh) >= sim.regras.custo_disponibilidade_kwh.trifasico ? "nenhum perfil fica abaixo do maior " : "há perfil abaixo do maior "}
                  <Termo slug="custo-de-disponibilidade">custo de disponibilidade</Termo> ({sim.regras.custo_disponibilidade_kwh.trifasico} kWh, ligação trifásica)
                  {Math.min(...g.perfis_kwh) >= sim.regras.custo_disponibilidade_kwh.trifasico
                    ? ", então o mínimo não muda a comparação."
                    : ": nesse perfil, o mínimo da ligação pode valer mais que o consumo, e o custo publicado não o considera."}{" "}
                  A base econômica, na tabela, é a tarifa usada no cálculo tarifário, sem os componentes financeiros do processo. No modo Analisar, o histórico mostra até quatro
                  distribuidoras sobre a mediana nacional.
                </>
              }
              naoConcluir={
                <>
                  Não é a conta final: faltam ICMS, PIS/Pasep, Cofins, iluminação pública e bandeira. Não é a tarifa média de fornecimento. A mediana não é ponderada por
                  consumidores e não representa o consumidor médio do país; os perfis de {g.perfis_kwh.join(", ")} kWh são referências do observatório, não consumo médio.
                </>
              }
              proveniencia={t.proveniencia}
              complementares={[
                {
                  rotulo: "Evolução mensal da mediana",
                  p: t.proveniencia_evolucao,
                },
              ]}
            >
              <div className="space-y-6">
                <Recorte
                  periodo={
                    <>
                      Tarifa vigente em {dataBR(ref)}; histórico de {mesAno(`${evolucao[0]?.m ?? ref.slice(0, 7)}-01`)} a {mesAno(`${evolucao.at(-1)?.m ?? ref.slice(0, 7)}-01`)}
                    </>
                  }
                  universo={
                    <>
                      {t.resumo.n} distribuidoras com vigência na data; {t.resumo.fora_vigencia_recente + t.resumo.fora_sem_tarifa_ha_mais_de_90_dias} fora do ranking (lista em
                      Auditar)
                    </>
                  }
                  unidade="R$/mês para o perfil; R$/MWh para a tarifa (÷ 1000 = R$/kWh)"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Numero
                    rotulo="Tarifa B1 residencial mediana"
                    natureza="CALCULADO"
                    valor={t.resumo.mediana === null ? null : t.resumo.mediana / 1000}
                    formato="reais"
                    casas={4}
                    unidade="R$/kWh"
                    evidencia={t.evidencia_mediana}
                    nota={`${t.resumo.n} distribuidoras, cada uma pesando igual; sem tributos e sem bandeira.`}
                    tamanho="medio"
                    endereco="/setor-eletrico/conta-de-luz#tarifa"
                  />
                  {/* O custo do perfil escolhido fica na resposta logo abaixo, que segue o perfil da URL; um
                      segundo destaque fixo em 200 kWh contradiria a escolha de 100 ou 300 kWh e não tem
                      evidência própria na gold (a da mediana prova a tarifa, não o custo do perfil). */}
                </div>
                <ContaTarifas vigentes={t.vigentes} resumo={t.resumo} dataReferencia={ref} fonte={FONTE_TARIFAS} />

                <div data-nivel="analisar" className="space-y-3 border-t border-linha pt-5">
                  <h3 className="font-serif text-lg text-carvao">Como a tarifa de cada distribuidora evoluiu diante da mediana?</h3>
                  <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">
                    Tarifa vigente no dia 1º de cada mês. O arquivo começa em {t.evolucao[0] ? mesAno(`${t.evolucao[0][0]}-01`) : "mês não publicado"} com poucas
                    distribuidoras, e a mediana só aparece quando a cobertura passa do mínimo da regra (a partir de{" "}
                    {evolucao[0] ? mesAno(`${evolucao[0].m}-01`) : "nenhum mês"}; regra nas limitações da evolução mensal, em Sobre este dado). Incorporações aparecem como
                    linhas verticais; todas as mudanças da distribuidora em destaque estão na tabela.
                  </p>
                  <ContaHistorico evolucao={evolucao} entidades={entidades} historicoUrl={t.historico_url} ultimoIpca={ultimoIpca} fonte={FONTE_TARIFAS} dataReferencia={ref} />
                </div>

                <Auditoria titulo="Quem ficou fora do ranking e por quê">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Recorte do arquivo: {num(g.universo_tarifas.linhas_lidas ?? null, 0)} linhas lidas, {num(g.universo_tarifas.no_recorte ?? null, 0)} no recorte de baixa tensão
                    convencional ({num(g.universo_tarifas.fora_baixa_tensao_b1_b2_b3 ?? null, 0)} de outros subgrupos,{" "}
                    {num(g.universo_tarifas.modalidade_nao_convencional ?? null, 0)} de outras modalidades, {num(g.universo_tarifas.detalhe_especifico ?? null, 0)} com detalhe
                    específico). {g.regras.zero_publicado} {g.regras.unidade}
                  </p>
                  <ContaSobDemanda chaveUrl="semvig" rotulo="a lista de distribuidoras sem tarifa vigente" detalhe={`${linhasSemVigente.length} linhas`}>
                    <TabelaInterativa
                      titulo="Distribuidoras com tarifa B1 no conjunto e sem vigência na data"
                      colunas={COLUNAS_SEM_VIGENTE}
                      linhas={linhasSemVigente}
                      chaveLinha="id"
                      colunaRotulo="sigla"
                      fonte={FONTE_TARIFAS}
                      versao={ref}
                      nomeArquivo="conta-distribuidoras-sem-tarifa-vigente"
                      chaveUrl="semvig"
                      ordemInicial={{ coluna: "dias", direcao: "asc" }}
                    />
                  </ContaSobDemanda>
                  <p className="text-sm text-carvao-muted">
                    Vigências sobrepostas na fonte: {g.conflitos_fonte.total} casos no recorte, {g.conflitos_fonte.b1_residencial.length} na tarifa B1 residencial de aplicação.{" "}
                    {g.conflitos_fonte.regra}{" "}
                    <a href={g.conflitos_fonte.download} download className="text-energia-dark underline underline-offset-4">
                      Baixar os casos e a escolha feita (CSV)
                    </a>
                    .
                  </p>
                  {g.siglas_substituidas.length > 0 && (
                    <p className="text-sm text-carvao-muted">
                      Siglas substituídas:{" "}
                      {g.siglas_substituidas.map((s) => `CNPJ ${s.cnpj} publicado como "${s.sigla_tarifas}" e exibido como ${s.sigla_usada} (${s.fonte})`).join("; ")}.
                    </p>
                  )}
                </Auditoria>
                <Seguir ancora="tarifa" href="#composicao" pergunta="Para onde vai esse valor? Veja a composição da tarifa." />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P048 ---------------- */}
          <Bloco id="composicao">
            <PainelEvidencia
              id="p048"
              pergunta="Para onde vai o valor da conta?"
              subtitulo="Componentes tarifárias da tarifa B1 residencial agrupadas · R$/MWh e % de TE + TUSD"
              natureza="CALCULADO"
              porQueImporta={
                <>
                  Mostra quanto da tarifa paga a energia comprada, a transmissão, a rede de distribuição, as perdas e os encargos setoriais, a partir das componentes que a ANEEL
                  publica para cada processo tarifário.
                </>
              }
              oQueMudou={
                <>
                  {mudancaComposicao(comp)}
                  <span data-nivel="analisar"> Leitura completa do valor negativo: {comp.creditos.leitura}.</span>
                </>
              }
              comoInterpretar={
                <>
                  As partes positivas de cada barra passam do total, e os itens negativos (créditos e devoluções) trazem de volta: a soma de tudo é TE + TUSD. Os grupos seguem a
                  classificação do observatório pelo código da componente; a parcela das componentes <Termo slug="cde">CDE</Termo> está dentro dos encargos e aparece à parte só
                  para leitura. Na tabela de decomposição, a média fecha com o total e a mediana é lida grupo a grupo.
                </>
              }
              naoConcluir={
                <>
                  Não se conclui margem ou lucro da distribuidora: o grupo distribuição é a remuneração regulada do fio, não resultado contábil. Não se conclui o valor em reais do
                  crédito tarifário por distribuidora (o conjunto dá R$/MWh da tarifa B1, não o mercado a que se aplica). Tributos e iluminação pública não estão na tarifa homologada.
                </>
              }
              proveniencia={comp.proveniencia}
            >
              <div className="space-y-6">
                <RespostaCurta id="p048" veredito={vereditoComposicao(comp)}>
                  {respostaComposicao(comp)}
                </RespostaCurta>
                <Recorte
                  periodo={<>Componentes da vigência que cobre {dataBR(ref)}</>}
                  universo={
                    <>
                      {comp.distribuidoras.length} distribuidoras com componentes; sem componentes para o ato vigente: {comp.reconciliacao.sem_componentes.join(", ") || "nenhuma"}
                    </>
                  }
                  unidade="R$/MWh de TE + TUSD (ou % da tarifa)"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Numero
                    rotulo={`Encargos na tarifa da distribuidora de referência`}
                    natureza="CALCULADO"
                    evidencia={comp.evidencia}
                    formato="pct"
                    casas={1}
                    motivoAusencia="Sem componentes para a distribuidora de referência."
                    nota={comp.evidencia ? `${comp.evidencia.entidade}: ${comp.evidencia.universo}.` : undefined}
                    tamanho="medio"
                    endereco="/setor-eletrico/conta-de-luz#composicao"
                  />
                  {/* A parcela CDE média está na resposta acima e na linha "Dos encargos: componentes CDE" da
                      tabela de decomposição; a gold não traz evidência própria para ela, então não vira destaque. */}
                </div>
                <ContaComposicao
                  composicao={{
                    grupos: comp.grupos,
                    distribuidoras: comp.distribuidoras,
                    media: comp.media,
                    mediana: comp.mediana,
                    cde: comp.cde,
                    creditos: comp.creditos,
                  }}
                  vigentes={t.vigentes.map((v) => ({
                    cnpj: v.cnpj,
                    posicao: v.posicao,
                  }))}
                  referencia={sim.casos_referencia.cnpj}
                  dataReferencia={ref}
                  fonte="ANEEL, Componentes Tarifárias"
                />
                <Auditoria titulo="Componentes de cada grupo, valores atípicos e conferências">
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {comp.grupos.map((gr) => (
                      <div key={gr.id}>
                        <dt className="font-medium text-carvao">{gr.rotulo}</dt>
                        <dd className="mt-0.5 text-carvao-muted">
                          {gr.componentes.length
                            ? gr.componentes.map((c) => `${c.codigo} (${c.descricao ?? "sem descrição no dicionário"})`).join("; ")
                            : "sem código próprio: recebe valor negativo de componente de custo."}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm text-carvao-muted">
                    Classificação: {comp.classificacao}. Fora da tarifa homologada: {comp.excluidos.join(", ")}.
                  </p>
                  <p className="text-sm text-carvao-muted">Regra de atípico: {comp.regra_atipico}. Cada valor abaixo foi conferido no arquivo original da ANEEL e mantido.</p>
                  <ContaSobDemanda chaveUrl="atip" rotulo="as componentes atípicas" detalhe={`${linhasAtipicas.length} linhas`}>
                    <TabelaInterativa
                      titulo="Componentes atípicas na vigência atual"
                      colunas={COLUNAS_ATIPICAS}
                      linhas={linhasAtipicas}
                      chaveLinha="id"
                      colunaRotulo="sigla"
                      fonte="ANEEL, Componentes Tarifárias"
                      versao={ref}
                      nomeArquivo="conta-componentes-atipicas"
                      chaveUrl="atip"
                    />
                  </ContaSobDemanda>
                  <p className="text-sm text-carvao-muted">
                    Conferência das parcelas: {comp.reconciliacao.conferidas} distribuidoras com TE e TUSD iguais nos dois conjuntos da ANEEL,{" "}
                    {comp.reconciliacao.divergentes.length} divergentes, sem componentes: {comp.reconciliacao.sem_componentes.join(", ") || "nenhuma"}. Repetições no arquivo:{" "}
                    {comp.reconciliacao.duplicatas_fonte.iguais} iguais e {comp.reconciliacao.duplicatas_fonte.conflitantes} com valor diferente (
                    {comp.reconciliacao.duplicatas_fonte.regra}).
                  </p>
                  <p className="text-sm text-carvao-muted">
                    Documento que sustenta a leitura do crédito:{" "}
                    {comp.creditos.documento
                      .map((id) => {
                        const d = g.documentos.find((x) => x.id === id);
                        return d ? `${d.titulo} (${comp.creditos.documento_estado[id] === "CONFERIDA" ? "trechos conferidos na captura" : "trechos não reconferidos"})` : id;
                      })
                      .join("; ")}
                    .
                  </p>
                </Auditoria>
                <Seguir ancora="composicao" href="#simulador" pergunta="Quanto ficaria a minha conta? Simule o seu consumo." />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P049 ---------------- */}
          <Bloco id="simulador">
            <PainelEvidencia
              id="p049"
              pergunta="Como a minha conta varia com o consumo e o perfil?"
              subtitulo="Simulação com as tarifas vigentes e as regras publicadas · R$/mês, estimativa sem tributos"
              natureza="ESTIMADO"
              porQueImporta={
                <>
                  Mostra como a regra de cada classe (mínimo da ligação, faixas da Tarifa Social e do Desconto Social, bandeira) transforma kWh em reais, com a tarifa vigente da
                  distribuidora escolhida.
                </>
              }
              oQueMudou={
                <>
                  Desde {dataBR(sim.regras.desconto_social_desde)}, o Desconto Social isenta das quotas da CDE o consumo de até {sim.regras.desconto_social_limite_kwh} kWh no mês;
                  a Tarifa Social dá desconto integral até {sim.regras.tarifa_social_limite_kwh} kWh. Bandeira do mês publicado:{" "}
                  {sim.bandeira_vigente?.bandeira ? `${minuscula(sim.bandeira_vigente.bandeira)} (${mesAno(`${sim.bandeira_vigente.mes}-01`)})` : "não publicada"}.
                </>
              }
              comoInterpretar={
                <>
                  A memória de cálculo mostra cada parcela: kWh, preço por kWh e valor. O gráfico mostra a estimativa para todo consumo de zero ao limite do eixo; a linha muda de
                  inclinação onde muda a regra. Cada regra traz o seu estado: conferida no texto oficial, ou parcial quando parte dela é leitura declarada.
                </>
              }
              naoConcluir={
                <>
                  Não é a fatura: faltam ICMS, PIS/Pasep, Cofins, iluminação pública, multas, parcelamentos e serviços. A aplicação do Desconto Social por parcela, o mínimo da
                  Tarifa Social acima de {sim.regras.tarifa_social_limite_kwh} kWh e a bandeira na Tarifa Social são leituras do observatório, não conferidas no texto da REN nº 1.000/2021.
                  Bandeira não vale em sistemas isolados.
                </>
              }
              proveniencia={sim.proveniencia}
              complementares={[{ rotulo: "Bandeiras", p: band.proveniencia }]}
            >
              <div className="space-y-6">
                <Recorte
                  periodo={
                    <>
                      Tarifas vigentes em {dataBR(ref)}; bandeira de {sim.bandeira_vigente ? mesAno(`${sim.bandeira_vigente.mes}-01`) : "mês não publicado"}
                    </>
                  }
                  universo={
                    <>
                      Uma unidade consumidora de baixa tensão; {sim.distribuidoras.length} distribuidoras com tarifa vigente (Desconto Social em {sim.cobertura_classes.ds1})
                    </>
                  }
                  unidade="R$/mês (estimativa); tarifas em R$/kWh"
                />
                <ContaSimulador
                  simulador={{
                    classes: sim.classes,
                    regras: sim.regras,
                    regras_texto: sim.regras_texto,
                    estado_regras: sim.estado_regras,
                    bandeiras: sim.bandeiras,
                    bandeira_vigente: sim.bandeira_vigente,
                    distribuidoras: sim.distribuidoras,
                    rotulo: sim.rotulo,
                    formula: sim.formula,
                    referencia: {
                      cnpj: sim.casos_referencia.cnpj,
                      sigla: sim.casos_referencia.sigla,
                    },
                  }}
                  evidencia={sim.evidencia}
                  dataReferencia={ref}
                />
                <Auditoria titulo="Normas conferidas e casos de referência">
                  <ul className="space-y-3 text-sm">
                    {sim.normas.map((n) => (
                      <li key={n.id} className="border-l-2 border-linha pl-3">
                        <a href={n.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
                          {n.titulo}
                        </a>{" "}
                        <span className="text-carvao-muted">
                          ({n.orgao};{" "}
                          {n.estado === "CONFERIDA"
                            ? `trechos conferidos na captura de ${carimbo(n.conferido_em)}`
                            : n.estado === "NAO_RECONFERIDA"
                              ? "trecho ausente na última captura"
                              : "não capturada"}
                          ; {n.licenca})
                        </span>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-carvao-muted">
                          {n.trechos.map((tr) => (
                            <li key={tr.trecho}>
                              “{tr.trecho}” {tr.presente ? "(presente)" : "(ausente na captura)"}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <ul className="space-y-2 text-sm text-carvao-muted">
                    {sim.regras_texto.map((r) => (
                      <li key={r.id}>
                        <span className="font-medium text-carvao">{r.texto}</span> Estado:{" "}
                        {r.estado === "CONFERIDA" ? "conferida" : r.estado === "PARCIAL" ? "parcialmente conferida" : "não conferida"}.
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-carvao-muted">
                    Casos calculados pelo pipeline para {rotuloDistribuidora(sim.casos_referencia.sigla, sim.casos_referencia.cnpj)} ({sim.casos_referencia.criterio}); o simulador
                    desta página reproduz cada um (teste automatizado). Sem valor: simulação indisponível para a classe.
                  </p>
                  <ContaSobDemanda chaveUrl="casos" rotulo="os casos de referência do simulador" detalhe={`${linhasCasos.length} casos`}>
                    <TabelaInterativa
                      titulo="Casos de referência do simulador"
                      colunas={COLUNAS_CASOS}
                      linhas={linhasCasos}
                      chaveLinha="id"
                      colunaRotulo="classe"
                      fonte={FONTE_TARIFAS}
                      versao={ref}
                      nomeArquivo="conta-simulador-casos-referencia"
                      chaveUrl="casos"
                    />
                  </ContaSobDemanda>
                </Auditoria>
                <Seguir ancora="simulador" href={`${ROTA_REAJUSTES}#reajustes`} pergunta="O que mudou na tarifa e quem financia os descontos?" />
              </div>
            </PainelEvidencia>
          </Bloco>

          {/* ---------------- P050 (página própria) ---------------- */}
          <Bloco id="p050">
            <section aria-labelledby="p050-titulo" className="border border-linha bg-superficie">
              <header className="px-5 pt-6 md:px-8">
                <h2 id="p050-titulo" className="font-serif text-xl leading-snug text-carvao md:text-2xl">
                  O que mudou e quem financia os benefícios?
                </h2>
                <p className="mt-2 text-sm text-mineral">
                  Variação da tarifa B1 contra o IPCA, bandeiras acionadas e financiamento dos descontos pela CDE · painéis completos em página própria
                </p>
              </header>
              <ul className="mt-5 grid gap-px border-t border-linha bg-linha md:grid-cols-3">
                {[
                  {
                    ancora: "reajustes",
                    pergunta: "A tarifa subiu mais que a inflação?",
                    veredito: janela12 ? vereditoReajustes(janela12) : "Sem janela de 12 meses publicada.",
                    resposta: janela12 ? respostaReajustes(janela12) : "Sem janela de 12 meses publicada.",
                  },
                  { ancora: "bandeiras", pergunta: "Quando a bandeira encareceu a conta?", veredito: vereditoBandeira(band), resposta: respostaBandeira(band) },
                  { ancora: "subsidios", pergunta: "Quem financia os descontos e benefícios?", veredito: vereditoSubsidios(sub), resposta: `${respostaSubsidios(sub)} ${respostaCde(cde)}` },
                ].map((x) => (
                  <li key={x.ancora} className="flex flex-col bg-superficie px-5 py-4 md:px-6">
                    <h3 className="font-serif text-lg text-carvao">{x.pergunta}</h3>
                    <div className="mt-2 flex-1">
                      <RespostaCurta id={`p050-${x.ancora}`} tamanho="sm" veredito={x.veredito}>
                        {x.resposta}
                      </RespostaCurta>
                    </div>
                    <ContaLinkFiltros
                      href={`${ROTA_REAJUSTES}#${x.ancora}`}
                      className="mt-3 inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4 hover:text-carvao"
                    >
                      Ver o painel com gráfico, tabela e provas
                    </ContaLinkFiltros>
                  </li>
                ))}
              </ul>
            </section>
          </Bloco>

          {/* ---------------- Auditoria geral ---------------- */}
          <Bloco nivel="auditar" id="auditoria-conta">
            <section aria-labelledby="auditoria-conta-titulo" className="space-y-5 border border-linha bg-superficie p-5 md:p-8">
              <h2 id="auditoria-conta-titulo" className="font-serif text-xl text-carvao">
                Validação, tarifa média avaliada e arquivos
              </h2>
              <div>
                <h3 className="font-medium text-carvao">Regras conferidas antes de publicar</h3>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-carvao-muted">
                  {g.validacao.regras.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <h3 className="mt-4 font-medium text-carvao">Ressalvas desta publicação ({g.validacao.ressalvas.length})</h3>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-carvao-muted">
                  {g.validacao.ressalvas.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-carvao">Tarifa média de fornecimento: alternativa avaliada e não usada</h3>
                <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{g.tarifa_media_fornecimento.motivo}</p>
                {g.tarifa_media_fornecimento.alternativa_avaliada && "arquivo" in g.tarifa_media_fornecimento.alternativa_avaliada && (
                  <div className="mt-2 text-sm text-carvao-muted">
                    <p>
                      {g.tarifa_media_fornecimento.alternativa_avaliada.orgao}, {g.tarifa_media_fornecimento.alternativa_avaliada.conjunto}, recurso{" "}
                      {g.tarifa_media_fornecimento.alternativa_avaliada.recurso} ({num(g.tarifa_media_fornecimento.alternativa_avaliada.linhas_lidas, 0)} linhas, sha256{" "}
                      <code className="break-all text-xs">{g.tarifa_media_fornecimento.alternativa_avaliada.sha256}</code>
                      ). Regra: {g.tarifa_media_fornecimento.alternativa_avaliada.regra_atipico}. {g.tarifa_media_fornecimento.alternativa_avaliada.distribuidoras_com_mes_atipico}{" "}
                      de {g.tarifa_media_fornecimento.alternativa_avaliada.distribuidoras_no_recorte} distribuidoras com mês atípico:
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {g.tarifa_media_fornecimento.alternativa_avaliada.meses_atipicos.map((m) => (
                        <li key={`${m.cnpj}|${m.linha}|${m.mes}`}>
                          {rotuloDistribuidora(m.sigla, m.cnpj)}, {m.linha}, {mesAno(`${m.mes.slice(0, 7)}-01`)}: {reais(m.valor_rs === null ? null : m.valor_rs / 1e9, 2)} bilhões
                          contra mediana de {reais(m.mediana_outros_meses_rs === null ? null : m.mediana_outros_meses_rs / 1e9, 2)} bilhões nos outros meses (razão{" "}
                          {num(m.razao, 1)}
                          ).
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium text-carvao">Documentos oficiais conferidos a cada captura</h3>
                <ul className="mt-2 space-y-1 text-sm text-carvao-muted">
                  {g.documentos.map((d) => (
                    <li key={d.id}>
                      <a href={d.url} className="text-energia-dark underline underline-offset-4" rel="noopener noreferrer">
                        {d.titulo}
                      </a>{" "}
                      ({d.estado === "CONFERIDA" ? `trechos conferidos em ${carimbo(d.conferido_em)}` : "trechos não reconferidos"}; {d.licenca})
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-carvao">Arquivos para download</h3>
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {g.downloads.map((d) => (
                    <li key={d.url}>
                      <a href={d.url} download className="inline-flex min-h-[44px] items-center text-energia-dark underline underline-offset-4">
                        {d.rotulo}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-mineral">
                  Gerado por {g.versao_pipeline} (código {g.versao_codigo ?? "sem versão"}) em {carimbo(g.gerado_em)}. Método completo no documento do módulo
                  (docs/observatorios/energia/modulos/conta.md), na pasta de documentação indicada em{" "}
                  <Link href="/setor-eletrico/metodologia" className="text-energia-dark underline underline-offset-4">
                    Metodologia
                  </Link>
                  .
                </p>
              </div>
            </section>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
