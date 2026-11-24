import type { Metadata } from "next";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { EntradaColecao } from "@/components/observatorios/EntradaColecao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { escalaVarejo, MetodoDaEntrada } from "@/components/varejo/EntradaVarejo";
import { comConta } from "@/lib/varejo/convite";
import { tituloNaColecao } from "@/lib/observatorios/contexto";
import { curadoria, goldEmpresas, goldSetor, leituraBrasil, mesAnterior } from "@/lib/varejo/dados";
import { mesExtenso, variacao } from "@/lib/varejo/formato";
import { PERGUNTA_APERITIVO, ROTA_VAREJO, SECAO_APERITIVO } from "@/lib/varejo/paginas";

/**
 * Versão aperitivo do Varejo (princípio do aperitivo, decisão do dono de 20/10/2026). Quem acessa /varejo sem sessão recebe
 * esta página por rewrite (src/middleware.ts); quem tem conta recebe ali a entrada completa. O aperitivo é o último resultado
 * da Pesquisa Mensal de Comércio (volume e receita, com fonte e período) e o tamanho do mercado na pesquisa anual. Sem série,
 * sem atividades, sem estados, sem mapa (a malha das UFs não é pública), sem companhias e sem arquivo para baixar: tudo isso
 * fica com a conta, listado no convite do fim, dimensionado pelas próprias golds.
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
        notaEscala="Volume é a venda descontada a variação dos preços; receita nominal é a venda em reais correntes. Os dois primeiros números são do varejo restrito, que não inclui veículos, material de construção nem atacado de alimentos."
        convite={
          <div className="mx-auto max-w-page px-6">
            <ConviteAperitivo rota={ROTA_VAREJO} comConta={comConta(g, e, curadoria())} className="mt-6" />
          </div>
        }
        metodo={<MetodoDaEntrada g={g} e={e} aberta />}
      />
    </>
  );
}
