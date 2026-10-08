import { LiteralFonte } from "@/components/LiteralFonte";
import { TextoComDatas, type LiteralNoTexto } from "@/components/TextoComDatas";
import { FUSO_SEM_OFFSET_ENERGIA } from "@/lib/energia/formato";
import { defLiteral, type ClasseLiteral } from "@/lib/literais-fonte";
import { encontraDatas, type OpcoesData } from "@/lib/texto-datas";

/**
 * Texto de pipeline do domínio Energia: datas e competências legíveis (horário sem fuso na
 * convenção documentada do domínio, Brasília) e, quando `literais` e `origem` são dados, os
 * literais da fonte que o registro sabe reconhecer no texto identificados como tais.
 */
export function TextoEnergia({
  texto,
  origem,
  literais = [],
  competencia,
}: {
  texto: string;
  /** Endereço do recurso de onde vêm os literais deste texto. */
  origem?: string;
  literais?: ClasseLiteral[];
  competencia?: OpcoesData["competencia"];
}) {
  const declarados: LiteralNoTexto[] = origem ? literais.map((classe) => ({ classe, origem })) : [];
  return <TextoComDatas texto={texto} literais={declarados} fusoSemOffset={FUSO_SEM_OFFSET_ENERGIA} competencia={competencia} />;
}

/**
 * Célula ou campo que traz um valor de data exatamente como a fonte o escreveu: se for uma
 * data que o calendário não admite (e a classe aceitar o formato), sai como literal da fonte,
 * intacta; se for uma data válida ou texto comum, sai como prosa formatada.
 */
export function DataDaFonte({ valor, classe, origem }: { valor: string; classe: ClasseLiteral; origem: string }) {
  const achadas = encontraDatas(valor);
  const invalidaInteira = achadas.length === 1 && achadas[0].inicio === 0 && achadas[0].fim === valor.length && !achadas[0].valida;
  if (invalidaInteira && defLiteral(classe)?.padrao.test(valor))
    return (
      <LiteralFonte classe={classe} origem={origem}>
        {valor}
      </LiteralFonte>
    );
  return <TextoEnergia texto={valor} competencia="curta" />;
}
