# Plano de implementação

Workflow com dois papéis: **executor** implementa; **auditor**, em contexto limpo, verifica correção conceitual, estatística, integridade temporal, auditabilidade, didática, UX, acessibilidade, responsividade, segurança e regressão do Crédito. Etapa encerrada só com parecer ACEITO ou ACEITO COM RESSALVAS NÃO BLOQUEANTES.

## Fase 1. Plataforma de dois observatórios

* `src/lib/dominios.ts` (registro único); home com "Uma plataforma. Dois observatórios."; cards editoriais; tela `/app/observatorios`; destino pós login; switcher no cabeçalho do Setor Elétrico, da área de conta e da SPA do Crédito; `/credito` como atalho; telemetria com domínio.
* Aceite: suíte do Crédito inteira verde; nenhuma URL pública alterada; testes novos de rota, destino pós login e telemetria.

## Fase 2. Shell do Setor Elétrico

* Layout com cabeçalho, navegação dos 12 módulos, rodapé de fontes; componentes de evidência; Visão geral narrativa; Metodologia; Aprenda (verbetes com fonte conferida); Catálogo.
* Módulos sem dado integrado exibem escopo, perguntas e datasets catalogados, sem número.

## Fase 3. Dados estruturais

* `pipeline/energia`: coletores ONS e CCEE, seed CCEE com sha256, silver com vintages, gold com proveniência, CSVs, workflow diário próprio.
* Indicadores: PLD realizado, EAR, ENA, carga, geração por fonte, intercâmbios, CMO.

## Fase 4. PLD didático

* Página em três modos; diagrama interativo; submercados; mapa de intercâmbio; bloco de previsão com estado real; registro de modelos e model cards; arquivo de previsões com a rodada interna de 27/09.
* Validações automáticas de governança (Python e vitest).

## Fase 5. Previsão operacional

Somente após gates V e P do modelo escolhido, conclusão de G4 e liberação do dono. Até lá o bloco principal mostra indisponibilidade com motivo.

## Fase 6. Expansão

Empresas e ativos (master de entidades por identificadores oficiais: CNPJ, CEG, código ANEEL), mercado (CCEE), transmissão (limites, ativos), distribuição (ANEEL: tarifas, DEC e FEC, MMGD), expansão (leilões, RALIE, PDE), regulação (linha do tempo com documentos primários).

## Critério de excelência por página

Nota de 0 a 10 em estética, clareza, didática, correção conceitual, navegação, profundidade analítica, auditabilidade, confiabilidade, acessibilidade e responsividade. Página central não fecha com nota abaixo de 9 em didática, correção conceitual e auditabilidade. Toda dimensão abaixo de 9 registra problema, impacto, solução e evidência após correção em `docs/observatorios/AVALIACAO_PAGINAS.md`.

## Riscos e dependências

| Risco | Tratamento |
| --- | --- |
| CCEE bloqueia o ambiente de coleta | seed versionado com sha256; coletor direto tenta a cada execução; pane registrada e exibida; captura manual documentada |
| Revisões do ONS ("consistência recorrente") | vintages no silver; revisões publicadas na proveniência |
| Limites regulatórios do PLD não auditados | classificação por percentil nominal com a limitação declarada; "menor valor observado no ano" nunca chamado de piso |
| Resultados da pesquisa PLD ainda em revisão | retidos do portal até G4 e liberação |
