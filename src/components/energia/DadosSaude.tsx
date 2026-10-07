"use client";

import { GeracaoEscolha } from "@/components/energia/GeracaoControles";
import { MapaCalor } from "@/components/energia/MapaCalor";
import { TabelaInterativa } from "@/components/energia/TabelaInterativa";
import { useEstadoUrl } from "@/components/energia/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/energia/estadoUrl";
import { dataBR } from "@/lib/energia/formato";
import { COLUNAS_SAUDE, ESCALA_CALENDARIO, MEDIDAS_CALENDARIO, matrizCalendario, type MedidaCalendario } from "@/lib/energia/dados";
import type { LinhaTabela } from "@/lib/energia/tabela";
import type { DiaCalendario } from "@/lib/energia/tipos-dados";

/**
 * P068, saúde e revisões: o calendário de atualização e mudanças (uma medida por vez, na URL em
 * ?med=) e a tabela dos conjuntos integrados com SLA, completude, coleta e revisão. Tudo vem
 * pronto de publicacao.json: aqui só se escolhe a medida e se desenha. Antes do primeiro dia
 * de captura registrado, as medidas de captura são "sem dado": o ambiente ainda não registrava
 * capturas, e zero afirmaria que nada foi capturado.
 */

const MEDIDAS = MEDIDAS_CALENDARIO.map((m) => m.id) as readonly MedidaCalendario[];
const ESQUEMA = { med: campo(tiposUrl.opcao(MEDIDAS), "fonte" as MedidaCalendario) };
const CORES = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

export function DadosCalendario({ calendario, hoje, janela }: { calendario: DiaCalendario[]; hoje: string; janela: number }) {
  const [v, definir] = useEstadoUrl(ESQUEMA);
  const m = MEDIDAS_CALENDARIO.find((x) => x.id === v.med) ?? MEDIDAS_CALENDARIO[0];
  const c = matrizCalendario(calendario, hoje, janela, m.id);
  const e = ESCALA_CALENDARIO[m.id];
  return (
    <div className="space-y-3" data-medida={m.id}>
      <GeracaoEscolha legenda="Medida do calendário" opcoes={MEDIDAS_CALENDARIO.map((x) => ({ id: x.id, rotulo: x.rotulo, detalhe: x.detalhe }))} valor={m.id} onEscolher={(x) => definir({ med: x })} />
      <p className="text-sm leading-relaxed text-carvao-muted">
        {m.rotulo}: {m.detalhe}, por dia (UTC), de {dataBR(c.janela.inicio)} a {dataBR(c.janela.fim)}.
        {m.deCaptura && c.inicioRegistro
          ? ` O registro de capturas deste ambiente começa em ${dataBR(c.inicioRegistro)}; os dias anteriores aparecem como sem dado, não como zero.`
          : ""}
      </p>
      <MapaCalor
        titulo={`${m.rotulo} por dia, janela de ${janela} dias até ${dataBR(hoje)}`}
        linhas={c.semanas}
        colunas={c.dias}
        nomeLinhas="Semana (início na segunda-feira)"
        nomeColunas="Dia da semana"
        valores={c.valores}
        escala={{ tipo: "sequencial", limites: e.limites, cores: CORES, rotulos: e.rotulos }}
        unidade={m.unidade}
        casas={0}
        periodo={`${dataBR(c.janela.inicio)} a ${dataBR(c.janela.fim)}`}
        nota="Dia (UTC) com a contagem de eventos que o pipeline registrou. Falha de coleta nunca troca a data do dado: a captura anterior continua guardada."
      />
    </div>
  );
}

export function DadosSaudeTabela({ linhas, versao }: { linhas: LinhaTabela[]; versao: string }) {
  return (
    <TabelaInterativa
      titulo="Conjuntos integrados: atualidade, completude, coleta e revisões"
      colunas={COLUNAS_SAUDE}
      linhas={linhas}
      chaveLinha="id"
      colunaRotulo="titulo"
      fonte="Scrutiniums, publicacao.json (silvers do pipeline: capturas, coletas, grão, completude e revisões de cada conjunto integrado)"
      versao={versao}
      nomeArquivo="dados-saude-conjuntos"
      chaveUrl="sau"
      ordemInicial={{ coluna: "atraso", direcao: "desc" }}
      tamanhoPagina={25}
      dicaBusca="Nome do conjunto"
      nota="Situação e atraso valem para a data de referência da publicação, e o prazo é o fim do último período disponível mais a tolerância da cadência (caso A a E no modo Auditar). A última captura é a da última vintage com conteúdo: falha de coleta não a renova. Completude é a fração de períodos presentes entre o primeiro e o último de cada série; séries no último período é a fração das séries do conjunto com valor nesse período."
    />
  );
}
