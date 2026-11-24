import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { BalancaCarbono } from "@/components/territorio/BalancaCarbono";
import type { GoldEmissoes, Setor } from "@/lib/territorio/emissoes";
import { EXPLICA_SETOR, NOME_SETOR, SETORES, balancaPorAno, mt } from "@/lib/territorio/emissoes";
import { n } from "@/components/territorio/Queimadas";

/**
 * Cor de cada setor (token de comparação do kit): identidade estável, sem juízo; a mesma no gráfico da série, nos cartões dos setores
 * e na balança. Rótulos e tabela repetem a informação.
 */
export const COR_SETOR: Record<Setor, string> = {
  energia: "var(--serie-comp-1)",
  ippu: "var(--serie-comp-4)",
  agropecuaria: "var(--serie-comp-2)",
  lulucf: "var(--serie-comp-5)",
  residuos: "var(--serie-referencia)",
};

/** Variação percentual com sinal tipográfico. */
export function sinalPct(v: number): string {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${n(Math.abs(v), 1)}%`;
}

/** Os cinco setores do inventário: o que cada um mede, quanto pesa no último ano e quanto mudou desde 2005 (dado publicado, não modelo). */
export function CincoSetores({ g }: Readonly<{ g: GoldEmissoes }>) {
  const ultimo = g.anos[g.anos.length - 1];
  const ref = g.anos.find((a) => a.ano === g.derivados.anoReferenciaNdc)!;
  return (
    <div aria-labelledby="setores-titulo" role="group" data-cinco-setores="">
      <h3 id="setores-titulo" className="t-h3 max-w-3xl text-carvao">
        O que cada setor mede
      </h3>
      <p className="t-meta mt-2 max-w-prose2 text-carvao-muted">
        O inventário divide as emissões em cinco setores, pelas regras internacionais do IPCC. Uso da terra e florestas é um saldo: soma o que se
        emite ao desmatar e converter vegetação e desconta o que a vegetação retira da atmosfera. A barra mostra o peso de cada setor no total
        líquido de {ultimo.ano}.
      </p>
      <div aria-hidden="true" className="mt-5 flex h-4 w-full overflow-hidden">
        {SETORES.map((s) => (
          <span key={s} style={{ width: `${g.derivados.participacaoUltimoAnoPct[s]}%`, background: COR_SETOR[s] }} />
        ))}
      </div>
      <ul className="mt-5 grid gap-px border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-5">
        {SETORES.map((s) => (
          <li key={s} className="flex flex-col bg-papel p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-carvao">
              <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0" style={{ background: COR_SETOR[s] }} />
              {NOME_SETOR[s]}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-carvao-muted">{EXPLICA_SETOR[s]}</p>
            <div className="mt-auto pt-4">
              <span className="font-label text-[1.4rem] tabular-nums text-carvao">{n(mt(ultimo.setores[s]), 0)}</span>{" "}
              <span className="text-xs text-carvao-muted">Mt CO2e em {ultimo.ano}</span>
              <span className="mt-1 block text-xs text-mineral">{n(g.derivados.participacaoUltimoAnoPct[s], 1)}% do total líquido</span>
              <span className="mt-1 block text-xs text-mineral">
                {sinalPct(g.derivados.variacaoDesde2005Pct[s])} sobre {ref.ano} ({n(mt(ref.setores[s]), 0)} Mt)
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Modelo didático "A balança do carbono": o total líquido como saldo entre as categorias do inventário com saldo acima de zero e as
 * com saldo abaixo de zero, com os números reais de cada ano. O lado negativo não é a remoção bruta (a fonte publica o uso da terra só
 * como saldo por categoria), e o modelo diz isso.
 */
export function ModeloBalanca({ g }: Readonly<{ g: GoldEmissoes }>) {
  return (
    <ModeloDidatico
      id="balanca-carbono"
      titulo="A balança do carbono"
      descricao={
        <>
          O total do país é um saldo. Em cada categoria do inventário, o que se emitiu e o que se retirou da atmosfera já vêm somados: a maior
          parte fica acima de zero, e algumas, como as florestas, ficam abaixo. Escolha um ano e veja os dois lados e a diferença, que é o total
          publicado. Números do inventário oficial, na mesma escala em todos os anos.
        </>
      }
      deixaDeFora={[
        "A emissão bruta e a remoção bruta: a fonte publica o uso da terra só como saldo por categoria, então uma floresta que emite ao queimar e retira ao crescer aparece só pela diferença.",
        "Remoções dentro de categorias com saldo positivo: a vegetação que cresce em pastos e lavouras abate o saldo dessas categorias sem aparecer no lado negativo.",
        "As categorias abaixo do primeiro nível do IPCC e a separação por gás; a figura dos gases mostra o que cada um pesa.",
        "Combustível de navegação e aviação internacional, que a regra da ONU deixa fora do total nacional.",
      ]}
    >
      <BalancaCarbono
        anos={balancaPorAno(g)}
        anoReferencia={g.derivados.anoReferenciaNdc}
        setores={SETORES.map((s) => ({ id: s, nome: NOME_SETOR[s], cor: COR_SETOR[s] }))}
      />
    </ModeloDidatico>
  );
}
