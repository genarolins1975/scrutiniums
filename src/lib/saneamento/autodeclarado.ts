/**
 * Valores financeiros que os prestadores declaram ao SINISA (receitas, despesas, investimentos, tarifa declarada, receita ou
 * despesa por metro cúbico e balanço). Decisão de 20/10/2026, depois da revisão de uma especialista em saneamento: esses valores
 * continuam publicados, mas só dentro dos capítulos e fichas que os tratam, sempre com a marca abaixo, e saem da página aberta,
 * das manchetes, dos números de abertura, dos rankings e do bloco "Para você". O teste `saneamento-autodeclarado` confere a regra.
 *
 * Quem declara: o formulário de gestão financeira do SINISA é preenchido pelo prestador (companhia, empresa, autarquia ou a própria
 * prefeitura, quando presta o serviço diretamente). O investimento "realizado pelo Estado" (GFI2036 e GFI2136) também vem desse
 * formulário: é o que o governo estadual investiu no sistema, informado pelo prestador.
 */

/** A marca, em minúsculas, para entrar no meio de uma frase. */
export const AUTODECLARADO = "autodeclarado ao SINISA, sem conferência com demonstrações financeiras auditadas";

/** A marca como frase, para rótulo próprio junto ao número. */
export const MARCA_AUTODECLARADO = "Autodeclarado ao SINISA, sem conferência com demonstrações financeiras auditadas.";

/** A explicação dada uma vez por capítulo e no método. */
export const RESSALVA_AUTODECLARADO =
  "Os valores financeiros do SINISA (receitas, despesas, investimentos, tarifa declarada e balanço) são informados pelo próprio prestador " +
  "no formulário de gestão financeira e publicados pelo Ministério das Cidades como foram declarados. O Observatório não os conferiu com " +
  "as demonstrações financeiras auditadas de cada prestador, e diferenças entre o declarado e o balanço publicado são possíveis. Por isso " +
  "esses valores aparecem só dentro dos capítulos que os tratam, cada um com a marca \"autodeclarado ao SINISA, sem conferência com " +
  "demonstrações financeiras auditadas\", e não entram em manchetes, rankings nem na página aberta.";

/** Quem declara o investimento, na forma que vai junto do número. */
export const QUEM_DECLARA_INVESTIMENTO =
  "Declarado ao SINISA pelos prestadores (companhias, empresas, autarquias e prefeituras que prestam o serviço): o investimento feito " +
  "pelo próprio prestador mais o feito pelo governo estadual no sistema, que o prestador informa";
