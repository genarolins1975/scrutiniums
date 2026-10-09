import { Fragment } from "react";

/**
 * Siglas do domínio expandidas no ponto de uso: a sigla fica no texto e o nome por extenso vai em <abbr title>, que leitores de
 * tela e o foco por teclado expõem sem obrigar a ir ao glossário. Só as siglas que aparecem em textos do painel.
 */
export const SIGLAS: Record<string, string> = {
  DCA: "Declaração de Contas Anuais",
  RREO: "Relatório Resumido da Execução Orçamentária",
  MSC: "Matriz de Saldos Contábeis",
  IPCA: "Índice Nacional de Preços ao Consumidor Amplo",
  ISCED: "Classificação Internacional Normalizada da Educação",
  PPC: "paridade de poder de compra",
  OCDE: "Organização para a Cooperação e Desenvolvimento Econômico",
  DOU: "Diário Oficial da União",
  INEP: "Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira",
  Siconfi: "Sistema de Informações Contábeis e Fiscais do Setor Público Brasileiro",
  SIDRA: "Sistema IBGE de Recuperação Automática",
  Saeb: "Sistema de Avaliação da Educação Básica",
  SUS: "Sistema Único de Saúde",
  SIOPS: "Sistema de Informações sobre Orçamentos Públicos em Saúde",
  CNES: "Cadastro Nacional de Estabelecimentos de Saúde",
  APS: "atenção primária à saúde",
  ASPS: "ações e serviços públicos de saúde",
  ICSAP: "internações por condições sensíveis à atenção primária",
  RIPSA: "Rede Interagencial de Informações para a Saúde",
  SIH: "Sistema de Informações Hospitalares",
  AIH: "autorização de internação hospitalar",
  ANS: "Agência Nacional de Saúde Suplementar",
  UBS: "unidade básica de saúde",
  eSF: "equipe de Saúde da Família",
  eAP: "equipe de Atenção Primária",
};

const PADRAO = new RegExp(`\\b(${Object.keys(SIGLAS).join("|")})\\b`, "g");

export function Siglas({ texto }: { texto: string }) {
  const partes = texto.split(PADRAO);
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <abbr key={i} title={SIGLAS[p]} className="cursor-help no-underline decoration-dotted underline-offset-2 hover:underline">
            {p}
          </abbr>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
