"use client";

import Link from "next/link";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { useState } from "react";
import { NumeroEscala } from "@/components/observatorios/NumeroEscala";
import type { EtapaImposto, FluxoImposto } from "@/lib/observatorios/entradas/contas";

const TONS_PARTES = ["bg-carvao-soft", "bg-carvao-muted", "bg-mineral", "bg-mineral-soft"];

function fmt(v: number, casas: number): string {
  return Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function valor(e: { bilhoes: number; porCem: number }, modo: "cem" | "bi", sai = false): string {
  const sinal = sai || e.bilhoes < 0 ? "−" : "";
  return modo === "cem" ? `${sinal}R$ ${fmt(e.porCem, 2)}` : `${sinal}R$ ${fmt(e.bilhoes, 1)} bi`;
}

/** Posição da barra de cada etapa na régua de 0 a 100 (a arrecadação), em cascata. */
function barra(e: EtapaImposto, etapas: EtapaImposto[]): { esquerda: number; largura: number } {
  const liquida = etapas.find((x) => x.id === "liquida")?.porCem ?? 0;
  const despesa = etapas.find((x) => x.id === "despesa")?.porCem ?? 0;
  if (e.id === "transferencias") return { esquerda: liquida, largura: e.porCem };
  if (e.id === "resultado") return { esquerda: Math.min(liquida, despesa), largura: Math.abs(e.porCem) };
  return { esquerda: 0, largura: e.porCem };
}

/**
 * Modelo didático "do imposto ao resultado": o caminho do dinheiro arrecadado
 * pelo governo central no último ano completo do RTN, a cada R$ 100 ou em
 * bilhões de reais. Segue as identidades do demonstrativo; não mostra juros
 * dentro do resultado porque eles vêm de outra base.
 */
export function ImpostoResultado({ fluxo }: Readonly<{ fluxo: FluxoImposto | null }>) {
  const [modo, setModo] = useState<"cem" | "bi">("cem");
  if (!fluxo) {
    return (
      <ModeloDidatico id="imposto" titulo={<>Do imposto ao resultado</>} deixaDeFora={["Os juros da dívida, que vêm de outra base", "Valores corrigidos pela inflação: os números são nominais, pelo regime de caixa", "Avaliação do gasto: o modelo mostra o desenho do demonstrativo, não se o gasto foi alto ou baixo"]}>
        <p className="max-w-prose2 text-sm leading-relaxed text-carvao">
          Indisponível nesta publicação: as contas do demonstrativo não fecharam na leitura e o modelo não é exibido com números parciais.
        </p>
      </ModeloDidatico>
    );
  }
  const despesa = fluxo.etapas.find((e) => e.id === "despesa");
  return (
    <ModeloDidatico id="imposto" titulo={<>Do imposto ao resultado</>} descricao={<>O caminho do dinheiro arrecadado pelo governo central em {fluxo.ano}: parte vai para estados e municípios, o restante paga a despesa primária, e a diferença é o resultado primário. Valores nominais, pelo regime de caixa do demonstrativo. Os juros da dívida ficam fora dessa conta.</>} deixaDeFora={["Os juros da dívida, que vêm de outra base", "Valores corrigidos pela inflação: os números são nominais, pelo regime de caixa", "Avaliação do gasto: o modelo mostra o desenho do demonstrativo, não se o gasto foi alto ou baixo"]}>

        <div role="group" aria-label="Unidade do modelo" className="mt-8 inline-flex border border-linha bg-superficie">
          {([["cem", "A cada R$ 100 arrecadados"], ["bi", "Em bilhões de reais"]] as const).map(([m, r]) => (
            <button
              key={m}
              type="button"
              aria-pressed={modo === m}
              onClick={() => setModo(m)}
              className={`min-h-[44px] px-4 text-sm ${modo === m ? "bg-carvao text-marfim" : "text-carvao hover:bg-papel"}`}
            >
              {r}
            </button>
          ))}
        </div>

        <ol className="mt-8 border-t border-linha">
          {fluxo.etapas.map((e, i) => {
            const b = barra(e, fluxo.etapas);
            const entrada = !e.sai && e.id !== "resultado";
            return (
              <li key={e.id} className="grid gap-x-8 gap-y-3 border-b border-linha py-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)_minmax(0,2fr)] lg:items-center">
                <div>
                  <p className="rotulo flex items-baseline gap-2 text-mineral">
                    <span className="tabular-nums text-carvao">{String(i + 1).padStart(2, "0")}</span>
                    {e.sai ? "Sai" : e.id === "resultado" ? "Saldo" : "Entra"}
                  </p>
                  <h3 className="mt-1 font-serif text-lg leading-snug text-carvao">{e.titulo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-carvao-muted">{e.texto}</p>
                </div>
                <div aria-hidden="true" className="relative h-6 bg-papel">
                  {e.partes ? (
                    <div className="absolute inset-y-0 left-0 flex" style={{ width: `${b.largura}%` }}>
                      {e.partes.map((p, k) => (
                        <span key={p.titulo} className={`h-full border-r border-marfim ${TONS_PARTES[k % TONS_PARTES.length]}`} style={{ width: `${(100 * p.porCem) / e.porCem}%` }} />
                      ))}
                    </div>
                  ) : (
                    <span
                      className={`absolute inset-y-0 ${entrada ? "bg-energia" : e.id === "resultado" ? "bg-bronze" : "bg-energia-soft"}`}
                      style={{ left: `${b.esquerda}%`, width: `${b.largura}%` }}
                    />
                  )}
                </div>
                <p className="font-label text-xl tabular-nums text-carvao lg:text-right">{valor(e, modo, e.sai)}</p>
                {e.partes && (
                  <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-4">
                    {e.partes.map((p, k) => (
                      <li key={p.titulo} className="flex items-baseline gap-2 text-sm text-carvao-muted">
                        <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 ${TONS_PARTES[k % TONS_PARTES.length]}`} />
                        <span>
                          {p.titulo}: <span className="tabular-nums text-carvao">{valor(p, modo)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <div className="border-l-2 border-linha pl-4 lg:col-span-7">
            <p className="text-sm font-medium text-carvao">Fora do resultado primário: os juros da dívida</p>
            <p className="mt-1 text-sm leading-relaxed text-carvao-muted">
              Os juros vêm da execução do orçamento, outra base e outro critério. Por isso aparecem à parte e não se somam nem
              se subtraem dos valores acima.
            </p>
            <div className="mt-3">
              <span className="block text-xs leading-snug text-carvao-muted">{fluxo.juros.rotulo}</span>
              <span className="mt-1 block"><NumeroEscala n={fluxo.juros} /></span>
            </div>
          </div>
          <div className="text-xs leading-relaxed text-mineral lg:col-span-5">
            <p>
              Fonte: {fluxo.fonte}. Arrecadação menos transferências é a receita líquida; receita líquida menos despesa
              primária é o resultado primário, conferidos antes da publicação.
              {despesa && " Despesas sujeitas à programação financeira incluem as discricionárias, as que o governo pode adiar ou cortar no ano."}
            </p>
            <p className="mt-2">Mostra o desenho do demonstrativo, não avalia se o gasto foi alto ou baixo.</p>
            <Link href="/contas-publicas/panorama" prefetch={false} className="mt-2 inline-flex min-h-[44px] items-center text-sm text-carvao underline decoration-linha underline-offset-4">
              Série completa no Panorama das Contas Federais
            </Link>
          </div>
        </div>
      </ModeloDidatico>
  );
}

/** Método e fontes da entrada das Contas Públicas. */
export function MetodoContas() {
  return (
    <>
      <p>
        Governo central: Resultado do Tesouro Nacional, regime de caixa, valores nominais em reais correntes; o resultado
        em 12 meses soma os meses publicados mais recentes. Juros: execução do orçamento da União no SIOP, grupo de
        despesa 2, valor pago. Estados: Relatório de Gestão Fiscal (Anexo 2) declarado por cada estado no Siconfi e
        conferido na fonte primária.
      </p>
      <p>
        Os números são lidos dos mesmos arquivos dos painéis na publicação do site; quando um arquivo não pode ser lido, o
        número aparece como indisponível, nunca como zero. Números de bases diferentes não se somam.
      </p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        <li><Link href="/contas-publicas/metodologia" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Contas Federais: método</Link></li>
        <li><Link href="/contas-publicas/glossario" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Contas Federais: glossário</Link></li>
        <li><Link href="/perguntas/contas-publicas" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Resumo aberto do observatório</Link></li>
      </ul>
    </>
  );
}
