import type { ReactNode } from "react";
import type { DominioId } from "@/lib/dominios";
import { OBSERVATORIO_PRINCIPAL, type ObservatorioId } from "@/lib/observatorios/lista";
import { BarraPlataforma } from "@/components/layout/BarraPlataforma";
import { SwitcherObservatorio } from "@/components/layout/SwitcherObservatorio";
import { NavegacaoObservatorios } from "@/components/observatorios/NavegacaoObservatorios";
import { AcessoConta } from "@/components/energia/AcessoConta";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { FerramentasConta } from "@/components/conta/FerramentasConta";
import { origemDoCabecalho } from "@/lib/conta/origens";
import { caminhoAtual, indiceDoCaminho } from "@/lib/observatorios/contexto";
import { ProvedorContexto, TrilhaCliente } from "@/components/layout/NavegacaoContexto";
import type { DominioFrescorId } from "@/lib/frescor";

/**
 * Barra comum dos observatórios e painéis (BarraPlataforma): marca, seletor da coleção corrente ("Setor Elétrico ▾"), as
 * abas dos seis observatórios com o atual marcado e a conta. Estática: a conta é resolvida no navegador (AcessoConta), que
 * mostra "Minha conta" a quem tem sessão e "Entrar" (com volta a esta página) a quem não tem; nunca as duas.
 *
 * Abaixo de 640 px as abas saem (public/observatorios.css) e os mesmos destinos ficam no seletor, na linha da marca, com a
 * conta (skill observatorio-layout, §4 "Cabeçalho no celular").
 *
 * O observatório marcado nas abas, a coleção do seletor e a trilha ("Você está em"), logo abaixo da barra, são os donos do
 * endereço no registro, os mesmos do rótulo acima do H1; os três se resolvem também no navegador a cada navegação, porque
 * este cabeçalho muitas vezes mora num layout, que o Next não refaz entre páginas irmãs (NavegacaoContexto.tsx).
 * `colecao`: domínio de origem da página; quando o endereço não está no registro, marca o observatório em que está o
 * núcleo dela (OBSERVATORIO_PRINCIPAL).
 * `observatorio`: para as páginas que pertencem a um observatório sem ser de uma coleção (as entradas dos seis e os
 * painéis do Território e Clima). `complementos`: o que vem à direita das abas (o seletor de idioma onde há tradução).
 *
 * À direita das abas, só para quem tem sessão, as ferramentas da conta (FerramentasConta): salvar o recorte, citar e
 * avisar quando atualizar. Abaixo de 640 px elas saem dali e entram, com a conta, num só botão "Conta ▾" na linha da marca. `fontes` troca as fontes de dados que o "Citar" e o "Avisar" oferecem quando as do
 * observatório não são as da página (os painéis do Território e Clima usam só a do próprio Território).
 */
export function CabecalhoPlataforma({
  colecao = null,
  observatorio,
  destinoConta,
  complementos,
  fontes,
}: {
  colecao?: DominioId | null;
  observatorio?: ObservatorioId | null;
  destinoConta: string;
  complementos?: ReactNode;
  fontes?: readonly DominioFrescorId[];
}) {
  const idioma = idiomaEnergia();
  const caminho = caminhoAtual();
  const indice = indiceDoCaminho(caminho);
  const marcado = observatorio ?? (colecao ? OBSERVATORIO_PRINCIPAL[colecao] : null);
  const origem = origemDoCabecalho(colecao, observatorio, fontes);
  return (
    <ProvedorContexto indice={indice} caminho={caminho}>
      <BarraPlataforma
        marca={{ href: hrefNoIdioma("/", idioma), rotulo: tx("Scrutiniums: página inicial", "Scrutiniums: home page", idioma) }}
        seletor={<SwitcherObservatorio atual={colecao} caminho={caminho} doProvedor />}
        acoes={
          <>
            {/* no celular, as ferramentas e a conta num só botão nesta linha (a barra não ganha uma linha só para elas) */}
            {origem && <FerramentasConta menu origem={origem.id} observatorio={origem.nome} dominios={origem.dominios} />}
            <AcessoConta destino={destinoConta} />
          </>
        }
        abas={
          <div className="bp-abas-linha">
            <NavegacaoObservatorios observatorio={marcado} />
            {complementos}
            {origem && <FerramentasConta origem={origem.id} observatorio={origem.nome} dominios={origem.dominios} />}
          </div>
        }
      />
      <TrilhaCliente idioma={idioma} className="bp-trilha" />
    </ProvedorContexto>
  );
}
