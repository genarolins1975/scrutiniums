# Registro de design da extensão de Saúde — 28/10/2026

Extensão local em modo **Operate/Read**: consultar competências mensais da APS e entender a cobertura dos indicadores das capitais. A prioridade e os limites estão em [COBERTURA_CAPITAIS_2026-10-28.md](./COBERTURA_CAPITAIS_2026-10-28.md). A entrega amplia a consulta de dados preservados; não conclui a cobertura máxima nem resolve as novas coletas bloqueadas pelo proxy.

Aplicado o contrato de `reference/degraded/documenter.md` da skill Impeccable como substituição do agente distribuído não instalado. Este registro documenta a extensão, sem criar `DESIGN.md`, `PRODUCT.md`, sidecar ou outra autoridade global. O sistema vigente continua em [DESIGN_SYSTEM_OBSERVATORIOS.md](../../observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md), com cores e escala em `src/app/globals.css`.

## Comparação com o sistema vigente

- **Paleta:** papel, carvão, filetes e acento OBEE existentes; nenhuma cor ou token novo nos componentes mensais e de cobertura.
- **Tipografia:** o título mensal herda a serifa e a escala do componente compartilhado `Recolhido`; o subtítulo usa `t-h3`, texto usa `t-corpo` e notas usam `t-meta`; mantêm serifa dos títulos e Inter do corpo. Rótulos permanecem no padrão da plataforma.
- **Composição:** consulta mensal na área `tabelas` de `PaginaPainel`, com raiz `Recolhido` aberta por padrão e acesso direto por âncora; controles em uma coluna no celular e grade progressiva. O inventário entra na página de métodos como seção recolhível, sem nova identidade visual.
- **Interação:** reutiliza `Recolhido`, `Controles`, `Selecao`, `TabelaDados` e `useEstadoUrl`; controles e ações principais têm alvo mínimo de 44 px. Parâmetros `aps_*` separam o recorte mensal do anual; download oferece a série completa.
- **Evidência:** pergunta, unidade, fonte, captura, limites e método acompanham a tabela. O selo `OBSERVADO` identifica valores publicados pela fonte, inclusive provisórios; 2021 e 2026 têm ressalvas próprias. Ausência não vira zero e presença de valor no inventário não significa completude.

## Evidência consultada e alcance

Leitura dos componentes `ApsMensalSaude.tsx`, `CoberturaIndicadoresSaude.tsx`, da integração em `PaginaTemaSaude.tsx` e `metodos/page.tsx`, e do contrato de medidas/transporte em `src/lib/eficiencia/saude/mensal.ts`. Conferidos também tokens, configuração tipográfica, controles compartilhados, `TabelaDados`, escopo, arquitetura e README do módulo. O diff da página de métodos confirma que a tipografia própria do cabeçalho e das seções antecede esta extensão.

Consultados [evidencias.md](../../ux-2026-10-28/saude-cobertura/evidencias.md), [interacoes.json](../../ux-2026-10-28/saude-cobertura/interacoes/interacoes.json) e as capturas [mensal-390.png](../../ux-2026-10-28/saude-cobertura/interacoes/mensal-390.png), [cobertura-390.png](../../ux-2026-10-28/saude-cobertura/interacoes/cobertura-390.png) e [recolhido-390.png](../../ux-2026-10-28/saude-cobertura/interacoes/recolhido-390.png). A última foi aberta após a integração ao molde e confirma o estado fechado com título e resumo preservados. O código confirma abertura inicial e inserção na área de tabelas; a coordenação verificou abrir e fechar no navegador.

O relatório genérico atualizado, build `Woa0osUcOH_36SII_7KoW`, registra 16 verificações em 320, 390, 768 e 1440 px, com e sem sessão, sem violações axe, erros de console ou rolagem horizontal da página; a rota do painel sem sessão termina no login. A conclusão dessa execução também foi conferida em `/tmp/saude-evidencias-molde.log`. O registro de interações informa 11 medidas e ausência de erros nos recortes, URL, recarga, voltar, parâmetros inválidos, CSV e inventário.

As capturas examinadas confirmam o selo `OBSERVADO`, sua explicação sobre valores publicados e provisórios, e as orientações de rolagem nas duas tabelas a 390 px. A coordenação informou parecer final de revisão `ship`: integração resolvida, natureza, avisos e rolagem preservados, sem regressão identificada no escopo. Informou sucesso do build e do teste focal obrigatório `painel-molde` após a integração (4 testes aprovados, incluindo APS mensal; 80 ignorados). Informou também sucesso do script `scripts/obee/saude-cobertura-verificacao.mjs`, incluindo teclado e simulação CSS a 200%. Nenhum teste foi executado novamente pelo documentador. A execução final de `verificar:rapido` permanece pendente neste registro. Não há afirmação de deploy ou aprovação final do ciclo completo.

## Divergências que não viram regra

`PRODUCT.md` e `DESIGN.md` globais ausentes são condição preexistente; o escopo e a arquitetura locais fornecem contexto suficiente para esta extensão estreita. A página de métodos conserva tamanhos tipográficos locais fora das classes de papel. O controle compartilhado `Selecao` conserva borda `linha`, embora a autoridade prescreva mineral para campos. Nenhum desses pontos foi reparado ou promovido a padrão.

A autoridade global pede listas de definição no celular e restringe rolagem horizontal ao explorador; a arquitetura de Saúde e `TabelaDados` já admitem rolagem local para tabelas largas. A extensão reutiliza esse comportamento, com primeira coluna fixa e instrução de deslizar. Registra-se a divergência documental, sem redefinir a regra global nem confundir rolagem interna com transbordamento da página. A implementação mensal apresenta os elementos editoriais em `Recolhido` na área de tabelas de `PaginaPainel`, sem adotar diretamente `PainelEvidencia`; isso não altera a prescrição global para visualizações relevantes.

**Conclusão:** preservada a identidade editorial existente, sem mudança de sistema; selo e orientação de rolagem confirmados nas capturas finais. O bloco mensal segue o molde compartilhado e pode ser recolhido. Este registro não canoniza divergências herdadas nem antecipa o resultado final de `verificar:rapido`.


## Fechamento da rodada

A rodada genérica final terminou sobre o build corrigido: 16 combinações de duas rotas, quatro larguras e presença/ausência de sessão, com zero violações axe, erros de console ou transbordamento horizontal da página. O relatório e as capturas em `docs/ux-2026-10-28/saude-cobertura` foram substituídos pelos finais.

O revisor independente retornou `ship` no verdict pass: natureza do dado e descoberta da rolagem resolvidas. Reavaliou e retirou a exigência de PRODUCT.md pela exceção expressa para extensão local no SKILL.md; o índice de Saúde fornece o contexto necessário. Esse aceite cobre os consertos avaliados, não a cobertura máxima global nem uma auditoria integral de acessibilidade. Os agentes distribuídos não estavam instalados; agentes independentes aplicaram os contratos de revisão/documentação fornecidos pela skill.

### Fechamento da coordenação

A verificação geral foi executada: lint/tipos/i18n passaram; 6.603 testes passaram e um teste de Cadastro Único excedeu 5 segundos. Repetição isolada de seu arquivo junto ao Atlas: 25 testes aprovados. O build e as evidências visuais passaram; não declarar a rodada geral integralmente verde nem deploy confirmado.
