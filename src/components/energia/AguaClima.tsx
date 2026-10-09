"use client";

import { useMemo, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { AguaLegenda } from "@/components/energia/AguaLegenda";
import { AguaMapaBacias } from "@/components/energia/AguaMapaBacias";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_CHUVA,
  COLUNAS_PREVISAO_CHUVA,
  COLUNAS_PREVISAO_TEMPERATURA,
  COLUNAS_TEMPERATURA,
  CORES_ANOMALIA,
  CURTO_REGIAO,
  COR_REGIAO,
  DO_REGIAO,
  NOME_REGIAO,
  REGIOES,
  classificacaoChuva,
  dadosChuvaMes,
  evidenciaComNome,
  linhasChuva,
  linhasMultiplosChuva,
  linhasPrevisaoChuva,
  linhasPrevisaoTemperatura,
  linhasTemperatura,
  marcaPreliminarSerie,
  mesExtenso,
  mesPreliminar,
  nomeProprio,
  notaAnomaliaTemperatura,
  notaChuvaBacia,
  notaChuvaMes,
  periodoBase,
  periodosMapa,
  respostaChuva,
  respostaChuvaMes,
  respostaPrevisao,
  respostaTemperatura,
  resumoPreliminarChuva,
  resumoPreliminarTemperatura,
  rotuloPeriodoMapa,
  rotuloRecorte,
  rotuloRodada,
  serieDiariaTemperatura,
  serieMensalChuva,
  serieMensalTemperatura,
  seriePrevisao,
  textoAssociacao,
  textoPreliminarChuva,
  textoPreliminarTemperatura,
  textoUltimoMesFinalChuva,
  textoUltimoMesFinalTemperatura,
  valoresMapaChuva,
  vereditoAssociacao,
  vereditoChuva,
  vereditoChuvaMes,
  vereditoTemperatura,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { carimbo, dataBR, mesAno, num, plural } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { AguaPrecipitacaoBacia, AguaPrevisao, AguaTemperatura } from "@/lib/energia/tipos-agua";

/**
 * P019, chuva, temperatura e clima: bacia escolhida (?bac=), período do mapa (?per=, a
 * janela de 30 dias ou um dos 12 meses completos), recorte da temperatura (?rt=) e
 * bacias comparadas (?cmp=, até quatro) ficam na URL. Mapa, tabela equivalente,
 * resposta, números de destaque e histórico da bacia usam a mesma seleção; o mapa e a
 * tabela usam os mesmos valores (valoresMapaChuva e linhasChuva sobre o mesmo período).
 * Estimativa (satélite e reanálise) e previsão (uma rodada de um modelo) ficam em
 * blocos separados, cada um com o seu selo; nenhum cenário é desenhado.
 *
 * Composição (redesenho): o mapa das bacias é a figura principal, logo depois da resposta
 * (milímetros e percentil primeiro, com a cautela ao lado) e dos controles, com o recorte
 * como legenda e a tabela equivalente; as notas do painel e a separação entre observação,
 * estimativa, previsão e cenário vêm junto dele; os números de destaque acompanham a bacia,
 * o período e o recorte de temperatura escolhidos; a chuva mês a mês, a comparação entre bacias,
 * a temperatura e a previsão são seções visíveis com pergunta própria, cada uma com o seu
 * veredito, o seu controle e o seu recorte. Janelas preliminares (IMERG Late e GEOS-IT) dizem
 * que são preliminares, com a recomendação da fonte, e aparecem marcadas nos gráficos.
 */
const ESQUEMA = {
  bac: campo(tiposUrl.texto({ max: 40 }), ""),
  per: campo(tiposUrl.texto({ max: 7 }), "30d"),
  rt: campo(tiposUrl.opcao(REGIOES), "SIN"),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 40 }), { max: LIMITE_COMPARACAO }), ["GRANDE", "PARANAIBA", "SAO FRANCISCO", "TOCANTINS"]),
};

/**
 * As duas medidas de 30 dias que acompanham a escolha: a chuva da bacia e do período do mapa (os milímetros, com o percentil e a cautela na
 * nota) e a anomalia da temperatura do recorte escolhido. Os valores são os campos da própria bacia e do próprio recorte (os mesmos do mapa, da
 * tabela e da resposta). A ficha de prova é a da bacia padrão em 30 dias e a do SIN, as únicas que a gold publica; o nome e o valor da ficha são os
 * do cartão.
 */
export function MedidasClima({
  bacia,
  nomeBacia,
  per,
  base,
  temp,
  baciaPadrao,
  evidencias,
  endereco,
}: {
  bacia: AguaPrecipitacaoBacia;
  nomeBacia: string;
  per: string;
  base: string;
  temp: AguaTemperatura | null;
  baciaPadrao: string;
  evidencias?: { chuva30d?: Evidencia | null; temperaturaSin30d?: Evidencia | null };
  endereco?: string;
}) {
  const ehMes = per !== "30d";
  const mes = ehMes ? dadosChuvaMes(bacia, per) : null;
  const valorChuva = ehMes ? (mes?.mm ?? null) : bacia.mm_30d;
  const chuvaPadrao = bacia.bacia === baciaPadrao && !ehMes;
  return (
    <FaixaMetricas colunas={2} rotulo="Medidas de chuva e de temperatura estimadas">
      <Numero
        variante="faixa"
        rotulo={`${ehMes ? "Chuva do mês" : "Chuva de 30 dias"}, ${nomeBacia}`}
        natureza="ESTIMADO"
        evidencia={chuvaPadrao && evidencias?.chuva30d ? evidenciaComNome(evidencias.chuva30d, `Chuva de 30 dias, ${nomeBacia}`, `${num(valorChuva, 1)} mm`) : undefined}
        valor={valorChuva}
        formato="num"
        casas={1}
        unidade="mm"
        periodo={ehMes ? mesExtenso(per) : `30 dias até ${dataBR(bacia.dia)}`}
        cor="var(--serie-hidraulica)"
        nota={ehMes ? notaChuvaMes(bacia, per, base) : notaChuvaBacia(bacia, base)}
        motivoAusencia="Sem estimativa de chuva nesta publicação: algum dia ficou abaixo de 80% de cobertura."
        endereco={endereco}
      />
      {temp && (
        <Numero
          variante="faixa"
          rotulo={`Anomalia da temperatura, ${NOME_REGIAO[temp.recorte]}, em 30 dias`}
          natureza="ESTIMADO"
          evidencia={temp.recorte === "SIN" ? evidencias?.temperaturaSin30d : undefined}
          valor={temp.anomalia_30d_c}
          formato="num"
          casas={1}
          unidade="°C"
          periodo={`30 dias até ${dataBR(temp.dia)}`}
          cor="var(--serie-termica)"
          nota={`${notaAnomaliaTemperatura(temp, base)}${temp.preliminar_30d ? " A janela é preliminar." : ""}`}
          motivoAusencia="Sem temperatura de 30 dias nesta publicação."
          endereco={endereco}
        />
      )}
    </FaixaMetricas>
  );
}

export function AguaClima({
  precipitacao,
  temperatura,
  previsao,
  base,
  baciaPadrao,
  urlGeo,
  fonteChuva,
  fonteTemperatura,
  versaoChuva,
  versaoTemperatura,
  corteImergFinal,
  corteMerra2,
  evidencias,
  enderecoMedidas,
  notaSemContorno,
  inicioCsvDiario,
  notas,
  aposNotas,
  fecho,
  motivoSemPrevisao,
}: {
  precipitacao: AguaPrecipitacaoBacia[];
  temperatura: AguaTemperatura[];
  previsao: AguaPrevisao | null;
  base: string;
  baciaPadrao: string;
  urlGeo: string;
  fonteChuva: string;
  fonteTemperatura: string;
  versaoChuva: string;
  versaoTemperatura: string;
  /** Último dia com IMERG Final (depois dele, IMERG Late) e último dia com MERRA-2 (depois dele, GEOS-IT), lidos da gold. */
  corteImergFinal: string;
  corteMerra2: string;
  /** Fichas de prova da gold: a chuva da bacia padrão em 30 dias e a temperatura do SIN. Só aparecem quando a seleção é essa. */
  evidencias?: { chuva30d?: Evidencia | null; temperaturaSin30d?: Evidencia | null };
  /** Página e âncora dos números de destaque, repassadas à citação da ficha. */
  enderecoMedidas?: string;
  /** Frase das bacias do ONS que ficam sem chuva estimada por não terem contorno no mapa. */
  notaSemContorno?: string;
  /** Ano em que começa o CSV diário público de chuva (lido do rótulo do arquivo na gold), para dizer que a média da base não se reproduz só com ele. */
  inicioCsvDiario?: string | null;
  /** Notas do painel (NotasDoPainel: o que mudou, como interpretar e o que não é possível concluir), logo depois do mapa e da tabela. */
  notas?: ReactNode;
  /** Seção que vem logo depois dos números de destaque: o que é observação, estimativa, previsão e cenário. */
  aposNotas?: ReactNode;
  /** Último item visível em Entender: onde a relação com a demanda e com a afluência é medida. */
  fecho?: ReactNode;
  motivoSemPrevisao: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const periodos = useMemo(() => periodosMapa(precipitacao), [precipitacao]);
  const per = periodos.includes(v.per) ? v.per : "30d";
  const ehMes = per !== "30d";
  const bacia = precipitacao.find((b) => b.bacia === v.bac) ?? precipitacao.find((b) => b.bacia === baciaPadrao) ?? precipitacao[0] ?? null;
  const rt = v.rt as Regiao;
  const temp = temperatura.find((t) => t.recorte === rt) ?? temperatura.find((t) => t.recorte === "SIN") ?? null;
  const dia30 = precipitacao[0]?.dia ?? null;
  const valores = useMemo(() => valoresMapaChuva(precipitacao, per), [precipitacao, per]);
  const classes = useMemo(() => classificacaoChuva(valores), [valores]);
  const linhas = useMemo(() => linhasChuva(precipitacao, per), [precipitacao, per]);
  const nomes = useMemo(() => Object.fromEntries(precipitacao.map((b) => [b.bacia, rotuloRecorte("bacia", b.bacia)])), [precipitacao]);
  const historico = useMemo(() => (bacia ? serieMensalChuva(bacia) : []), [bacia]);
  const escolhidas = useMemo(
    () => (v.cmp as string[]).map((id) => precipitacao.find((b) => b.bacia === id)).filter((b): b is AguaPrecipitacaoBacia => !!b),
    [v.cmp, precipitacao],
  );
  const multiplos = useMemo(() => linhasMultiplosChuva(escolhidas), [escolhidas]);
  const tDiaria = useMemo(() => (temp ? serieDiariaTemperatura(temp) : []), [temp]);
  const tMensal = useMemo(() => (temp ? serieMensalTemperatura(temp) : []), [temp]);
  const linhasTemp = useMemo(() => linhasTemperatura(temperatura), [temperatura]);
  const prev = useMemo(() => (previsao && bacia ? seriePrevisao(previsao, bacia.bacia) : []), [previsao, bacia]);
  const selecionar = (id: string | null) => id && definir({ bac: id === baciaPadrao ? "" : id });
  const assoc = bacia ? textoAssociacao(bacia) : null;
  // base, janelas e períodos dos títulos saem da gold (tamanho das séries publicadas), nunca de número escrito aqui
  const baseTxt = periodoBase(base);
  const baseAssoc = periodoBase(precipitacao.find((b) => b.associacao_ena?.periodo)?.associacao_ena?.periodo ?? base);
  const mesesHistorico = plural(historico.length, "mês completo", "meses completos");
  const mesesMultiplos = plural(multiplos.length, "mês completo", "meses completos");

  const mes = bacia && ehMes ? dadosChuvaMes(bacia, per) : null;
  // a cautela fica numa frase junto da resposta; a explicação inteira (produto da base, recomendação da fonte) abre logo abaixo
  const resumoChuva = bacia ? (ehMes ? (mes?.preliminar ? "O mês tem dias do IMERG Late (preliminar)." : "") : resumoPreliminarChuva(bacia.dia, corteImergFinal)) : "";
  const prelimChuva = bacia
    ? ehMes
      ? mes?.preliminar
        ? "O mês tem dias do IMERG Late, sem calibração por pluviômetros, e a média do mês é de produto final."
        : ""
      : [textoPreliminarChuva(bacia.dia, corteImergFinal), textoPreliminarChuva(bacia.dia, corteImergFinal) ? textoUltimoMesFinalChuva(bacia, base) : ""].filter(Boolean).join(" ")
    : "";
  const resumoTemp = temp ? resumoPreliminarTemperatura(temp.dia, corteMerra2) : "";
  const prelimTemp = temp ? [textoPreliminarTemperatura(temp.dia, corteMerra2), textoPreliminarTemperatura(temp.dia, corteMerra2) ? textoUltimoMesFinalTemperatura(temp, corteMerra2, base) : ""].filter(Boolean).join(" ") : "";
  const marcaTemp = useMemo(
    () => marcaPreliminarSerie(tDiaria.map((p) => p.d), corteMerra2, "GEOS-IT a partir daqui (preliminar)"),
    [tDiaria, corteMerra2],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="flex flex-col gap-3">
          <RespostaCurta
            id="p019"
            vivo
            veredito={!bacia ? "Sem estimativa de chuva por bacia nesta publicação." : ehMes ? vereditoChuvaMes(bacia, per) : vereditoChuva(bacia)}
          >
            {!bacia ? "Sem estimativa de chuva por bacia nesta publicação." : ehMes ? respostaChuvaMes(bacia, per, base) : respostaChuva(bacia, base)}
          </RespostaCurta>
          {bacia && (
            <details data-cautela="chuva" className="max-w-prose2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao-muted">
              <summary className="min-h-[44px] cursor-pointer py-1">
                {resumoChuva} Com média de poucos milímetros, o percentual de anomalia cresce muito: leia os milímetros e o percentil.{" "}
                {prelimChuva && <span className="text-energia-dark underline underline-offset-4">Por que a janela é preliminar</span>}
              </summary>
              {prelimChuva && <p className="pb-2">{prelimChuva}</p>}
            </details>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <AguaLista rotulo="Bacia" opcoes={precipitacao.map((b) => ({ id: b.bacia, rotulo: nomes[b.bacia] }))} valor={bacia?.bacia ?? ""} onEscolher={(x) => selecionar(x)} />
          <AguaLista
            rotulo="Período do mapa"
            opcoes={periodos.map((p) => ({ id: p, rotulo: rotuloPeriodoMapa(p, dia30) }))}
            valor={per}
            onEscolher={(x) => definir({ per: x })}
          />
        </div>
      </div>

      <AguaMapaBacias
        titulo="Chuva estimada por bacia contra a média dos mesmos dias, em %"
        fonteGeometria={urlGeo}
        valores={valores}
        classificacao={classes}
        cores={CORES_ANOMALIA}
        unidade="% da média"
        casas={1}
        nomes={nomes}
        selecionado={bacia?.bacia ?? null}
        onSelecionar={selecionar}
        periodo={rotuloPeriodoMapa(per, dia30)}
        nota={`Anomalia = chuva do período ÷ média dos mesmos dias (ou do mesmo mês) em ${baseTxt} − 1. No período seco, médias pequenas geram percentuais grandes: confira os milímetros na tabela.`}
        notaSemContorno={notaSemContorno}
      />

      <AguaLegenda
        periodo={`Chuva: ${rotuloPeriodoMapa(per, dia30)}; média da base em ${baseTxt}`}
        universo="Chuva estimada por satélite (IMERG, produto de chuva da NASA calibrado por pluviômetros): média dos pontos de grade dentro do contorno de cada bacia do Operador Nacional do Sistema Elétrico (ONS), ponderada pela área"
        unidade="mm de chuva acumulada; anomalia em % da média da base; percentil: a posição da chuva entre as dos mesmos dias de anos anteriores"
      />

      <TabelaInterativa
        titulo={`Tabela equivalente ao mapa: chuva por bacia, ${rotuloPeriodoMapa(per, dia30)}`}
        colunas={COLUNAS_CHUVA}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonteChuva}
        versao={versaoChuva}
        nomeArquivo={`agua-chuva-bacias-${per}`}
        selecionado={bacia?.bacia ?? null}
        onSelecionar={selecionar}
        chaveUrl="chu"
        nota={`Percentil e cobertura só na janela de 30 dias. A correlação com a ENA é associação descritiva (${baseAssoc}), não causa.${
          bacia && !ehMes && bacia.media_30d_base !== null
            ? ` A média de ${nomes[bacia.bacia]}, ${num(bacia.media_30d_base, 1)} mm, usa ${baseTxt}${inicioCsvDiario ? `, mas o CSV diário público começa em ${inicioCsvDiario}` : ""}: ela não se reproduz só com esse arquivo.`
            : ""
        }`}
      />

      {notas}

      {bacia && (
        <SecaoDoPainel
          id="medidas"
          titulo="Quanto a chuva e a temperatura escolhidas se afastam da média?"
          lead="A chuva é a da bacia e do período escolhidos no mapa; a temperatura é a do recorte escolhido na seção de temperatura. As duas são estimativas, com datas e fontes próprias, e não equivalem à afluência nem ao armazenamento."
        >
          <MedidasClima bacia={bacia} nomeBacia={nomes[bacia.bacia]} per={per} base={base} temp={temp} baciaPadrao={baciaPadrao} evidencias={evidencias} endereco={enderecoMedidas} />
        </SecaoDoPainel>
      )}

      {aposNotas}

      {bacia && (
        <SecaoDoPainel id="historico" titulo="Como a chuva de cada mês se compara com a média do mês?">
          <GraficoLinhas
            titulo={`${nomes[bacia.bacia]}: chuva em cada um dos últimos ${mesesHistorico} e a média do mesmo mês`}
            dados={historico}
            chaveX="m"
            formatoX="mes"
            series={[
              { id: "mm", rotulo: "Chuva estimada no mês", cor: "var(--serie-hidraulica)", espessura: 2.5 },
              { id: "media", rotulo: `Média do mês em ${periodoBase(base)}`, cor: "var(--serie-referencia)", tracejada: true },
            ]}
            banda={{ inferior: "p10", superior: "p90", rotulo: "10º a 90º percentil do mês" }}
            marcos={bacia.mensal.preliminar_desde ? [{ x: bacia.mensal.preliminar_desde, rotulo: "dias do IMERG Late a partir daqui" }] : []}
            unidade="mm"
            casas={1}
            zeroNoEixo
          />
          {bacia.mensal.preliminar_desde && (
            <p className="text-sm text-carvao-muted">
              Desde {mesAno(bacia.mensal.preliminar_desde)} os meses têm dias do IMERG Late (preliminar, sem calibração por pluviômetros): a marca vertical do gráfico mostra onde começam.
            </p>
          )}
          {assoc && (
            <RespostaCurta id="p019-associacao" vivo depois tamanho="sm" veredito={vereditoAssociacao(bacia) ?? assoc}>
              {assoc}
            </RespostaCurta>
          )}
        </SecaoDoPainel>
      )}

      <SecaoDoPainel id="comparar-bacias" titulo="Como a chuva mensal se compara entre bacias?">
        <Comparador
          rotulo={`Bacias comparadas (até ${LIMITE_COMPARACAO})`}
          entidades={precipitacao.map((b) => ({ id: b.bacia, rotulo: nomes[b.bacia], sinonimos: [b.bacia] }))}
          selecionadas={escolhidas.map((b) => b.bacia)}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca="Buscar, por exemplo Grande, Paranaíba, São Francisco"
          vazio="Nenhuma bacia escolhida. Escolha até quatro para ver a chuva mensal e a média na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <PequenosMultiplos
            titulo={`Chuva mensal estimada e média do mês, últimos ${mesesMultiplos}`}
            dados={multiplos}
            chaveX="m"
            formatoX="mes"
            unidade="mm"
            casas={1}
            zeroNoEixo
            colunas={escolhidas.length >= 4 ? 4 : escolhidas.length >= 3 ? 3 : 2}
            nivelTitulo={4}
            paineis={escolhidas.map((b) => ({
              id: b.bacia,
              titulo: nomes[b.bacia],
              // a mesma grandeza tem a mesma cor em todos os painéis e na seção da bacia (chuva estimada no mês); o nome da bacia é o do painel
              series: [
                { id: b.bacia, rotulo: `Chuva no mês, ${nomes[b.bacia]}`, cor: "var(--serie-hidraulica)", espessura: 2 },
                { id: `${b.bacia}·media`, rotulo: `Média do mês, ${nomes[b.bacia]}`, cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
              ],
            }))}
          />
        )}
      </SecaoDoPainel>

      <SecaoDoPainel id="temperatura" titulo="Como a temperatura estimada se compara com a média dos mesmos dias?">
        <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="flex flex-col gap-3">
            <RespostaCurta id="p019-temperatura" vivo depois veredito={temp ? vereditoTemperatura(temp) : "Sem temperatura estimada nesta publicação."}>
              {temp ? respostaTemperatura(temp, base) : "Sem temperatura estimada nesta publicação."}
            </RespostaCurta>
            {prelimTemp && (
              <details data-cautela="temperatura" className="max-w-prose2 border-l-2 border-aviso pl-3 text-sm leading-relaxed text-carvao-muted">
                <summary className="min-h-[44px] cursor-pointer py-1">
                  {resumoTemp} <span className="text-energia-dark underline underline-offset-4">Por que a janela é preliminar</span>
                </summary>
                <p className="pb-2">{prelimTemp}</p>
              </details>
            )}
          </div>
          <AguaEscolha
            legenda="Temperatura (SIN: Sistema Interligado Nacional)"
            opcoes={REGIOES.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], detalhe: NOME_REGIAO[r] }))}
            valor={rt}
            onEscolher={(x) => definir({ rt: x })}
          />
        </div>
        {temp && (
          <>
            <GraficoLinhas
              titulo={`Temperatura média diária ${DO_REGIAO[temp.recorte]} nos últimos ${plural(tDiaria.length, "dia", "dias")}, com a faixa do mesmo dia`}
              dados={tDiaria}
              chaveX="d"
              series={[
                { id: "t", rotulo: "Média do dia", cor: COR_REGIAO[temp.recorte], espessura: 2.5 },
                { id: "tmax", rotulo: "Média das máximas das células", cor: "var(--serie-termica)", tracejada: true },
              ]}
              banda={{ inferior: "p10", superior: "p90", rotulo: `10º a 90º percentil da média do mesmo dia (${periodoBase(base)})` }}
              marcos={marcaTemp.marcos}
              unidade="°C"
              casas={1}
            />
            <p className="text-sm text-carvao-muted">
              {marcaTemp.todaPreliminar
                ? `Todos os dias deste gráfico vêm do GEOS-IT, preliminar (o MERRA-2 vai até ${dataBR(corteMerra2)}), e a faixa do mesmo dia é do MERRA-2. `
                : marcaTemp.marcos.length
                  ? "A marca vertical mostra onde a temperatura passa a vir do GEOS-IT, preliminar. "
                  : ""}
              A linha tracejada é a média, ponderada pela população, das temperaturas máximas de cada célula, e não a temperatura máxima do recorte.
            </p>
            <GraficoBarras
              titulo={`Anomalia da temperatura média mensal ${DO_REGIAO[temp.recorte]}, últimos ${plural(tMensal.length, "mês completo", "meses completos")}`}
              dados={tMensal.map((x) => ({ m: x.m, rotulo: `${mesAno(x.m)}${mesPreliminar(x.m, corteMerra2) ? "*" : ""}`, anomalia: x.anomalia }))}
              chaveCategoria="m"
              chaveRotulo="rotulo"
              series={[{ id: "anomalia", rotulo: `Diferença para a média do mês em ${periodoBase(base)}`, cor: "var(--serie-termica)" }]}
              unidade="°C"
              casas={2}
            />
            {tMensal.some((x) => mesPreliminar(x.m, corteMerra2)) && (
              <p className="text-sm text-carvao-muted" data-nota="temperatura-preliminar">
                * Mês com dias do GEOS-IT (preliminar): a barra mistura MERRA-2 e GEOS-IT e pode mudar quando o MERRA-2 chegar.
              </p>
            )}
          </>
        )}
        <AguaLegenda
          periodo={`Temperatura: 30 dias até ${dataBR(temp?.dia)}; média da base em ${baseTxt}`}
          universo="Temperatura estimada por reanálise (MERRA-2, da NASA: um modelo da atmosfera ajustado a observações; nos dias mais recentes, GEOS-IT, ainda preliminar): células mais populosas de cada UF, ponderadas pela população, somadas por subsistema"
          unidade="°C e anomalia em °C; percentil: a posição da temperatura entre as dos mesmos dias de anos anteriores"
        />
        <TabelaInterativa
          titulo="Tabela equivalente: temperatura de 30 dias por recorte"
          colunas={COLUNAS_TEMPERATURA}
          linhas={linhasTemp}
          chaveLinha="id"
          colunaRotulo="rotulo"
          fonte={fonteTemperatura}
          versao={versaoTemperatura}
          nomeArquivo="agua-temperatura-30d"
          selecionado={rt}
          onSelecionar={(id) => id && definir({ rt: id as Regiao })}
          recolher
        />
      </SecaoDoPainel>

      <div data-natureza="PREVISTO">
        <SecaoDoPainel
          id="previsao"
          tracejada
          titulo="O que a previsão de uma rodada mostra para os próximos dias?"
          lead="Previsão meteorológica: uma rodada de um modelo, não observação. Os dias são dias UTC, o horário universal, três horas à frente de Brasília."
        >
          {previsao ? (
            <>
              <p className="max-w-prose2 text-sm leading-relaxed text-carvao" data-texto="previsao">
                {bacia ? respostaPrevisao(previsao, bacia.bacia) : ""}
              </p>
              <p className="text-xs text-carvao-muted">
                Rodada de {rotuloRodada(previsao.emitida_em)}, capturada em {carimbo(previsao.capturada_em)}
                {previsao.idade_horas !== null ? `, com ${num(previsao.idade_horas, 0)} horas no processamento` : ""}. {previsao.comparabilidade} ECMWF: Centro Europeu de
                Previsão do Tempo a Médio Prazo; IFS: o modelo global dele.
              </p>
              {bacia && (
                <GraficoBarras
                  titulo={`Chuva prevista por dia na bacia do ${nomeProprio(bacia.bacia)} (dia UTC)`}
                  dados={prev.map((p) => ({ d: p.d, rotulo: dataBR(p.d), mm: p.mm }))}
                  chaveCategoria="d"
                  chaveRotulo="rotulo"
                  series={[{ id: "mm", rotulo: "Chuva prevista", cor: "var(--cor-previsto)" }]}
                  unidade="mm"
                  casas={1}
                />
              )}
              <GraficoLinhas
                titulo="Temperatura média prevista por dia (dia UTC), por recorte"
                dados={prev}
                chaveX="d"
                series={REGIOES.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], sigla: CURTO_REGIAO[r], cor: COR_REGIAO[r], tracejada: true }))}
                unidade="°C"
                casas={1}
              />
              <TabelaInterativa
                titulo="Chuva prevista por bacia e a média IMERG dos mesmos dias"
                colunas={COLUNAS_PREVISAO_CHUVA}
                linhas={linhasPrevisaoChuva(previsao)}
                chaveLinha="id"
                colunaRotulo="rotulo"
                fonte={`${previsao.modelo} (previsão); NASA POWER IMERG (média)`}
                versao={previsao.emitida_em}
                nomeArquivo="agua-previsao-chuva"
                selecionado={bacia?.bacia ?? null}
                onSelecionar={selecionar}
              />
              <TabelaInterativa
                titulo="Temperatura média prevista nos 7 primeiros dias e a média MERRA-2 dos mesmos dias"
                colunas={COLUNAS_PREVISAO_TEMPERATURA}
                linhas={linhasPrevisaoTemperatura(previsao)}
                chaveLinha="id"
                colunaRotulo="rotulo"
                fonte={`${previsao.modelo} (previsão); NASA POWER MERRA-2 (média)`}
                versao={previsao.emitida_em}
                nomeArquivo="agua-previsao-temperatura"
                recolher
              />
            </>
          ) : (
            <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
              {motivoSemPrevisao}
            </p>
          )}
        </SecaoDoPainel>
      </div>

      {fecho}
    </div>
  );
}
