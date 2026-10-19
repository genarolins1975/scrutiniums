import type { ReactNode } from "react";
import type { DominioId } from "@/lib/dominios";
import { OBSERVATORIO_PRINCIPAL, type ObservatorioId } from "@/lib/observatorios/lista";
import { BarraPlataforma } from "@/components/layout/BarraPlataforma";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";
import { NavegacaoObservatorios } from "@/components/observatorios/NavegacaoObservatorios";
import { AcessoConta } from "@/components/energia/AcessoConta";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";

/**
 * Barra comum dos observatórios e painéis (BarraPlataforma): marca, seletor da coleção corrente ("Setor Elétrico ▾"), as
 * abas dos seis observatórios com o atual marcado e a conta. Estática: a conta é resolvida no navegador (AcessoConta), que
 * mostra "Minha conta" a quem tem sessão e "Entrar" (com volta a esta página) a quem não tem; nunca as duas.
 *
 * Abaixo de 640 px as abas saem (public/observatorios.css) e os mesmos destinos ficam no seletor, na linha da marca, com a
 * conta (skill observatorio-layout, §4 "Cabeçalho no celular").
 *
 * `colecao`: domínio de origem da página; marca o observatório em que está o núcleo dela (OBSERVATORIO_PRINCIPAL).
 * `observatorio`: para as páginas que pertencem a um observatório sem ser de uma coleção (as entradas dos seis e os
 * painéis do Território e Clima). `complementos`: o que vem à direita das abas (o seletor de idioma onde há tradução).
 */
export function CabecalhoPlataforma({
  colecao = null,
  observatorio,
  destinoConta,
  complementos,
}: {
  colecao?: DominioId | null;
  observatorio?: ObservatorioId | null;
  destinoConta: string;
  complementos?: ReactNode;
}) {
  const idioma = idiomaEnergia();
  const marcado = observatorio ?? (colecao ? OBSERVATORIO_PRINCIPAL[colecao] : null);
  return (
    <BarraPlataforma
      marca={{ href: hrefNoIdioma("/", idioma), rotulo: tx("Scrutiniums: página inicial", "Scrutiniums: home page", idioma) }}
      seletor={<SwitcherObservatorio atual={colecao} />}
      acoes={<AcessoConta destino={destinoConta} />}
      abas={
        <div className="bp-abas-linha">
          <NavegacaoObservatorios observatorio={marcado} />
          {complementos}
        </div>
      }
    />
  );
}
