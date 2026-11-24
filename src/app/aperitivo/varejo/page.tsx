import type { Metadata } from "next";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { escalaVarejo, MetodoDaEntrada } from "@/components/varejo/EntradaVarejo";
import { COR_RECEITA, COR_VOLUME } from "@/components/varejo/figuras/escala";
import { TesouraMini, topoNaTesouraMini } from "@/components/varejo/figuras/Miniaturas";
import { comConta } from "@/lib/varejo/convite";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { curadoria, fimDaTesoura, goldEmpresas, goldSetor, leituraBrasil, mesAnterior, tesoura } from "@/lib/varejo/dados";
import { mesCurto, mesExtenso, num, variacao } from "@/lib/varejo/formato";
import type { GoldSetor } from "@/lib/varejo/tipos";
import { PERGUNTA_APERITIVO, ROTA_VAREJO, SECAO_APERITIVO } from "@/lib/varejo/paginas";

/**
 * Versão aperitivo do Varejo (princípio do aperitivo, decisão do dono de 20/10/2026). Quem acessa /varejo sem sessão recebe
 * esta página por rewrite (src/middleware.ts); quem tem conta recebe ali a entrada completa. O aperitivo é o último resultado
 * da Pesquisa Mensal de Comércio (volume e receita, com fonte e período), o tamanho do mercado na pesquisa anual e uma figura
 * só: a "tesoura" dos últimos 24 meses em miniatura (receita contra volume em índice), com o valor do último mês escrito e sem
 * leitura mês a mês. Sem a série completa nem a tabela dela, sem atividades, sem estados, sem mapa (a malha das UFs não é
 * pública), sem companhias e sem arquivo para baixar: tudo isso fica com a conta, listado no convite do fim, dimensionado
 * pelas próprias golds.
 *
 * Estática: lê as golds no build e não busca nenhum arquivo no navegador.
 */
export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  const g = goldSetor();
  return {
    // título absoluto, com o nome da coleção lido do registro: escrito por extenso, o modelo do layout raiz ("%s · Scrutiniums")
    // repetia o nome da plataforma (em produção até 24/11/2026)
    title: tituloNaColecao(PERGUNTA_APERITIVO, ROTA_VAREJO),
    description: `O resultado das vendas do comércio varejista em ${mesExtenso(g.referencia.pmc)}, em volume e em receita, e o tamanho do mercado em reais na pesquisa anual de ${g.pac.ano}, pelas pesquisas do IBGE.`,
    alternates: { canonical: ROTA_VAREJO },
  };
}

export default function AperitivoVarejo() {
  const g = goldSetor();
  const e = goldEmpresas();
  const l = leituraBrasil(g, "restrito");
  const anterior = mesAnterior(g);
  return (
    <>
      <MarcaVisita secao={SECAO_APERITIVO} />
      <EntradaColecao
        tipo="aperitivo"
        rota={ROTA_VAREJO}
        acento="gas"
        titulo={PERGUNTA_APERITIVO}
        frase={
          <>
            Em {mesExtenso(l.mes)}, o volume vendido pelo varejo variou {variacao(l.volume.mm)} ante {anterior ? mesExtenso(anterior).split(" de ")[0] : "o mês anterior"}, com ajuste sazonal, e a receita em reais, {variacao(l.receita.mm)}.
            Abaixo, o acumulado em 12 meses e o tamanho do mercado.
          </>
        }
        escala={escalaVarejo(g)}
        notaEscala={null}
        consulta={<TesouraAberta g={g} />}
        convite={
          <div className="mx-auto max-w-page px-6">
            <ConviteAperitivo rota={ROTA_VAREJO} comConta={comConta(g, e, curadoria())} className="mt-2" />
          </div>
        }
        metodo={<MetodoDaEntrada g={g} e={e} aberta />}
      />
    </>
  );
}

/**
 * A única figura da versão aberta: receita nominal e volume do varejo restrito nos últimos 24 meses, em índice com ajuste sazonal,
 * os dois levados a 100 no primeiro mês (o mesmo seletor `tesoura` do painel). A área entre as linhas é a distância que a receita
 * abriu sobre o volume, uma aproximação do efeito dos preços. Só o primeiro e o último mês têm valor escrito: a leitura mês a mês,
 * a série desde 2019 e a tabela ficam com a conta.
 */
function TesouraAberta({ g }: Readonly<{ g: GoldSetor }>) {
  const t = tesoura(g, g.pmc.brasil.restrito, "24m");
  const fim = fimDaTesoura(t);
  if (!fim || fim.volume === null || fim.receita === null) return null;
  const volume = t.map((p) => p.volume);
  const receita = t.map((p) => p.receita);
  const inicio = t[0].mes;
  const dV = fim.volume - 100;
  const dR = fim.receita - 100;
  let topoR = topoNaTesouraMini(volume, receita, fim.receita);
  let topoV = topoNaTesouraMini(volume, receita, fim.volume);
  if (Math.abs(topoR - topoV) < 22) {
    const meio = (topoR + topoV) / 2;
    const receitaEmCima = topoR <= topoV;
    topoR = meio + (receitaEmCima ? -11 : 11);
    topoV = meio + (receitaEmCima ? 11 : -11);
  }
  return (
    <section aria-labelledby="tesoura-aberta-titulo" className="mx-auto max-w-page px-6 pt-6" data-tesoura-aberta="">
      <h2 id="tesoura-aberta-titulo" className="font-serif text-[clamp(1.5rem,2.6vw,1.9rem)] leading-tight text-carvao">
        Em reais e em mercadoria, desde {mesExtenso(inicio)}
      </h2>
      <div className="mt-3 grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-end">
        <div>
          <p className="text-sm leading-relaxed text-carvao">
            De {mesCurto(inicio)} a {mesCurto(fim.mes)}, a receita em reais do varejo variou {variacao(dR)} e o volume vendido, {variacao(dV)}. A área entre as duas linhas é essa distância: aproxima o efeito dos preços.
          </p>
          <p className="t-meta mt-3 text-mineral">
            Volume é a venda descontada a variação dos preços; receita nominal, a venda em reais correntes. Varejo restrito, índices com ajuste sazonal com {mesCurto(inicio)} = 100: cálculo da Scrutiniums sobre a Pesquisa Mensal de
            Comércio do IBGE. A leitura mês a mês e a série desde 2019 ficam no painel com conta.
          </p>
        </div>
        <div>
          {/* no celular os nomes das linhas vêm acima do desenho, que fica com a largura toda */}
          <ul className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm sm:hidden" aria-hidden="true">
            <li className="flex items-center gap-2 text-carvao-muted">
              <span className="h-[3px] w-4" style={{ background: COR_RECEITA }} />
              Receita nominal <span className="tabular-nums">{num(fim.receita, 1)}</span>
            </li>
            <li className="flex items-center gap-2 text-carvao">
              <span className="h-[3px] w-4" style={{ background: COR_VOLUME }} />
              Volume de vendas <span className="tabular-nums">{num(fim.volume, 1)}</span>
            </li>
          </ul>
          <div className="grid sm:grid-cols-[minmax(0,1fr)_9rem]">
            <TesouraMini
              volume={volume}
              receita={receita}
              altura={170}
              descricao={`Receita nominal e volume de vendas do varejo restrito em índice, de ${mesExtenso(inicio)} (os dois em 100) a ${mesExtenso(fim.mes)}: receita em ${num(fim.receita, 1)} e volume em ${num(fim.volume, 1)}.`}
            />
            <div className="relative hidden sm:block" aria-hidden="true">
              <span className="absolute left-3 -translate-y-1/2 text-sm leading-tight" style={{ top: `${topoR}%` }}>
                <span className="block font-medium text-carvao-muted">Receita nominal</span>
                <span className="block text-xs tabular-nums text-carvao-muted">{num(fim.receita, 1)}</span>
              </span>
              <span className="absolute left-3 -translate-y-1/2 text-sm leading-tight" style={{ top: `${topoV}%` }}>
                <span className="block font-medium" style={{ color: COR_VOLUME }}>Volume de vendas</span>
                <span className="block text-xs tabular-nums text-carvao-muted">{num(fim.volume, 1)}</span>
              </span>
            </div>
            <p className="mt-1.5 flex justify-between text-xs tabular-nums text-mineral" aria-hidden="true">
              <span>{mesCurto(inicio)} = 100</span>
              <span>{mesCurto(fim.mes)}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
