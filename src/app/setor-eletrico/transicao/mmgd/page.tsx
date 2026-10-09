import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { TransicaoDestaques, TransicaoMmgdMensal, TransicaoMmgdPerfil, TransicaoMmgdUf, TransicaoMunicipios } from "@/components/energia/TransicaoMmgd";
import {
  TransicaoAnalise,
  TransicaoAuditoria,
  TransicaoAviso,
  TransicaoDatas,
  TransicaoDocumento,
  TransicaoIndisponivel,
  TransicaoNavegacao,
  TransicaoRecorte,
  TransicaoSeguir,
  TransicaoTabela,
} from "@/components/energia/TransicaoPagina";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { Termo } from "@/components/evidencia/Termo";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  COLUNAS_ANUAL,
  FONTE_ANEEL,
  FONTE_ANEEL_CADASTRO,
  PERGUNTA_ONS,
  cnpjFormatado,
  colunasDistribuidoras,
  conectadaNoAnoDeReferencia,
  contagem,
  dadosMensal,
  data,
  inteiro,
  linhasAnual,
  listasDestaque,
  linhasDistribuidoras,
  linhasFontes,
  linhasUfs,
  mes,
  mudancaMmgd,
  mudancaMmgdAno,
  nomesMunicipios,
  numTexto,
  participacaoTexto,
  pctTexto,
  perguntaPainel,
  primeiroAnoCoberto,
  respostaMmgd,
  rotaPainel,
  textoModalidadesRemotas,
  ufAnualCompacto,
  vereditoMmgd,
} from "@/lib/energia/transicao";
import type { GoldTransicao, MunicipiosMmgdArquivo } from "@/lib/energia/tipos-transicao";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "MMGD no território: onde a geração distribuída cresce",
  description:
    "Micro e minigeração distribuída no cadastro da ANEEL por UF, município, distribuidora, fonte e perfil, com potência por habitante (IBGE), histórico de conexões, perfis e controles do cadastro. Capacidade instalada, não energia gerada.",
  alternates: { canonical: "/setor-eletrico/transicao/mmgd" },
};

/**
 * Nomes dos municípios das listas do modo Auditar que a gold publica só com o código
 * IBGE, lidos no build do JSON municipal publicado (o mesmo que o mapa baixa sob
 * demanda): fica no servidor e só os nomes dessas linhas entram no HTML. Arquivo
 * ausente ou ilegível: a tabela mostra o código, sem nome inventado.
 */
function nomesNoServidor(url: string, ids: string[]): Map<string, string> {
  try {
    const arq = JSON.parse(readFileSync(join(process.cwd(), "public", url), "utf-8")) as MunicipiosMmgdArquivo;
    return nomesMunicipios(arq, ids);
  } catch {
    return new Map();
  }
}

/**
 * P063, MMGD e distribuição territorial: o cadastro da ANEEL (capacidade, não
 * energia) no mapa por UF e por município, com histórico de conexões, perfis,
 * distribuidoras e controles. A estimativa de energia do ONS e a conferência do
 * achado A11 ficam na página seguinte (/energia-estimada), nunca somadas ao
 * cadastro. Leitura da gold transicao.json; todo número vem dela.
 */
export default function MmgdPage() {
  const g = lerGold<GoldTransicao>("transicao.json");
  if (!integra(g)) return <TransicaoIndisponivel motivo={(g as { motivo?: string } | null)?.motivo} />;

  const m = g.mmgd;
  const r = m.resumo;
  const ctl = m.controles;
  const fora = ctl.distribuidora_fora_da_uf;
  const cobertura = ctl.cobertura_das_series;
  const primeiroCoberto = primeiroAnoCoberto(cobertura.inicio_declarado);
  const anoCadastro = Number(m.data_cadastro.slice(0, 4));
  const anual = linhasAnual(m);
  const fontes = linhasFontes(m.fontes);
  const conectada = conectadaNoAnoDeReferencia(m);
  const downloads = (urls: string[]) => g.downloads.filter((d) => urls.includes(d.url));
  const siglaDe = new Map(m.distribuidoras.map((d) => [d.cnpj, d.sigla ?? cnpjFormatado(d.cnpj)]));
  const dq = m.distribuicao_municipal.quantis_w_por_habitante;
  const modalidades = textoModalidadesRemotas(m.perfis);
  const nomesFora = fora.disponivel ? nomesNoServidor(g.mapa_municipios, fora.maiores_municipios.map((x) => x.ibge)) : new Map<string, string>();
  const oQueMudou = (
    <>
      {mudancaMmgdAno(m)}
      <span data-nivel="analisar" className="mt-2 block">
        {mudancaMmgd(m)}
      </span>
    </>
  );
  const comoInterpretar = (
    <>
      Unidades = empreendimentos no cadastro vigente; potência = soma da potência instalada informada (kW; MW nas tabelas). W por habitante = potência ÷ população estimada
      pelo IBGE, as duas somadas no território. Crescimento do estoque em {m.ano_referencia} = potência conectada no ano ÷ potência conectada até o fim de {m.ano_referencia - 1}. O ano
      de conexão vem da data publicada pela ANEEL, conferida com a data de conexão do recurso técnico. {g.regras.ano_referencia} Pelo Sistema de Compensação de Energia Elétrica (SCEE), a
      energia que a unidade injeta na rede vira crédito para abater o consumo, no mesmo local, em outra unidade do mesmo titular, entre condôminos ou entre os participantes de uma
      geração compartilhada. {g.regras.cadastro_x_estimativa}
    </>
  );
  const naoConcluir = (
    <>
      Quanta energia cada lugar gera: o cadastro mede capacidade, e a geração não é publicada por unidade nem por município. Nada sobre renda ou perfil de quem tem o
      sistema: potência por habitante relaciona território, não pessoas. {modalidades} Os meses recentes ainda podem mudar, e unidades desativadas não aparecem no
      histórico.
    </>
  );

  return (
    <>
      <CabecalhoEnergia atual="transicao" />
      <MarcaVisita secao="energia:transicao-mmgd" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <TransicaoNavegacao atual="p063" />
        <CabecalhoModulo
          siglas={["MMGD", "SIN", "MWmed", "UC", "ANEEL", "ONS", "IBGE"]}
          rotulo="Transição e ambiente"
          titulo={perguntaPainel("p063")}
          lead={
            <>
              Onde está e quanto cresce a <Termo slug="geracao-distribuida">micro e minigeração distribuída</Termo> (MMGD, a geração instalada junto às unidades consumidoras) cadastrada na ANEEL.
            </>
          }
          recorte={`Cadastro de ${data(m.data_cadastro)} · conexões de ${anual[0]?.ano ?? "sem dado"} a ${data(r.ultima_data_conexao)} · MW e W por habitante`}
          fonte="ANEEL, relação de empreendimentos de MMGD; IBGE, população"
          referencia={
            <>
              Cadastro da ANEEL gerado em {data(m.data_cadastro)} (capturado em {carimbo(m.proveniencia.cadastro.capturado_em)}); população estimada pelo IBGE para {m.ano_populacao ?? "sem dado"}.
              Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <TransicaoDatas
              itens={[
                { rotulo: "Cadastro de MMGD (ANEEL)", texto: `gerado em ${data(m.data_cadastro)}`, natureza: "OBSERVADO" },
                { rotulo: "Conexões", texto: `até ${data(r.ultima_data_conexao)}`, natureza: "OBSERVADO" },
                { rotulo: "População (IBGE)", texto: `estimativa para ${m.ano_populacao ?? "sem dado"}`, natureza: "CALCULADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo="Indicadores da MMGD no cadastro" nota={g.regras.capacidade_nao_e_energia}>
              <Numero
                variante="faixa"
                rotulo="Potência instalada cadastrada"
                natureza="OBSERVADO"
                evidencia={m.evidencias.potencia}
                casas={1}
                unidade="MW"
                cor="var(--serie-solar)"
                nota={`Capacidade, não energia. ${participacaoTexto(r.participacao_solar_potencia_pct)} solar.`}
                endereco={`${rotaPainel("p063")}#p063`}
              />
              <Numero
                variante="faixa"
                rotulo="Unidades de MMGD no cadastro"
                natureza="OBSERVADO"
                evidencia={m.evidencias.unidades}
                casas={0}
                unidade="unidades"
                nota={`Empreendimentos geradores. As unidades consumidoras com crédito (${inteiro(r.ucs_recebem_credito)}) são outra contagem.`}
                endereco={`${rotaPainel("p063")}#p063`}
              />
              <Numero
                variante="faixa"
                rotulo={`Potência conectada em ${conectada?.ano ?? "sem dado"}`}
                natureza="OBSERVADO"
                valor={conectada?.potencia_mw ?? null}
                casas={1}
                unidade="MW"
                periodo="ano completo, pela data de conexão"
                cor="var(--serie-solar)"
                nota={conectada ? `Capacidade adicionada no ano, em ${inteiro(conectada.unidades)} unidades.` : undefined}
                motivoAusencia="Sem o último ano completo nesta publicação."
              />
              <Numero
                variante="faixa"
                rotulo="Potência por habitante no Brasil"
                natureza="CALCULADO"
                valor={r.w_por_habitante_brasil}
                casas={1}
                unidade="W/hab"
                periodo={`população do IBGE para ${m.ano_populacao ?? "sem dado"}`}
                cor="var(--serie-referencia)"
                nota="Potência instalada ÷ população estimada, as duas somadas no país."
                motivoAusencia="Sem a população do IBGE nesta publicação."
              />
            </FaixaMetricas>
          }
        >
          A energia que essas unidades entregam ao SIN está na página da energia estimada pelo ONS, sem nunca ser somada ao cadastro. Unidades, potência e potência por habitante são lidas por UF,
          município, distribuidora e perfil, com a data do cadastro e a população do IBGE ao lado de cada medida.
        </CabecalhoModulo>
        {g.pendencias.length > 0 && (
          <div className="pb-4">
            <TransicaoAviso rotulo="Blocos ausentes nesta publicação" alerta>
              {g.pendencias.join(" ")}
            </TransicaoAviso>
          </div>
        )}
        <ModoProfundidade>
          <Bloco id="mmgd">
            <PainelEvidencia
              id="p063"
              pergunta="Potência instalada por UF e por habitante"
              subtitulo="Micro e minigeração distribuída no cadastro da ANEEL · unidades, MW instalados e W por habitante"
              natureza="OBSERVADO"
              porQueImporta={
                <>
                  A <Termo slug="geracao-distribuida">micro e minigeração distribuída</Termo> é a geração instalada junto às unidades consumidoras, quase toda solar. Ela cresce de forma
                  desigual pelo território, muda o que a distribuidora entrega e o que o ONS precisa prever, e entra na conta de quem gera pelo Sistema de Compensação de Energia Elétrica (SCEE).
                </>
              }
              oQueMudou={oQueMudou}
              comoInterpretar={comoInterpretar}
              naoConcluir={naoConcluir}
              naoConcluirNoCorpo
              proveniencia={m.proveniencia.cadastro}
              complementares={[{ rotulo: "Por habitante (ANEEL e IBGE)", p: m.proveniencia.por_habitante }]}
            >
              <div className="space-y-6">
                <RespostaCurta id="p063" veredito={vereditoMmgd(m) || respostaMmgd(m)}>
                  {respostaMmgd(m)}
                </RespostaCurta>
                <TransicaoMmgdUf
                  linhas={linhasUfs(m.ufs)}
                  ufAnual={ufAnualCompacto(m.uf_anual)}
                  anoReferencia={m.ano_referencia}
                  anoPopulacao={m.ano_populacao}
                  primeiroCoberto={primeiroCoberto}
                  wPorHabitanteBrasil={r.w_por_habitante_brasil}
                  dataCadastro={m.data_cadastro}
                  fonte={FONTE_ANEEL}
                />
                <TransicaoRecorte
                  periodo={
                    <>
                      Cadastro vigente em {data(m.data_cadastro)}; conexões de {anual[0]?.ano ?? "sem dado"} a {data(r.ultima_data_conexao)} (cobertura declarada pela ANEEL a partir
                      de {mes(cobertura.inicio_declarado.slice(0, 7))}); ano de referência {m.ano_referencia}
                    </>
                  }
                  universo={
                    <>
                      {inteiro(r.unidades)} unidades em {inteiro(r.municipios_com_mmgd)} de {inteiro(r.municipios_no_cadastro_ibge)} municípios; {inteiro(m.distribuidoras.length)}{" "}
                      distribuidoras (CNPJ)
                    </>
                  }
                  unidade={<>Unidades; potência instalada em kW e MW (capacidade, não energia); W por habitante com a população do IBGE de {m.ano_populacao ?? "sem dado"}</>}
                />
                <NotasDoPainel oQueMudou={oQueMudou} comoInterpretar={comoInterpretar} naoConcluir={naoConcluir} />

                <SecaoDoPainel id="por-ano" titulo="Quanto foi conectado a cada ano no Brasil?">
                  <GraficoBarras
                    titulo={`Potência conectada por ano de conexão, Brasil (cadastro de ${data(m.data_cadastro)})`}
                    dados={anual}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[{ id: "potencia_mw", rotulo: "Potência conectada no ano", cor: "var(--serie-solar)" }]}
                    unidade="MW"
                    casas={1}
                    altura={300}
                  />
                  <TabelaInterativa
                    titulo="Conexões e estoque por ano, Brasil"
                    colunas={COLUNAS_ANUAL}
                    linhas={anual}
                    chaveLinha="id"
                    colunaRotulo="ano"
                    fonte={FONTE_ANEEL_CADASTRO}
                    versao={m.data_cadastro}
                    nomeArquivo="transicao-mmgd-anual"
                    chaveUrl="mmgd.ano"
                    ordemInicial={{ coluna: "ano", direcao: "desc" }}
                    dicaBusca="Ano"
                    nota={`${cobertura.regra} O estoque inclui ${contagem(cobertura.unidades_anteriores, "registro anterior", "registros anteriores")} à cobertura e exclui ${contagem(r.unidades_sem_data, "unidade", "unidades")} sem data de conexão (no total do cadastro).`}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="fontes" titulo="Com que fonte?">
                  <GraficoBarras
                    titulo="Potência instalada por fonte de geração"
                    dados={fontes}
                    chaveCategoria="id"
                    chaveRotulo="rotulo"
                    series={[{ id: "potencia_mw", rotulo: "Potência instalada", cor: "var(--serie-solar)" }]}
                    unidade="MW"
                    casas={1}
                    orientacao="horizontal"
                    rotulosValor
                  />
                  <TransicaoTabela
                    titulo="Unidades, potência e participação por fonte"
                    colunas={["Fonte", "Unidades", "Potência (MW)", "Participação na potência"]}
                    numericas={[1, 2, 3]}
                    linhas={fontes.map((f) => [f.rotulo, inteiro(f.unidades), numTexto(f.potencia_mw, 3), participacaoTexto(f.participacao_potencia_pct)])}
                  />
                </SecaoDoPainel>

                <SecaoDoPainel id="perfil" titulo="Quem tem: classe, modalidade, porte e tipo de consumidor">
                  <TransicaoMmgdPerfil perfis={m.perfis} anoReferencia={m.ano_referencia} />
                  <div data-nivel="analisar" className="space-y-3">
                    {m.documentos.map((d) => (
                      <TransicaoDocumento key={d.url + d.titulo} doc={d} />
                    ))}
                  </div>
                </SecaoDoPainel>

                <SecaoDoPainel id="municipios" titulo="E nos municípios: destaques e mapa">
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    Entre os {inteiro(m.distribuicao_municipal.municipios_com_populacao)} municípios com população estimada, a potência por habitante vai de {numTexto(dq.p10, 1)} W/hab
                    (10% dos municípios abaixo) a {numTexto(dq.p90, 1)} W/hab (10% acima), com mediana de {numTexto(dq.p50, 1)}. {contagem(m.distribuicao_municipal.municipios_sem_mmgd, "município não tem", "municípios não têm")} nenhuma unidade. Rankings só com população de pelo menos {inteiro(m.municipios_destaque.populacao_minima_ranking)} habitantes e potência
                    completa.
                  </p>
                  <TransicaoDestaques listas={listasDestaque(m.municipios_destaque)} anoReferencia={m.ano_referencia} populacaoMinima={m.municipios_destaque.populacao_minima_ranking} />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    &ldquo;Distribuidora sem conjunto na UF&rdquo;: unidades do município cuja distribuidora (CNPJ) não tem conjunto elétrico na UF (detalhe no modo Auditar). Crescimento
                    alto pode refletir um estoque inicial pequeno: leia junto com a potência.
                  </p>
                  <TransicaoMunicipios
                    jsonUrl={g.mapa_municipios}
                    csvUrl="/energia/series/transicao_mmgd_municipio_ano_fonte.csv"
                    anoReferencia={m.ano_referencia}
                    anoPopulacao={m.ano_populacao}
                    anoFinal={anoCadastro}
                    primeiroCoberto={primeiroCoberto}
                    fonte={FONTE_ANEEL}
                    versao={m.data_cadastro}
                  />
                </SecaoDoPainel>

                <TransicaoAnalise titulo="Mês a mês: conexões e estoque">
                  <TransicaoMmgdMensal dados={dadosMensal(m.mensal)} corte={m.corte_provisorio} />
                  <p className="max-w-prose2 text-sm text-carvao-muted">
                    {g.regras.provisorio} Meses antes de {mes(cobertura.inicio_declarado.slice(0, 7))} sem registro ficam em branco: a ANEEL não declara cobertura ali. A série por UF e mês
                    está no CSV por UF, mês e fonte.
                  </p>
                </TransicaoAnalise>

                <TransicaoAnalise titulo="Distribuidoras">
                  <TabelaInterativa
                    titulo={`MMGD por distribuidora (CNPJ), cadastro de ${data(m.data_cadastro)}`}
                    colunas={colunasDistribuidoras(m.ano_referencia)}
                    linhas={linhasDistribuidoras(m.distribuidoras)}
                    chaveLinha="id"
                    colunaRotulo="sigla"
                    fonte={FONTE_ANEEL_CADASTRO}
                    versao={m.data_cadastro}
                    nomeArquivo="transicao-mmgd-distribuidoras"
                    chaveUrl="mmgd.dist"
                    ordemInicial={{ coluna: "potencia_mw", direcao: "desc" }}
                    dicaBusca="Sigla, nome ou CNPJ"
                    nota="A distribuidora é identificada pelo CNPJ de 14 dígitos; sigla e nome são os publicados. Quando o aviso aparece, parte do total provavelmente é de outra distribuidora."
                  />
                </TransicaoAnalise>

                <TransicaoAuditoria titulo="Controles do cadastro">
                  <TransicaoTabela
                    titulo={`Controles executados a cada publicação (arquivo de ${data(m.data_cadastro)})`}
                    colunas={["Controle", "Valor", "Resultado"]}
                    linhas={[
                      ["Linhas do arquivo e códigos distintos", `${inteiro(ctl.linhas_do_arquivo)} linhas; ${inteiro(ctl.codigos_distintos)} códigos; ${inteiro(ctl.codigos_repetidos)} repetidos`, ctl.codigos_repetidos === 0 ? "aprovado" : "reprovado"],
                      [
                        "Estoque com data + sem data = total",
                        `${inteiro(ctl.identidade_estoque.unidades_com_data_serie_anual)} + ${inteiro(ctl.identidade_estoque.unidades_sem_data)} = ${inteiro(ctl.identidade_estoque.unidades_total)} unidades; diferença de ${numTexto(ctl.identidade_estoque.diferenca_kw, 2)} kW (tolerância ${numTexto(ctl.identidade_estoque.tolerancia_kw, 2)} kW)`,
                        ctl.identidade_estoque.resultado,
                      ],
                      ["Município e UF somam o mesmo", `${inteiro(ctl.identidade_agregacao.unidades)} unidades; diferença de ${numTexto(ctl.identidade_agregacao.diferenca_kw_municipio_uf, 2)} kW`, ctl.identidade_agregacao.resultado],
                      ["Data de conexão conferida com o recurso técnico", `${inteiro(ctl.data_de_conexao.datas_iguais)} de ${inteiro(ctl.data_de_conexao.ufv_na_relacao)} datas e ${inteiro(ctl.data_de_conexao.potencias_iguais)} potências iguais`, ctl.data_de_conexao.resultado],
                      [
                        "Duplicidade candidata (medida, não removida)",
                        `${inteiro(ctl.duplicidade_candidata.grupos)} grupos; ${inteiro(ctl.duplicidade_candidata.linhas_extras)} unidades a mais (${pctTexto(ctl.duplicidade_candidata.participacao_unidades_pct, 2)}); ${numTexto(ctl.duplicidade_candidata.potencia_kw_extras === null ? null : ctl.duplicidade_candidata.potencia_kw_extras / 1000, 1)} MW`,
                        ctl.duplicidade_candidata.tratamento,
                      ],
                      ["Potência ausente, negativa e zero", `${inteiro(ctl.potencia_ausente)} ausentes; ${inteiro(ctl.potencia_negativa)} negativas; ${inteiro(ctl.potencia_zero)} iguais a zero; ${inteiro(ctl.unidades_sem_potencia_nos_agregados)} sem potência nos agregados`, g.regras.potencia_ausente],
                      ["Datas de conexão sentinela (inválidas)", `${contagem(ctl.datas_sentinela, "unidade", "unidades")}; ${numTexto(ctl.potencia_sem_data_kw, 2)} kW`, "no estoque, sem ano de conexão"],
                      ["Antes da cobertura declarada", `${contagem(cobertura.unidades_anteriores, "registro", "registros")}; ${contagem(cobertura.pontos_nulos_anual, "ano nulo", "anos nulos")} e ${contagem(cobertura.pontos_nulos_mensal, "mês nulo", "meses nulos")}`, "rotulados fora da cobertura"],
                      ["Código de município de 6 dígitos completado", inteiro(ctl.municipio_codigo_6_digitos_completado), "só quando o prefixo é único no IBGE"],
                      ["UF publicada ausente ou divergente do município", `${inteiro(ctl.uf_publicada_ausente)} ausente; ${inteiro(ctl.uf_publicada_diverge_do_municipio)} divergentes`, "UF pelo código IBGE"],
                      ["Fonte não informada", inteiro(ctl.fonte_nao_informada), "categoria própria"],
                      ["Período de referência publicado", ctl.periodo_referencia_publicado ?? "sem dado", `conexões de ${data(ctl.data_conexao_minima)} a ${data(ctl.data_conexao_maxima)}`],
                    ]}
                  />
                </TransicaoAuditoria>

                <TransicaoAuditoria titulo="Unidades em UF onde a distribuidora não tem conjunto elétrico">
                  {fora.disponivel ? (
                    <>
                      <p className="max-w-prose2 text-sm text-carvao-muted">
                        {inteiro(fora.unidades)} unidades ({numTexto(fora.potencia_kw / 1000, 1)} MW, {participacaoTexto(fora.participacao_unidades_pct)} do cadastro) em{" "}
                        {contagem(fora.municipios_sinalizados, "município", "municípios")}, de {contagem(fora.distribuidoras_com_unidades_fora, "distribuidora", "distribuidoras")}. {g.regras.distribuidora_fora_da_uf}{" "}
                        Tratamento: {fora.tratamento}. Referência: {fora.referencia.regra}.
                      </p>
                      {fora.classes_pelo_cep.disponivel ? (
                        <>
                          <TransicaoTabela
                            titulo="Classes pelo CEP publicado"
                            colunas={["Classe", "Unidades", "Potência (kW)", "Municípios", "Distribuidoras"]}
                            numericas={[1, 2, 3, 4]}
                            linhas={fora.classes_pelo_cep.classes.map((c) => [c.rotulo, inteiro(c.unidades), numTexto(c.potencia_kw, 2), inteiro(c.municipios), inteiro(c.distribuidoras)])}
                          />
                          <TransicaoTabela
                            titulo="Indeterminadas, por motivo"
                            colunas={["Motivo", "Unidades", "Potência (kW)"]}
                            numericas={[1, 2]}
                            linhas={fora.classes_pelo_cep.indeterminadas_por_motivo.map((x) => [x.motivo.replace(/_/g, " "), inteiro(x.unidades), numTexto(x.potencia_kw, 2)])}
                          />
                          <p className="max-w-prose2 text-sm text-carvao-muted">
                            {fora.classes_pelo_cep.orientacao} Referência da UF do CEP: {fora.classes_pelo_cep.referencia_uf_do_cep.regra}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-carvao-muted">Classes pelo CEP indisponíveis nesta publicação: {fora.classes_pelo_cep.motivo}</p>
                      )}
                      <div className="grid gap-6 lg:grid-cols-2">
                        <TransicaoTabela
                          titulo="Distribuidoras com mais unidades fora da área"
                          colunas={["Distribuidora", "Unidades", "Potência (kW)", "UF sem conjunto"]}
                          numericas={[1, 2]}
                          linhas={fora.por_distribuidora.slice(0, 10).map((x) => [siglaDe.get(x.cnpj) ?? cnpjFormatado(x.cnpj), inteiro(x.unidades), numTexto(x.potencia_kw, 2), x.ufs_fora.join(", ")])}
                        />
                        <TransicaoTabela
                          titulo="Municípios com mais unidades sinalizadas"
                          colunas={["Município", "Código IBGE", "Unidades", "Potência (kW)"]}
                          numericas={[2, 3]}
                          linhas={fora.maiores_municipios.map((x) => [nomesFora.get(x.ibge) ?? "nome indisponível", x.ibge, inteiro(x.unidades), numTexto(x.potencia_kw, 2)])}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-carvao-muted">Conferência indisponível nesta publicação: {fora.motivo}</p>
                  )}
                </TransicaoAuditoria>

                <TransicaoAuditoria titulo="Revisões entre capturas do cadastro">
                  {m.revisoes.capturas_comparadas < 2 ? (
                    <p className="max-w-prose2 text-sm text-carvao-muted">{m.revisoes.nota ?? "Uma única captura integrada: sem revisão medida."}</p>
                  ) : (
                    <TransicaoTabela
                      titulo={`Meses de conexão que mudaram entre ${data(m.revisoes.primeira_captura)} e ${data(m.revisoes.ultima_captura)}`}
                      colunas={["Mês", "Unidades antes", "Unidades depois", "MW antes", "MW depois"]}
                      numericas={[1, 2, 3, 4]}
                      linhas={m.revisoes.meses.map((x) => [mes(x.m), inteiro(x.unidades_primeira), inteiro(x.unidades_ultima), numTexto(x.potencia_mw_primeira, 3), numTexto(x.potencia_mw_ultima, 3)])}
                    />
                  )}
                </TransicaoAuditoria>

                <TransicaoSeguir
                  ancora="p063"
                  href={`${rotaPainel("ons")}#ons`}
                  pergunta={PERGUNTA_ONS}
                  downloads={downloads([
                    "/energia/series/transicao_mmgd_municipios.csv",
                    "/energia/series/transicao_mmgd_municipio_ano_fonte.csv",
                    "/energia/series/transicao_mmgd_uf_mes_fonte.csv",
                    "/energia/series/transicao_mmgd_distribuidoras.csv",
                    "/energia/series/transicao_mmgd_perfil.csv",
                  ])}
                />
              </div>
            </PainelEvidencia>
          </Bloco>

        </ModoProfundidade>
      </main>
    </>
  );
}
