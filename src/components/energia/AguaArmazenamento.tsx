"use client";

import { useMemo, type ReactNode } from "react";
import { AguaEscolha, AguaLista } from "@/components/energia/AguaControles";
import { Comparador } from "@/components/energia/Comparador";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";
import { GraficoPontos } from "@/components/energia/GraficoPontos";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import {
  COLUNAS_ARMAZENAMENTO,
  COR_COMPARACAO,
  COR_REGIAO,
  CURTO_REGIAO,
  NOME_REGIAO,
  ROTULO_TIPO_RECORTE,
  SUBSISTEMAS,
  TIPOS_RECORTE,
  anoInicial,
  doRecorte,
  itensPontosArmazenamento,
  linhasArmazenamento,
  linhasMultiplos,
  periodoBase,
  recorteEscolhido,
  recortePadrao,
  respostaArmazenamento,
  vereditoArmazenamento,
  serieSemanal,
  textoForaDosPontos,
  textoPasso,
  textoPesoSubsistemas,
  type EntidadeEar,
  type PontoMensalEar,
  type PontoRegioes,
  type TipoRecorte,
} from "@/lib/energia/agua";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR, plural } from "@/lib/energia/formato";
import { LIMITE_COMPARACAO } from "@/lib/energia/tabela";
import type { Regiao } from "@/lib/energia/tipos";

/**
 * P017, armazenamento: tipo de recorte (?rec=), recorte escolhido (?ent=), recortes
 * comparados nos pequenos múltiplos (?cmp=, até quatro), o intervalo do histórico
 * mensal (?de=, ?ate=) e o da série diária em MWmês (?dde=, ?date=) ficam na URL;
 * voltar e avançar refazem o recorte e o zoom. A resposta, os
 * pontos pareados, a tabela equivalente e a exportação usam as mesmas linhas
 * (linhasArmazenamento e itensPontosArmazenamento sobre a mesma lista), e a resposta é
 * refeita pela mesma regra quando o recorte muda. O padrão (subsistemas, SIN, os quatro
 * subsistemas na comparação) não é gravado na URL.
 */
const ESQUEMA = {
  rec: campo(tiposUrl.opcao(TIPOS_RECORTE), "subsistema"),
  ent: campo(tiposUrl.texto({ max: 60 }), ""),
  cmp: campo(tiposUrl.lista(tiposUrl.texto({ max: 60 }), { max: LIMITE_COMPARACAO }), [...SUBSISTEMAS] as string[]),
  de: campo(tiposUrl.mes(), ""),
  ate: campo(tiposUrl.mes(), ""),
  dde: campo(tiposUrl.data(), ""),
  date: campo(tiposUrl.data(), ""),
};

const OPCOES_TIPO = TIPOS_RECORTE.map((t) => ({ id: t, rotulo: ROTULO_TIPO_RECORTE[t] }));

const UNIVERSO: Record<TipoRecorte, string> = {
  subsistema: "Subsistemas do SIN publicados pelo ONS; o SIN é a soma das EAR dos quatro sobre a soma das EAR máximas, no mesmo dia",
  ree: "Reservatórios equivalentes de energia (REE) do ONS, cada um com o próprio perímetro e a própria EAR máxima",
  bacia: "Bacias hidroenergéticas do ONS; bacias só com usinas a fio d'água não têm armazenamento (não se aplica)",
};

export function AguaArmazenamento({
  entidades,
  diaria,
  mensal,
  textoMensal,
  fonte,
  versao,
  destaques,
}: {
  entidades: EntidadeEar[];
  /** EAR diária por subsistema e SIN nos últimos dias publicados na gold (MWmês). */
  diaria: PontoRegioes[];
  /** EAR no último dia de cada mês desde o início da série (MWmês), com a EAR máxima do SIN. */
  mensal: PontoMensalEar[];
  textoMensal: string;
  fonte: string;
  versao: string;
  destaques?: ReactNode;
}) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const tipo = v.rec as TipoRecorte;
  const padrao = useMemo(() => recortePadrao(entidades, tipo), [entidades, tipo]);
  const e = recorteEscolhido(entidades, tipo, v.ent || padrao, padrao);
  const doTipo = useMemo(() => entidades.filter((x) => x.tipo === tipo), [entidades, tipo]);
  const linhas = useMemo(() => linhasArmazenamento(doTipo), [doTipo]);
  const itens = useMemo(() => itensPontosArmazenamento(doTipo), [doTipo]);
  const semanal = useMemo(() => serieSemanal(e?.semanal ?? null), [e]);
  const comArmazenamento = useMemo(() => entidades.filter((x) => !x.sem_armazenamento && x.semanal), [entidades]);
  const escolhidas = useMemo(
    () => (v.cmp as string[]).map((id) => comArmazenamento.find((x) => x.id === id)).filter((x): x is EntidadeEar => !!x),
    [v.cmp, comArmazenamento],
  );
  const multiplos = useMemo(() => linhasMultiplos(escolhidas), [escolhidas]);
  const intervalo = v.de && v.ate ? { inicio: v.de, fim: v.ate } : null;
  const intervaloDiario = v.dde && v.date ? { inicio: v.dde, fim: v.date } : null;
  const cor = e && e.tipo === "subsistema" ? COR_REGIAO[e.id as Regiao] : "var(--cor-energia)";
  // períodos e passos dos títulos saem das séries publicadas, nunca de número escrito aqui
  const passoMultiplos = escolhidas.find((x) => x.semanal)?.semanal?.passo_dias ?? null;
  const diasDiaria = plural(diaria.length, "dia", "dias");
  const anoMensal = anoInicial(mensal[0]?.m);
  const fora = textoForaDosPontos(doTipo);
  const peso = textoPesoSubsistemas(entidades);
  const selecionar = (id: string | null) => id && definir({ ent: id === padrao ? "" : id });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <AguaEscolha legenda="Recorte" opcoes={OPCOES_TIPO} valor={tipo} onEscolher={(x) => definir({ rec: x, ent: "" })} />
        <AguaLista
          rotulo={tipo === "subsistema" ? "Subsistema" : tipo === "ree" ? "REE" : "Bacia"}
          opcoes={doTipo.map((x) => ({ id: x.id, rotulo: x.sem_armazenamento ? `${x.rotulo} (sem armazenamento)` : x.rotulo }))}
          valor={e?.id ?? padrao}
          onEscolher={(x) => selecionar(x)}
        />
      </div>

      <RespostaCurta id="p017" vivo veredito={e ? vereditoArmazenamento(e) : "Recorte sem dado nesta publicação."}>
        {e ? respostaArmazenamento(e) : "Recorte sem dado nesta publicação."}
      </RespostaCurta>

      <dl className="grid gap-x-6 gap-y-1 text-xs text-carvao-muted sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-0.5">
            {e?.dia ? `${dataBR(e.dia)}; faixa do mesmo dia do calendário em ${periodoBase(e.periodo_base)}` : "sem dia de referência"}
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Universo</dt>
          <dd className="mt-0.5">{UNIVERSO[tipo]}</dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Unidade</dt>
          <dd className="mt-0.5">
            MWmês (energia armazenada; 1 MWmês = 720 MWh) e % da EAR máxima do próprio recorte; p.p., pontos percentuais: de 60% para 62% são 2 p.p.
          </dd>
        </div>
      </dl>

      {destaques}

      {e && !e.sem_armazenamento && semanal.length > 0 ? (
        <GraficoLinhas
          titulo={`EAR ${doRecorte(e.tipo, e.nome)} no último ano, ${e.semanal ? textoPasso(e.semanal.passo_dias) : ""}, com a faixa do 10º ao 90º percentil da mesma data`}
          dados={semanal}
          chaveX="d"
          series={[{ id: "v", rotulo: e.rotulo, cor, espessura: 2.5 }]}
          banda={{ inferior: "p10", superior: "p90", rotulo: `10º a 90º percentil da data (${periodoBase(e.periodo_base)})` }}
          unidade="%"
          casas={1}
        />
      ) : (
        <p role="status" className="border border-dashed border-linha bg-superficie px-5 py-4 text-sm text-carvao-muted">
          {e?.sem_armazenamento
            ? "Este recorte não tem armazenamento (EAR máxima zero): não há série em % nem faixa sazonal; a EAR em MWmês, zero, está na tabela."
            : "Sem série do último ano para este recorte nesta publicação."}
        </p>
      )}

      <GraficoPontos
        titulo={`EAR de cada recorte (${ROTULO_TIPO_RECORTE[tipo]}) no dia e a mediana da mesma data`}
        itens={itens}
        unidade="%"
        casas={1}
        rotuloValor="EAR do dia"
        rotuloReferencia="Mediana da data nos anos da base"
        corValor="var(--cor-energia)"
        corReferencia="var(--serie-referencia)"
        selecionado={e?.id ?? null}
        onSelecionar={selecionar}
        ordemInicial={{ por: "valor", direcao: "desc" }}
      />
      {fora && (
        <p className="text-sm text-carvao-muted" data-texto="fora-dos-pontos">
          {fora}
        </p>
      )}
      <TabelaInterativa
        titulo={`Tabela equivalente: ${ROTULO_TIPO_RECORTE[tipo]}, EAR do dia, faixa da data e variação`}
        colunas={COLUNAS_ARMAZENAMENTO}
        linhas={linhas}
        chaveLinha="id"
        colunaRotulo="rotulo"
        fonte={fonte}
        versao={versao}
        nomeArquivo={`agua-armazenamento-${tipo}`}
        selecionado={e?.id ?? null}
        onSelecionar={selecionar}
        chaveUrl="arm"
        nota="Recortes sem armazenamento aparecem com percentual vazio e posição “não se aplica”; com menos de 5 anos na base, não há faixa."
      />

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Até quatro recortes na mesma escala</h3>
        <Comparador
          rotulo={`Recortes comparados (até ${LIMITE_COMPARACAO})`}
          entidades={comArmazenamento.map((x) => ({ id: x.id, rotulo: x.rotulo, detalhe: ROTULO_TIPO_RECORTE[x.tipo], sinonimos: [x.nome] }))}
          selecionadas={escolhidas.map((x) => x.id)}
          onMudar={(ids) => definir({ cmp: ids })}
          dicaBusca="Buscar, por exemplo SIN, Sul, REE Paraná, Bacia do Grande"
          vazio="Nenhum recorte escolhido. Escolha até quatro para ver a EAR do último ano com a faixa da data, na mesma escala."
        >
          {() => null}
        </Comparador>
        {escolhidas.length > 0 && (
          <PequenosMultiplos
            titulo={`EAR no último ano (% da EAR máxima)${passoMultiplos ? `, ${textoPasso(passoMultiplos)}` : ""}, com o 10º e o 90º percentil da data`}
            dados={multiplos}
            chaveX="d"
            unidade="%"
            casas={1}
            colunas={escolhidas.length >= 4 ? 4 : escolhidas.length >= 3 ? 3 : 2}
            paineis={escolhidas.map((x, i) => ({
              id: x.id,
              titulo: x.rotulo,
              nota: x.capacidade_mudou_na_base ? "EAR máxima mudou mais de 5% na base" : undefined,
              series: [
                { id: x.id, rotulo: "EAR", cor: COR_COMPARACAO[i % COR_COMPARACAO.length], espessura: 2 },
                { id: `${x.id}·p10`, rotulo: "10º percentil da data", cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
                { id: `${x.id}·p90`, rotulo: "90º percentil da data", cor: "var(--serie-referencia)", tracejada: true, espessura: 1 },
              ],
            }))}
          />
        )}
        <p className="text-sm text-carvao-muted">
          O percentual de cada painel é da EAR máxima do próprio recorte: a mesma altura em dois painéis é o mesmo grau de enchimento, não a mesma energia. A energia de cada
          recorte em MWmês está na tabela.
        </p>
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">Energia armazenada nos últimos {diasDiaria}, em MWmês</h3>
        <GraficoLinhas
          titulo={`EAR diária por subsistema nos últimos ${diasDiaria}`}
          dados={diaria}
          chaveX="d"
          series={SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: NOME_REGIAO[sm], sigla: CURTO_REGIAO[sm], cor: COR_REGIAO[sm] }))}
          unidade="MWmês"
          casas={0}
          zoom
          intervalo={intervaloDiario}
          onIntervalo={(i) => definir({ dde: i?.inicio ?? "", date: i?.fim ?? "" })}
          legendaInterativa
        />
        {peso && <p className="text-sm text-carvao-muted">{peso}</p>}
      </div>

      <div data-nivel="analisar" className="space-y-4 border-t border-linha pt-5">
        <h3 className="font-serif text-lg text-carvao">{anoMensal ? `Desde ${anoMensal}: e` : "E"}nergia armazenada e capacidade no fim de cada mês</h3>
        <GraficoLinhas
          titulo={`EAR do SIN e EAR máxima do SIN no último dia de cada mês${anoMensal ? `, desde ${anoMensal}` : ""}`}
          dados={mensal}
          chaveX="m"
          formatoX="mes"
          series={[
            { id: "SIN", rotulo: "EAR do SIN", cor: "var(--cor-energia)", espessura: 2.5 },
            { id: "SIN_max", rotulo: "EAR máxima do SIN (capacidade)", cor: "var(--serie-referencia)", tracejada: true },
            ...SUBSISTEMAS.map((sm) => ({ id: sm, rotulo: NOME_REGIAO[sm], sigla: CURTO_REGIAO[sm], cor: COR_REGIAO[sm] })),
          ]}
          ocultasIniciais={[...SUBSISTEMAS]}
          legendaInterativa
          unidade="MWmês"
          casas={0}
          zoom
          intervalo={intervalo}
          onIntervalo={(i) => definir({ de: i?.inicio ?? "", ate: i?.fim ?? "" })}
          zeroNoEixo
        />
        <p className="text-sm text-carvao-muted">{textoMensal} A EAR máxima cresceu com a entrada de usinas: o mesmo percentual em anos diferentes não mede a mesma energia.</p>
      </div>
    </div>
  );
}
