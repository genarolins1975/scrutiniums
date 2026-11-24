"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { Recolhido } from "@/components/observatorios/Recolhido";
import { inteiro, percentual, reaisExtenso } from "@/lib/eficiencia/formato";
import type { DadosSaude } from "@/lib/eficiencia/saude/payload";
import { CAMINHO_TEMA, hrefSaude } from "@/lib/eficiencia/saude/rotas";
import { Selecao } from "../controles";
import type { DadosModeloSaude, Elo, ModeloCapital, Observado } from "./entradaSaude";
import { useBaseSaude } from "./ExploradorSaude";
import { useCapital } from "./PanoramaSaude";

/** Cor de cada fatia, pela posição no elo: os dois elos usam a mesma ordem (o que pesa mais primeiro, o restante por último). */
const COR_FATIA = ["var(--escala-seq-5)", "var(--escala-seq-3)", "var(--cor-bronze-soft)", "var(--cor-linha)"];

function BarraElo({ elo, rotulo }: { elo: Extract<Elo, { ok: true }>; rotulo: string }) {
  return (
    <div>
      {/* a barra é a forma; os valores estão na lista ao lado, que é o que o leitor de tela lê */}
      <div aria-hidden="true" className="flex h-4 w-full gap-[2px] overflow-hidden bg-papel">
        {elo.fatias.map((f, i) => (
          <span key={f.chave} className="h-full motion-safe:transition-[flex-grow] motion-safe:duration-300" style={{ flexGrow: f.participacao, flexBasis: 0, background: COR_FATIA[i] }} />
        ))}
      </div>
      <ul aria-label={rotulo} className="mt-4 space-y-2.5">
        {elo.fatias.map((f, i) => (
          <li key={f.chave} className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto] items-baseline gap-x-3">
            <span aria-hidden="true" className="h-3 w-3 translate-y-[1px]" style={{ background: COR_FATIA[i] }} />
            <span className="t-tabela text-carvao">{f.rotulo}</span>
            <span className="t-tabela text-right font-medium tabular-nums text-carvao">{percentual(f.participacao, 1)}</span>
          </li>
        ))}
      </ul>
      <p className="t-meta mt-3 text-carvao-muted">
        Total: <span className="tabular-nums">{reaisExtenso(elo.total)}</span>. {elo.escopo}, {elo.ano}.
      </p>
      {elo.ressalva && <p className="t-meta mt-2 text-carvao">{elo.ressalva}</p>}
    </div>
  );
}

function SemElo({ motivo }: { motivo: string }) {
  return (
    <p className="t-meta border border-dashed border-mineral px-4 py-3 text-carvao" role="note">
      {motivo}
    </p>
  );
}

function Etapa({ rotulo, titulo, fonte, children }: { rotulo: string; titulo: string; fonte: string; children: ReactNode }) {
  return (
    <li className="min-w-0">
      <p className="rotulo text-mineral">{rotulo}</p>
      <h3 className="t-h3 mt-2 text-carvao">{titulo}</h3>
      <p className="t-meta mt-1 text-carvao-muted">{fonte}</p>
      <div className="mt-5">{children}</div>
    </li>
  );
}

/** Seta entre elos: horizontal no desktop, vertical no celular, com o que a liga ao próximo elo escrito ao lado. */
function Elo({ texto, tracejada = false }: { texto: string; tracejada?: boolean }) {
  return (
    <li aria-hidden="true" className="flex items-center gap-3 py-2 lg:flex-col lg:justify-center lg:px-1 lg:py-0">
      <span className={`block h-8 w-0 border-l-2 lg:h-0 lg:w-10 lg:border-l-0 lg:border-t-2 ${tracejada ? "border-dashed border-mineral" : "border-carvao"}`} />
      <span className="t-meta max-w-[9rem] text-carvao-muted lg:text-center">{texto}</span>
    </li>
  );
}

function Medida({ rotulo, o, formata, unidade, mediana, brasil, periodo }: { rotulo: string; o: Observado; formata: (v: number) => string; unidade: string; mediana: number | null; brasil: number | null; periodo: string }) {
  return (
    <div className="border-t border-linha pt-3 first:border-t-0 first:pt-0">
      <p className="t-tabela text-carvao">{rotulo}</p>
      {o.valor === null ? (
        <p className="t-meta mt-1 text-carvao">{o.nota}</p>
      ) : (
        <>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="numero-m text-carvao">{formata(o.valor)}</span>
            <span className="t-meta text-carvao-muted">{unidade}, {periodo}</span>
          </p>
          {o.nota && <p className="t-meta mt-1 text-carvao">{o.nota}</p>}
        </>
      )}
      <p className="t-meta mt-1 text-carvao-muted">
        {[mediana !== null ? `Mediana das capitais: ${formata(mediana)}` : null, brasil !== null ? `Brasil: ${formata(brasil)}` : null].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

/**
 * Modelo didático da entrada: o caminho do dinheiro da saúde da prefeitura em três elos, com os dados da capital escolhida (ou do
 * conjunto): de que fontes vem a despesa (SIOPS, empenhada), em que subfunções ela é classificada (DCA, liquidada) e o que se
 * registra e se observa entre os moradores (cobertura potencial da atenção primária e internações evitáveis). A seta para o último
 * elo é tracejada: associação, não causa. O leitor troca a capital aqui ou no alto da página; as duas escolhas são a mesma (?cap=).
 */
export function ModeloSaude({ modelo, dados: dadosProp }: { modelo: DadosModeloSaude; dados?: DadosSaude }) {
  const dados = useBaseSaude(dadosProp);
  const { cap, valor, definir } = useCapital(dados);
  const m: ModeloCapital = (cap && modelo.capitais.find((c) => c.id === cap.id)) || modelo.conjunto;
  const nome = cap ? `${cap.nome} (${cap.uf})` : "o conjunto das capitais";
  const r = modelo.regua;
  return (
    <Recolhido id="modelo-saude" titulo="O caminho do dinheiro da saúde" resumo="Modelo didático com dados reais: de onde vem, para onde vai e o que se observa." aberto nivelTitulo={2}>
      <ModeloDidatico
        id="modelo-saude-elos"
        titulo={cap ? `De onde vem e para onde vai o dinheiro em ${cap.nome}` : "De onde vem e para onde vai o dinheiro da saúde"}
        descricao={
          <>
            Três elos, com os números de {nome}. As fatias de cada barra somam 100% do total daquele elo. O primeiro e o segundo elos vêm de fontes e de estágios
            contábeis diferentes (despesa empenhada no SIOPS, despesa liquidada na DCA): mostram a mesma despesa por dois lados e não se somam.
          </>
        }
        deixaDeFora={[
          "O gasto da União e do estado executado diretamente na capital: hospitais federais e estaduais, por exemplo, não passam pelo orçamento da prefeitura.",
          "A diferença entre empenhado e liquidado: os totais dos dois primeiros elos não precisam coincidir.",
          "O atendimento pago por planos privados, que não entra nas internações do SUS.",
          "A causa: a seta para o terceiro elo indica que as medidas são lidas juntas, não que o gasto produza o resultado.",
        ]}
      >
        <div className="max-w-sm">
          <Selecao
            id="capital-modelo"
            rotulo="Capital do modelo"
            ajuda="A mesma escolha do alto da página."
            valor={valor}
            opcoes={[{ v: "", t: "Conjunto das capitais" }, ...dados.capitais.map((x) => ({ v: x.id, t: `${x.nome} (${x.uf})` }))]}
            aoMudar={(v) => definir({ cap: v })}
          />
        </div>
        <ol className="mt-8 grid gap-y-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-4" aria-label={`Os três elos, ${nome}`}>
          <Etapa rotulo="De onde vem" titulo="Fontes da despesa" fonte="SIOPS, despesa total em saúde empenhada, por fonte de recursos">
            {m.fonte.ok ? <BarraElo elo={m.fonte} rotulo={`Fontes da despesa, ${nome}`} /> : <SemElo motivo={m.fonte.motivo} />}
          </Etapa>
          <Elo texto="a prefeitura executa a despesa" />
          <Etapa rotulo="Para onde vai" titulo="Subfunções da despesa" fonte="Siconfi (DCA), despesa liquidada na função Saúde, por subfunção">
            {m.destino.ok ? <BarraElo elo={m.destino} rotulo={`Subfunções da despesa, ${nome}`} /> : <SemElo motivo={m.destino.motivo} />}
          </Etapa>
          <Elo texto="associação, não causa" tracejada />
          <Etapa rotulo="O que se registra e se observa" titulo="Atenção primária e internações" fonte="Relatório APS; RIPSA (SIH/SUS e ANS)">
            <div className="space-y-4">
              <Medida rotulo="Cobertura potencial da atenção primária" o={m.cobertura} formata={(v) => percentual(v, 1)} unidade="da população de referência" periodo={`dezembro de ${m.cobertura.ano}`} mediana={cap ? r.coberturaMediana : null} brasil={r.coberturaBrasil} />
              <Medida rotulo="Internações que a atenção primária poderia evitar" o={m.icsap} formata={(v) => inteiro(Math.round(v))} unidade="por 100 mil habitantes" periodo={String(m.icsap.ano)} mediana={cap ? r.icsapMediana : null} brasil={r.icsapBrasil} />
              <Medida rotulo="Moradores com plano de saúde privado" o={m.planos} formata={(v) => percentual(v, 1)} unidade="da população" periodo={`dezembro de ${m.planos.ano}`} mediana={cap ? r.planosMediana : null} brasil={null} />
            </div>
          </Etapa>
        </ol>
        <p className="t-meta mt-8 max-w-prose2 text-carvao-muted">
          A subfunção Atenção básica é uma classificação do orçamento, não a despesa inteira da rede de postos: a prática de classificação varia entre prefeituras. A cobertura potencial é a capacidade teórica das equipes registradas e pode passar de 100%.{" "}
          <Link href={hrefSaude(CAMINHO_TEMA.gastos, { med: "despesa", ...(cap ? { cap: cap.id } : {}) })} className="inline-flex min-h-[44px] items-center text-obee-dark underline underline-offset-4">
            Ver as fontes e as subfunções completas em Gastos
          </Link>
        </p>
      </ModeloDidatico>
    </Recolhido>
  );
}
