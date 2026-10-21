# Revisão do painel federal — encerramento parcial em 13/10/2026

O usuário pediu revisão por quatro perspectivas: contas públicas, design de produto de alto rigor, didática e usuário padrão. São papéis simulados por agentes de IA, sem vínculo com a Apple ou validação humana representativa. Posteriormente solicitou encerrar a etapa no nível alcançado. Não foi comprovada nota superior a 9 em todas as dimensões.

## Alterações entregues

- Perguntas iniciais delimitam pagamentos do orçamento do exercício e saldo primário sem juros. A fonte de RAP da abertura identifica todos os órgãos da Base Geral.
- Corrigida a definição temporal dos restos a pagar não processados: classificação na inscrição, não situação de liquidação atual.
- Guia interativo com quatro perguntas, definições, exemplos explicitamente didáticos e links para os painéis correspondentes.
- Capítulos distinguem recortes com dados e propostas sem série. Definições extensas ficam em expansão, com navegação entre os cinco painéis observados.
- Filtros de execução, resultado fiscal, comparação, custos, RAP e metas são preservados na URL; botão de compartilhamento tem alternativa de cópia manual.
- Metas mostram cobertura calculável e deixam explícito que barras de programações diferentes têm escalas próprias. Há ação para limpar filtros.
- Fonte, período, universo e unidade permanecem visíveis; metadados completos ficam em expansão.
- Mês fiscal exibido passa a derivar da referência da série. Aviso editorial identifica a edição de agosto já publicada e ainda não integrada.
- A abertura e o índice federal acrescentados a main por outra frente foram preservados. A busca de capítulos existente nessa versão substitui a alternativa que havia sido criada nesta revisão.

## Evidência fiscal da primeira rodada

| Dimensão | Nota inicial | Evidência/pendência |
|---|---:|---|
| Rigor conceitual | 8,6 | Perguntas amplas e definição temporal de RAP corrigidas nesta entrega. |
| Fontes e atualidade | 7,6 | RTN integrado permanece julho/2026; agosto publicado em 29/09/2026. |
| Comparabilidade | 8,8 | Escalas próprias de metas agora explicitadas junto à lista. |
| Utilidade analítica | 8,4 | Navegação e indicação de cobertura aprimoradas. |
| Cobertura e promessa editorial | 7,7 | Execução deixou de prometer perfil mensal que não existe. |
| Rastreabilidade/reprodução | 9,1 | Fontes, conciliações e arquivos preservados. |

Essas notas correspondem ao diagnóstico inicial do revisor fiscal. Não são notas finais do design ou dos demais papéis. A inspeção visual inicial da produção foi parcial; a revisão final em desktop/mobile e a segunda rodada completa da banca não foram concluídas.

## Validação concluída

- TypeScript: `tsc --noEmit --incremental false`, sem erros.
- Testes do módulo federal: 8 arquivos, 53 testes aprovados.
- `git diff --check`: sem erros.
- Nenhum valor fiscal foi inventado ou substituído por aproximação.
- Conciliação da home e CSS com a versão de main `1409dad1a2a74196f66884ae2b38ec63b9bb0f2a`; teste de tipos e 53 testes repetidos depois dessa conciliação.

## Pendências para aprovação final

1. Incorporar o XLSX oficial de agosto/2026 com hash, publicação e conciliação. A tentativa de download foi interrompida; não há alegação de atualização concluída. Fonte: https://www.tesourotransparente.gov.br/publicacoes/boletim-resultado-do-tesouro-nacional-rtn/2026/8.
2. Verificar interações, compartilhamento/reabertura, teclado, contraste, 320/390/768/1440 px e zoom de 200% na versão renderizada. Houve interrupção da conexão do navegador; o servidor de preview local foi bloqueado por `listen EPERM`.
3. Completar build/CI da candidata e obter segunda rodada dos quatro avaliadores, com evidências por dimensão. Testes unitários e tipos não comprovam qualidade visual.
4. Revisar e integrar o PR antes de publicação. Esta etapa não autoriza declarar produção atualizada nem nota >9 atingida.
