"use client";
/**
 * Inflação dos alimentos no IPCA (IBGE, tabela 7060): variação acumulada em 12 meses publicada,
 * com a alimentação no domicílio em destaque e o índice geral como referência. A tabela
 * equivalente traz as quatro categorias. Nenhuma taxa é recalculada.
 *
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026): a medida (acumulada em 12 meses ou no mês) na URL (?ipca=) logo antes
 * da figura do kit, com as duas linhas e o zero no eixo, a frase do último mês na leitura e os últimos 12 meses das quatro categorias na
 * tabela equivalente.
 */
import { useId, useMemo, type ReactNode } from "react";
import { Controles, FiguraAnalitica, GraficoLinhas, LeituraGuiada } from "@/components/painel";
import { useEstadoUrl } from "@/components/painel/useEstadoUrl";
import { campo, tiposUrl } from "@/lib/painel/estadoUrl";
import type { Proveniencia } from "@/lib/painel/tipos";
import type { CategoriaIpca, PontoIpca } from "@/lib/eficiencia/alimentar/complementos";

const NOMES: Record<CategoriaIpca, string> = {
  geral: "Índice geral",
  alimentacao_bebidas: "Alimentação e bebidas",
  alimentacao_domicilio: "Alimentação no domicílio",
  alimentacao_fora: "Alimentação fora do domicílio",
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mes = (p: string) => `${MESES[Number(p.slice(4, 6)) - 1]}/${p.slice(0, 4)}`;
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function IpcaAlimentos({ pontos, proveniencia, complemento, contexto, rota }: { pontos: PontoIpca[]; proveniencia: Proveniencia; complemento: ReactNode; contexto?: ReactNode; rota: string }) {
  const id = useId();
  const esquema = useMemo(() => ({ ipca: campo(tiposUrl.opcao(["doze_meses", "mensal"] as const), "doze_meses" as "doze_meses" | "mensal") }), []);
  const [s, definir] = useEstadoUrl(esquema);
  const medida = s.ipca;
  const serie = (cat: CategoriaIpca) => pontos.filter((p) => p.medida === medida && p.categoria === cat).sort((a, b) => a.periodo.localeCompare(b.periodo));
  const foco = serie("alimentacao_domicilio");
  const geral = serie("geral");
  const periodos = foco.map((p) => p.periodo);
  const ultimo = foco[foco.length - 1];
  const ultimoGeral = geral[geral.length - 1];
  const nomeMedida = medida === "doze_meses" ? "variação acumulada em 12 meses" : "variação no mês";
  const tabela = [...periodos].reverse().slice(0, 12);
  const valorEm = (cat: CategoriaIpca, p: string) => pontos.find((x) => x.medida === medida && x.categoria === cat && x.periodo === p)?.valor;
  return (
    <>
      <Controles rotulo="Medida da inflação dos alimentos" resumo={`Mostrando a ${nomeMedida}, Brasil, ${mes(periodos[0])} a ${mes(periodos[periodos.length - 1])}.`} limpar={medida === "doze_meses" ? undefined : { href: `${rota}#precos` }} idioma="pt">
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-carvao">
          <legend className="mb-1 text-sm">Medida</legend>
          {(["doze_meses", "mensal"] as const).map((k) => (
            <label key={k} htmlFor={`${id}-${k}`} className="inline-flex min-h-[44px] items-center gap-2">
              <input id={`${id}-${k}`} type="radio" name={`${id}-medida`} checked={medida === k} onChange={() => definir({ ipca: k })} />
              {k === "doze_meses" ? "Acumulada em 12 meses" : "No mês"}
            </label>
          ))}
        </fieldset>
      </Controles>
      <FiguraAnalitica
        id="precos"
        idioma="pt"
        pergunta="A comida ficou mais cara?"
        subtitulo={`IPCA · ${nomeMedida} · % · Brasil · ${mes(periodos[0])} a ${mes(periodos[periodos.length - 1])}`}
        natureza="OBSERVADO"
        proveniencia={proveniencia}
        leitura={
          <LeituraGuiada>
            Em {mes(ultimo.periodo)}, a {nomeMedida} da alimentação no domicílio foi de <strong className="tabular-nums">{ultimo.valor === null ? "valor não publicado" : `${fmt(ultimo.valor)}%`}</strong>; a do índice geral, de{" "}
            <strong className="tabular-nums">{ultimoGeral.valor === null ? "valor não publicado" : `${fmt(ultimoGeral.valor)}%`}</strong>.
          </LeituraGuiada>
        }
        comoInterpretar="O zero entra no eixo. Variação negativa é queda de preços no período, não ausência de dado."
        naoConcluir="Quanto custa uma cesta em reais nem se a renda das famílias acompanha os preços: o IPCA mede quanto os preços mudaram, e o poder de compra não está integrado."
        tabela={{
          titulo: `IPCA, ${nomeMedida}, Brasil, últimos 12 meses publicados, em %`,
          colunas: ["Mês", ...(Object.keys(NOMES) as CategoriaIpca[]).map((k) => NOMES[k])],
          linhas: tabela.map((p) => [mes(p), ...(Object.keys(NOMES) as CategoriaIpca[]).map((k) => {
            const v = valorEm(k, p);
            return v === null || v === undefined ? "Não publicado" : `${fmt(v)}%`;
          })]),
        }}
        complemento={complemento}
      >
        {contexto && <div className="t-corpo mb-6 max-w-prose2 space-y-2 text-carvao">{contexto}</div>}
        <GraficoLinhas
          titulo={`IPCA, ${nomeMedida}, alimentação no domicílio e índice geral, Brasil, ${mes(periodos[0])} a ${mes(periodos[periodos.length - 1])}`}
          series={[
            { id: "alimentacao_domicilio", nome: NOMES.alimentacao_domicilio, cor: "var(--cor-obee)", pontos: foco.map((p) => ({ x: mes(p.periodo), y: p.valor })) },
            { id: "geral", nome: NOMES.geral, pontos: geral.map((p) => ({ x: mes(p.periodo), y: p.valor })) },
          ]}
          eixoY={{ unidade: "%", zero: true, casas: 2 }}
          formatoX="texto"
          altura={260}
        />
      </FiguraAnalitica>
    </>
  );
}
