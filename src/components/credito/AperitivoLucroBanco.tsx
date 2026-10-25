import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";

type Passo = { nome: string; valor: number };
type Sistema = { lucro: number; passos: Passo[]; n: number; universo: number; data_base: string; reconciliacao: { reconciliado: boolean } };

/** A mesma DRE do painel, com perímetro declarado; não transfere a base bancária ao cliente. */
export function AperitivoLucroBanco() {
  let s: Sistema;
  try {
    s = JSON.parse(readFileSync(join(process.cwd(), "public/obs/data/gold/lucro_banco.json"), "utf8")).sistema;
  } catch { return null; }
  if (!s.reconciliacao.reconciliado) return null;
  const receita = s.passos[0].valor;
  if (!(receita > 0)) return null;
  const fmt = (v: number) => (v / receita * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const custos = s.passos.slice(1).reduce((sum, p) => sum + p.valor, 0);
  const etapas = [
    { nome: "Rendas dos ativos", valor: receita, inicio: 0, fim: receita },
    { nome: "Demais resultados e despesas", valor: custos, inicio: receita, fim: s.lucro },
    { nome: "Lucro líquido", valor: s.lucro, inicio: 0, fim: s.lucro },
  ];
  const min = Math.min(0, s.lucro), max = Math.max(receita, s.lucro);
  return (
    <section className="mt-6 border-t border-linha pt-4" aria-labelledby="aperitivo-lucro">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 id="aperitivo-lucro" className="font-serif text-2xl leading-tight text-carvao">De onde vem o lucro dos bancos?</h2>
          <p data-numero-escala="" className="mt-3 text-sm leading-relaxed text-carvao-muted">De cada R$ 100 de rendas dos ativos financeiros, R$ {fmt(s.lucro)} chegaram ao lucro líquido dos conglomerados cobertos.</p>
          <Link href="/observatorio/bank-profit" prefetch={false} className="mt-3 inline-flex min-h-[44px] items-center text-sm text-bronze-dark underline underline-offset-4">Examinar um banco · com conta</Link>
        </div>
        <figure aria-label="Cascata agregada por R$ 100 de rendas">
          <div className="grid grid-cols-3 gap-4">
            {etapas.map((p, i) => (
              <div key={p.nome}>
                <p className="text-sm tabular-nums text-carvao">R$ {fmt(p.valor)}</p>
                <div className="relative mt-2 h-20 border-b border-linha" aria-hidden="true">
                  <span className={`absolute left-1/4 w-1/2 ${i === 2 ? "bg-bronze-dark" : "bg-mineral"}`} style={{ bottom: `${100 * (Math.min(p.inicio, p.fim) - min) / (max - min)}%`, height: `${100 * Math.abs(p.valor) / (max - min)}%` }} />
                </div>
                <p className="mt-2 text-xs leading-snug text-carvao">{p.nome}</p>
              </div>
            ))}
          </div>
          <figcaption className="mt-3 text-xs leading-relaxed text-mineral">BCB, IF.data, relatório 116 · 12 meses até {s.data_base.slice(4)}/{s.data_base.slice(0, 4)} · {s.n}/{s.universo} conglomerados com DRE conciliada. Não é o total do SFN. Rendas incluem câmbio e valor justo. Lids e composição no painel.</figcaption>
        </figure>
      </div>
      <ConviteAperitivo className="!pt-4 !pb-4" idTitulo="convite-lucro-titulo" rota="/observatorio/bank-profit" comConta={["DRE por banco, detalhe das rubricas e comparação com pares", "PDD estimada por modalidade, simulador de atraso, margens e tarifas"]} />
    </section>
  );
}
