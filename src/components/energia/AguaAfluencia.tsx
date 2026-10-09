"use client";

import { useMemo, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { AguaLegenda } from "@/components/energia/AguaLegenda";
import { Comparador } from "@/components/energia/Comparador";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { Numero } from "@/components/energia/Numero";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_AFLUENCIA,
  COR_REGIAO,
  CURTO_REGIAO,
  NOME_REGIAO,
  REGIOES,
  ROTULO_TIPO_RECORTE,
  SUBSISTEMAS,
  TIPOS_RECORTE,
  itensPontosAfluencia,
  linhasAfluencia,
  motivoSemEna30d,
  notaEnaDoDia,
  periodoBase,
  recorteEscolhido,
  recortePadraoEna,
  respostaAfluencia,
  textoEnaProvisoria,
  textoFaixaJanela,
  textoPasso,
  textoReeNovos,
  textoRevisoesFicha,
  vereditoAfluencia,
  type EntidadeEna,
  type PontoRegioes,
  type TipoRecorte,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import type { Evidencia } from "@/lib/energia/evidencia";
import { dataBR, mesAno } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";
import type { AguaRevisaoCaptura } from "@/lib/energia/tipos-agua";

/**
 * P018, afluência: tipo de recorte (?rec=), recorte escolhido (?ent=), regiões no
 * gráfico semanal (?sms=, até quatro) e o intervalo do gráfico (?de=, ?ate=) ficam na
 * URL. A resposta, os pontos pareados, a tabela equivalente, a exportação e os números
 * de destaque usam as mesmas linhas (itensPontosAfluencia, linhasAfluencia e os campos
 * da mesma entidade). A ENA de 30 dias é a razão de somas publicada na gold; nada é
 * recalculado aqui.
 *
 * Composição (redesenho): a resposta e os controles abrem o painel e a figura principal
 * (pontos pareados de cada recorte contra a mediana da janela) vem logo depois, com o
 * recorte como legenda; os números do recorte escolhido ficam logo abaixo da figura (a
 * faixa acompanha a seleção, e a ficha de prova só existe para o recorte da gold, o SIN);
 * a tabela equivalente fica recolhida; as notas do painel vêm junto da figura; a
 * evolução em 30 dias é uma seção visível com pergunta própria.
 */
const ESQUEMA = {
  rec: campo(tiposUrl.opcao(TIPOS_RECORTE), "subsistema"),
  ent: campo(tiposUrl.texto({ max: 60 }), ""),
  sms: campo(tiposUrl.lista(tiposUrl.opcao(REGIOES), { max: LIMITE_COMPARACAO }), [...SUBSISTEMAS] as Regiao[]),
  de: campo(tiposUrl.data(), ""),
  ate: campo(tiposUrl.data(), ""),
};

const OPCOES_TIPO = TIPOS_RECORTE.map((t) => ({ id: t, rotulo: ROTULO_TIPO_RECORTE[t] }));

// o universo dos REE cita os REE novos publicados na gold (datas e nomes não ficam escritos aqui); a sigla SIN e o REE vêm por extenso no uso
const universo = (tipo: TipoRecorte, reeNovos: readonly { data: string; novos: string[] }[]): string =>
  tipo === "subsistema"
    ? "Subsistemas do Sistema Interligado Nacional (SIN); o SIN soma as ENA e as MLT dos quatro, dia a dia"
    : tipo === "ree"
      ? `Reservatórios equivalentes de energia (REE) do ONS (perímetro atual${textoReeNovos(reeNovos)})`
      : "Bacias hidroenergéticas do ONS, mais os grupos de afluências que o ONS publica agrupados (“Outras do Sul” e “Outras do Sudeste”), sem MLT";

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function AguaAfluencia({
  entidades,
  serie,
  passoDias,
  reeNovos,
  fonte,
  versao,
  notas,
  evidencias,
  revisoes,
  enderecoMedidas,
}: {
  entidades: EntidadeEna[];
  /** ENA de 30 dias (% da MLT) em pontos regulares (passoDias) nos últimos meses publicados, por região. */
  serie: PontoRegioes[];
  passoDias: number;
  /** REE que aparecem depois do início do conjunto (gold: afluencia.ree_novos_por_data). */
  reeNovos: { data: string; novos: string[] }[];
  fonte: string;
  versao: string;
  /** Notas do painel (NotasDoPainel: o que mudou, como interpretar e o que não é possível concluir), logo depois da figura principal e da tabela. */
  notas?: ReactNode;
  /** Fichas de prova do SIN (ENA bruta e armazenável de 30 dias): aparecem só quando o recorte escolhido é o SIN. */
  evidencias?: { ena30d?: Evidencia | null; enaArm30d?: Evidencia | null };
  /** Revisões do ONS entre as duas capturas mais recentes (a mesma lista da tabela de revisões, em Auditar). */
  revisoes: AguaRevisaoCaptura[];
  /** Página e âncora dos números, repassadas à citação da ficha. */
  enderecoMedidas?: string;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const tipo = v.rec as TipoRecorte;
  const padrao = useMemo(() => recortePadraoEna(entidades, tipo), [entidades, tipo]);
  const e = recorteEscolhido(entidades, tipo, v.ent || padrao, padrao);
  const doTipo = useMemo(() => entidades.filter((x) => x.tipo === tipo), [entidades, tipo]);
  const linhas = useMemo(() => linhasAfluencia(doTipo), [doTipo]);
  const itens = useMemo(() => itensPontosAfluencia(doTipo), [doTipo]);
  const regioes = v.sms as Regiao[];
  const dados = useMemo(() => serie.map((p) => ({ ...p, ref100: 100 })), [serie]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const selecionar = (id: string | null) => id && definir({ ent: id === padrao ? "" : id });
  const inicio = serie[0]?.d;
  const fim = serie[serie.length - 1]?.d;
  // a ficha de prova é a do SIN: só ele a tem
  const ehSin = e?.tipo === "subsistema" && e.id === "SIN";
  const comArmazenavel = !!e && e.pct_mlt_arm_30d !== undefined;
  const revisoesFicha = useMemo(() => textoRevisoesFicha(revisoes), [revisoes]);

  return (
    <div className="space-y-6">
      <div className="grid gap-x-10 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <RespostaCurta id="p018" vivo veredito={e ? vereditoAfluencia(e) : "Recorte sem dado nesta publicação."}>
          {e ? respostaAfluencia(e) : "Recorte sem dado nesta publicação."}
        </RespostaCurta>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <AguaEscolha legenda="Recorte" opcoes={OPCOES_TIPO} valor={tipo} onEscolher={(x) => definir({ rec: x, ent: "" })} />
          <AguaLista
            rotulo={tipo === "subsistema" ? "Subsistema" : tipo === "ree" ? "REE" : "Bacia"}
            opcoes={doTipo.map((x) => ({ id: x.id, rotulo: x.rotulo }))}
            valor={e?.id ?? padrao}
            onEscolher={(x) => selecionar(x)}
          />
        </div>
      </div>

      <GraficoPontos
        titulo={`ENA de 30 dias de cada recorte (${ROTULO_TIPO_RECORTE[tipo]}) e a mediana da mesma janela`}
        itens={itens}
        unidade="% da MLT"
        unidadeDiferenca="p.p."
        casas={1}
        rotuloValor="ENA de 30 dias"
        rotuloReferencia="Mediana da mesma janela nos anos da base"
        corValor="var(--cor-energia)"
        corReferencia="var(--serie-referencia)"
        selecionado={e?.id ?? null}
        onSelecionar={selecionar}
        ordemInicial={{ por: "valor", direcao: "desc" }}
      />

      <AguaLegenda
        periodo={e ? `30 dias até ${dataBR(e.dia)}; ${textoFaixaJanela(e)}` : "sem janela"}
        universo={universo(tipo, reeNovos)}
        unidade="% da MLT: soma da ENA bruta dos 30 dias (MWmed·dia: a média de cada dia, em MWmed, o megawatt médio, somada ao longo dos dias) dividida pela soma da MLT vigente em cada dia. p.p.: ponto percentual, a diferença entre dois percentuais"
      />

      {e && (
        <div data-medidas-recorte="" className="space-y-2">
          <p className="rotulo text-mineral">Números do recorte escolhido: {e.rotulo}</p>
          <FaixaMetricas
            colunas={comArmazenavel ? 4 : 3}
            rotulo={`Indicadores da afluência: ${e.rotulo}`}
            nota={
              <>
                {textoEnaProvisoria(revisoes)} O percentual da MLT é outra régua que o da energia armazenada (EAR): os dois não se comparam.
              </>
            }
          >
            <Numero
              variante="faixa"
              rotulo="ENA bruta de 30 dias"
              natureza="CALCULADO"
              evidencia={ehSin ? evidencias?.ena30d : undefined}
              revisoes={ehSin ? revisoesFicha : undefined}
              valor={e.pct_mlt_30d}
              formato="pct"
              casas={1}
              unidade="da MLT"
              periodo={`30 dias até ${dataBR(e.dia)}`}
              cor="var(--cor-energia)"
              motivoAusencia={cap(motivoSemEna30d(e))}
              endereco={enderecoMedidas}
            />
            <Numero
              variante="faixa"
              rotulo="Mediana da mesma janela"
              natureza="CALCULADO"
              valor={e.p50_30d}
              formato="pct"
              casas={1}
              unidade="da MLT"
              periodo={e.faixa_30d && e.periodo_base ? `mesma janela em ${periodoBase(e.periodo_base)}` : undefined}
              cor="var(--serie-referencia)"
              motivoAusencia={cap(textoFaixaJanela(e))}
            />
            <Numero
              variante="faixa"
              rotulo="ENA do dia"
              natureza="CALCULADO"
              valor={e.ena_mwmed_dia}
              formato="num"
              casas={0}
              unidade="MWmed"
              periodo={dataBR(e.dia)}
              nota={notaEnaDoDia(e) ?? undefined}
              motivoAusencia="Sem ENA do dia nesta publicação."
            />
            {comArmazenavel && (
              <Numero
                variante="faixa"
                rotulo="ENA armazenável de 30 dias"
                natureza="CALCULADO"
                evidencia={ehSin ? evidencias?.enaArm30d : undefined}
                revisoes={ehSin ? revisoesFicha : undefined}
                valor={e.pct_mlt_arm_30d ?? null}
                formato="pct"
                casas={1}
                unidade="da MLT"
                periodo={`30 dias até ${dataBR(e.dia)}`}
                motivoAusencia="Sem ENA armazenável de 30 dias completa nesta publicação."
                nota="Em % da MLT armazenável: vazões naturais menos as vertidas."
                endereco={enderecoMedidas}
              />
            )}
          </FaixaMetricas>
        </div>
      )}

      <TabelaInterativa
        titulo={`Tabela equivalente: ENA de 30 dias, ${ROTULO_TIPO_RECORTE[tipo]}`}
        colunas={COLUNAS_AFLUENCIA}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`agua-afluencia-${tipo}`}
        selecionado={e?.id ?? null}
        onSelecionar={selecionar}
        chaveUrl="afl"
        recolher
        nota="Sem ENA de 30 dias: falta ENA em algum dia da janela, ou não há MLT; os grupos “Outras do Sul” e “Outras do Sudeste”, que o ONS publica agrupados, não têm MLT. Com menos de 5 anos na base, não há faixa."
      />

      {notas}

      <SecaoDoPainel
        id="evolucao"
        titulo={inicio && fim ? `Como a ENA de 30 dias evoluiu de ${mesAno(inicio.slice(0, 7))} a ${mesAno(fim.slice(0, 7))}?` : "Como a ENA de 30 dias evoluiu?"}
      >
        <Comparador
          rotulo={`Regiões no gráfico (até ${LIMITE_COMPARACAO})`}
          entidades={REGIOES.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], sinonimos: [CURTO_REGIAO[r]] }))}
          selecionadas={regioes}
          onMudar={(ids) => definir({ sms: ids as Regiao[] })}
          dicaBusca="Buscar, por exemplo SIN, Sul, Nordeste"
          vazio="Nenhuma região escolhida. Escolha até quatro para ver a ENA de 30 dias na mesma escala."
        >
          {() => null}
        </Comparador>
        {regioes.length > 0 && (
          <GraficoLinhas
            titulo={`ENA bruta de 30 dias em % da MLT, ${textoPasso(passoDias)}`}
            dados={dados}
            chaveX="d"
            series={[
              ...regioes.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], sigla: CURTO_REGIAO[r], cor: COR_REGIAO[r] })),
              { id: "ref100", rotulo: "100% da MLT", cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
            ]}
            unidade="% da MLT"
            casas={1}
            zoom
            intervalo={intervalo}
            onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          />
        )}
        <p className="text-sm text-carvao-muted">
          Cada ponto é a janela de 30 dias que termina naquele dia. A linha de 100% é a própria MLT, que muda de versão: em comparações longas, o percentual mistura
          versões da referência (veja a seção sobre a MLT, mais abaixo). A faixa usual de cada data, do 10º ao 90º percentil, não é publicada para esta série: só a da
          janela mais recente existe, no gráfico de pontos, na tabela e no texto.
        </p>
      </SecaoDoPainel>
    </div>
  );
}
