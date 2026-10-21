import { AbasObservatorios } from "@/components/layout/NavegacaoContexto";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import type { IndiceContexto } from "@/lib/observatorios/contextoPuro";
import { OBSERVATORIOS, destinoObservatorio, type ObservatorioId } from "@/lib/observatorios/lista";

/**
 * Abas dos seis observatórios na barra comum dos painéis (CabecalhoPlataforma):
 * os mesmos rótulos e a mesma ordem do cabeçalho público e da barra da
 * aplicação do Crédito (public/obs/index.html). Dentro dos painéis, quem tem
 * conta vai à entrada do observatório ou à sua seção na escolha pós login. A
 * aba destacada é o observatório dono do endereço no registro, resolvido também
 * no navegador a cada navegação (AbasObservatorios); fora do registro, o que a
 * página declarou. Os nomes são nomes próprios: em inglês ficam em português,
 * marcados com Nome.
 */
export const ABAS_OBSERVATORIOS: { id: ObservatorioId; href: string; rotulo: string }[] = OBSERVATORIOS.map((o) => ({
  id: o.id,
  href: destinoObservatorio(o),
  rotulo: o.nomeCurto,
}));

export function NavegacaoObservatorios({
  observatorio,
  indice = { observatorios: [], paineis: [] },
  caminho = null,
}: {
  observatorio: ObservatorioId | null;
  indice?: IndiceContexto;
  caminho?: string | null;
}) {
  const idioma = idiomaEnergia();
  return <AbasObservatorios indice={indice} caminho={caminho} padrao={observatorio} abas={ABAS_OBSERVATORIOS} rotulo={tx("Observatórios da Scrutiniums", "Scrutiniums observatories", idioma)} />;
}
