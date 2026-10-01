"use client";

import { useMemo, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
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
  periodoBase,
  recorteEscolhido,
  recortePadraoEna,
  respostaAfluencia,
  textoPasso,
  textoReeNovos,
  type EntidadeEna,
  type PontoRegioes,
  type TipoRecorte,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, mesAno } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";

/**
 * P018, afluência: tipo de recorte (?rec=), recorte escolhido (?ent=), regiões no
 * gráfico semanal (?sms=, até quatro) e o intervalo do gráfico (?de=, ?ate=) ficam na
 * URL. A resposta, os pontos pareados, a tabela equivalente e a exportação usam as
 * mesmas linhas (itensPontosAfluencia e linhasAfluencia sobre a mesma lista). A ENA de
 * 30 dias é a razão de somas publicada na gold; nada é recalculado aqui.
 */
const ESQUEMA = {
  rec: campo(tiposUrl.opcao(TIPOS_RECORTE), "subsistema"),
  ent: campo(tiposUrl.texto({ max: 60 }), ""),
  sms: campo(tiposUrl.lista(tiposUrl.opcao(REGIOES), { max: LIMITE_COMPARACAO }), [...SUBSISTEMAS] as Regiao[]),
  de: campo(tiposUrl.data(), ""),
  ate: campo(tiposUrl.data(), ""),
};

const OPCOES_TIPO = TIPOS_RECORTE.map((t) => ({ id: t, rotulo: ROTULO_TIPO_RECORTE[t] }));

// o universo dos REE cita os REE novos publicados na gold (datas e nomes não ficam escritos aqui)
const universo = (tipo: TipoRecorte, reeNovos: readonly { data: string; novos: string[] }[]): string =>
  tipo === "subsistema"
    ? "Subsistemas do SIN; o SIN soma as ENA e as MLT dos quatro, dia a dia"
    : tipo === "ree"
      ? `Reservatórios equivalentes de energia do ONS (perímetro atual${textoReeNovos(reeNovos)})`
      : "Bacias hidroenergéticas do ONS, inclusive as afluências agrupadas em “outras” do Sul e do Sudeste";

export function AguaAfluencia({
  entidades,
  serie,
  passoDias,
  reeNovos,
  fonte,
  versao,
  destaques,
}: {
  entidades: EntidadeEna[];
  /** ENA de 30 dias (% da MLT) em pontos regulares (passoDias) nos últimos meses publicados, por região. */
  serie: PontoRegioes[];
  passoDias: number;
  /** REE que aparecem depois do início do conjunto (gold: afluencia.ree_novos_por_data). */
  reeNovos: { data: string; novos: string[] }[];
  fonte: string;
  versao: string;
  destaques?: ReactNode;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <AguaEscolha legenda="Recorte" opcoes={OPCOES_TIPO} valor={tipo} onEscolher={(x) => definir({ rec: x, ent: "" })} />
        <AguaLista
          rotulo={tipo === "subsistema" ? "Subsistema" : tipo === "ree" ? "REE" : "Bacia"}
          opcoes={doTipo.map((x) => ({ id: x.id, rotulo: x.rotulo }))}
          valor={e?.id ?? padrao}
          onEscolher={(x) => selecionar(x)}
        />
      </div>

      <p className="max-w-prose2 text-base leading-relaxed text-carvao" data-resposta="p018" aria-live="polite">
        {e ? respostaAfluencia(e) : "Recorte sem dado nesta publicação."}
      </p>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            {e ? `30 dias até ${dataBR(e.dia)}; faixa da mesma janela em ${periodoBase(e.periodo_base)}` : "sem janela"}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">{universo(tipo, reeNovos)}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">% da MLT: soma da ENA bruta (MWmed por dia) dividida pela soma da MLT vigente em cada dia, nos mesmos 30 dias</dd>
        </div>
      </dl>

      {destaques}

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
        nota="Sem ENA de 30 dias: falta dia na janela ou não há MLT (as afluências agrupadas em “outras” não têm MLT publicada). Abaixo de 5 anos na base não há faixa."
      />

      <div className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">
          A ENA de 30 dias{inicio && fim ? ` de ${mesAno(inicio.slice(0, 7))} a ${mesAno(fim.slice(0, 7))}` : ""}
        </h3>
        <Comparador
          rotulo={`Regiões no gráfico (até ${LIMITE_COMPARACAO})`}
          entidades={REGIOES.map((r) => ({ id: r, rotulo: NOME_REGIAO[r], sinonimos: [CURTO_REGIAO[r]] }))}
          selecionadas={regioes}
          onMudar={(ids) => definir({ sms: ids as Regiao[] })}
          dicaBusca="SIN, Sul, Nordeste"
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
          versões da referência (seção sobre a MLT, no modo Analisar).
        </p>
      </div>
    </div>
  );
}
