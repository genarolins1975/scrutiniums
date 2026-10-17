"use client";

import { GeracaoEscolha } from "@/components/energia/GeracaoControles";
import { MapaCalor } from "@/components/energia/MapaCalor";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { formatos } from "@/lib/energia/formato";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { COLUNAS_SAUDE, ESCALA_CALENDARIO, MEDIDAS_CALENDARIO, matrizCalendario, type MedidaCalendario } from "@/lib/energia/dados";
import type { LinhaTabela } from "@/lib/energia/tabela";
import type { DiaCalendario } from "@/lib/energia/tipos-dados";

/**
 * P068, saúde e revisões: o calendário de atualização e mudanças (uma medida por vez, na URL em
 * ?med=) e a tabela das integrações com SLA, completude, coleta e revisão. Tudo vem
 * pronto de publicacao.json: aqui só se escolhe a medida e se desenha. Antes do primeiro dia
 * de captura registrado, as medidas de captura são "sem dado": o ambiente ainda não registrava
 * capturas, e zero afirmaria que nada foi capturado.
 */

const MEDIDAS = MEDIDAS_CALENDARIO.map((m) => m.id) as readonly MedidaCalendario[];
// i18n: dado
const ESQUEMA = { med: campo(tiposUrl.opcao(MEDIDAS), "fonte" as MedidaCalendario) };
const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

export function DadosCalendario({ calendario, hoje, janela }: { calendario: DiaCalendario[]; hoje: string; janela: number }) {
  const tx = useTx();
  const { dataBR } = formatos(useIdioma());
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const m = MEDIDAS_CALENDARIO.find((x) => x.id === v.med) ?? MEDIDAS_CALENDARIO[0];
  const c = matrizCalendario(calendario, hoje, janela, m.id);
  const e = ESCALA_CALENDARIO[m.id];
  return (
    <div className="space-y-3" data-medida={m.id}>
      <GeracaoEscolha
        legenda={tx("Medida do calendário", "Calendar measure")}
        opcoes={MEDIDAS_CALENDARIO.map((x) => ({ id: x.id, rotulo: x.rotulo, detalhe: x.detalhe }))}
        valor={m.id}
        onEscolher={(x) => definir({ med: x })}
      />
      <p className="text-sm leading-relaxed text-carvao-muted">
        {tx(
          `${m.rotulo}: ${m.detalhe}, por dia no horário universal (UTC, três horas à frente de Brasília), de ${dataBR(c.janela.inicio)} a ${dataBR(c.janela.fim)}.`,
          `${m.rotulo}: ${m.detalhe}, per day in universal time (UTC, three hours ahead of Brasília), from ${dataBR(c.janela.inicio)} to ${dataBR(c.janela.fim)}.`,
        )}
        {m.deCaptura && c.inicioRegistro
          ? tx(
              ` O registro de capturas deste ambiente começa em ${dataBR(c.inicioRegistro)}; os dias anteriores aparecem como sem dado, não como zero.`,
              ` The capture record of this environment starts on ${dataBR(c.inicioRegistro)}; earlier days appear as no data, not as zero.`,
            )
          : ""}
      </p>
      <MapaCalor
        titulo={tx(`${m.rotulo} por dia, janela de ${janela} dias até ${dataBR(hoje)}`, `${m.rotulo} per day, ${janela}-day window up to ${dataBR(hoje)}`)}
        linhas={c.semanas}
        colunas={c.dias}
        nomeLinhas={tx("Semana (início na segunda-feira)", "Week (starting on Monday)")}
        nomeColunas={tx("Dia da semana", "Day of the week")}
        valores={c.valores}
        escala={{ tipo: "sequencial", limites: e.limites, cores: CORES, rotulos: e.rotulos }}
        unidade={m.unidade}
        casas={0}
        periodo={tx(`${dataBR(c.janela.inicio)} a ${dataBR(c.janela.fim)}`, `${dataBR(c.janela.inicio)} to ${dataBR(c.janela.fim)}`)}
        nota={tx(
          "Dia no horário universal (UTC) com a contagem de eventos de coleta registrados. Falha de coleta nunca troca a data do dado: a captura anterior continua guardada.",
          "Day in universal time (UTC) with the count of collection events recorded. A collection failure never changes the data date: the previous capture remains stored.",
        )}
      />
    </div>
  );
}

export function DadosSaudeTabela({ linhas, versao }: { linhas: LinhaTabela[]; versao: string }) {
  const tx = useTx();
  return (
    <TabelaInterativa
      titulo={tx("Integrações: atualidade, completude, coleta e revisões", "Integrations: timeliness, completeness, collection and revisions")}
      colunas={COLUNAS_SAUDE}
      linhas={linhas}
      chaveLinha="id"
      colunaRotulo="titulo"
      fonte={tx(
        "Scrutiniums, publicação de saúde dos dados (histórico de capturas do observatório: capturas, coletas, recorte, completude e revisões de cada integração)",
        "Scrutiniums, data health publication (observatory capture history: captures, collections, coverage, completeness and revisions of each integration)",
      )}
      versao={versao}
      nomeArquivo="dados-saude-conjuntos"
      chaveUrl="sau"
      ordemInicial={{ coluna: "atraso", direcao: "desc" }}
      tamanhoPagina={25}
      dicaBusca={tx("Nome do conjunto", "Dataset name")}
      nota={tx(
        "Situação e atraso valem para a data de referência da publicação, e o prazo é o fim do último período disponível mais a tolerância da cadência (regra de prazo, caso A a E, no modo Auditar). A última captura é a da última versão com conteúdo: falha de coleta não a renova. Completude é a fração de períodos presentes entre o primeiro e o último de cada série; séries no último período é a fração das séries do conjunto com valor nesse período.",
        "Status and delay apply to the reference date of the publication, and the deadline is the end of the latest period available plus the cadence tolerance (deadline rule, case A to E, in Audit mode). The latest capture is that of the latest version with content: a collection failure does not renew it. Completeness is the share of periods present between the first and the last of each series; series in the latest period is the share of the dataset's series with a value in that period.",
      )}
    />
  );
}
