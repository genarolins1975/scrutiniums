import Link from "next/link";
import { CabecalhoPlataforma } from "@/components/layout/CabecalhoPlataforma";
import { NavegacaoColecao } from "@/components/layout/NavegacaoColecao";
import type { NumeroProps, Natureza } from "@/lib/painel/tipos";
import { dataBr, variacao } from "@/lib/varejo/formato";
import { ROTA_METODO, ROTA_VAREJO } from "@/lib/varejo/paginas";
import type { FonteGold, GoldSetor } from "@/lib/varejo/tipos";

export const FONTE_PMC = "IBGE, Pesquisa Mensal de Comércio";
export const FONTE_PAC = "IBGE, Pesquisa Anual de Comércio";

export const LINK = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

/** Barra comum e navegação da coleção, iguais em toda página do Varejo. */
export function CabecalhoVarejo({ rota }: Readonly<{ rota: string }>) {
  return (
    <header>
      <CabecalhoPlataforma observatorio="economia" destinoConta={rota || ROTA_VAREJO} fontes={["varejo"]} />
      <NavegacaoColecao colecao="varejo" />
    </header>
  );
}

/** Número de variação para a faixa do painel: valor com sinal ou, ausente, o motivo. Nunca zero no lugar de ausência. */
export function numeroDeVariacao(
  base: { rotulo: string; unidade: string; periodo: string; recorte?: string; fonte: string; natureza?: Natureza; tamanho?: "g" | "m" | "p" },
  valor: number | null,
): NumeroProps {
  const comum = { ...base, natureza: base.natureza ?? ("OBSERVADO" as Natureza) };
  return valor === null
    ? { ...comum, valor: null, motivoAusencia: "O IBGE não publicou este valor para o mês e o recorte escolhidos." }
    : { ...comum, formato: "texto", valorTexto: variacao(valor) };
}

/** Uma fonte da gold por extenso: órgão, pesquisa, tabela com link e data da consulta. */
export function LinhaFonte({ f, periodo }: Readonly<{ f: FonteGold; periodo: string }>) {
  return (
    <p>
      {f.orgao}, {f.nome}.{" "}
      <a href={f.url} rel="noopener noreferrer" target="_blank" className={LINK}>
        {f.tabela}
      </a>
      . Período usado: {periodo}. Consultado em {dataBr(f.capturado_em)}.
    </p>
  );
}

/** O fecho do método de cada painel: o que vale para todos e o caminho da página de método. */
export function FechoDoMetodo({ g }: Readonly<{ g: GoldSetor }>) {
  return (
    <p>
      {g.notas.pmc_pesos} Os valores são os publicados na data da consulta e podem ser revisados pela fonte.{" "}
      <Link href={ROTA_METODO} prefetch={false} className={LINK}>
        Fontes, fórmulas, correspondência com o IBGE e lacunas
      </Link>
      .
    </p>
  );
}
