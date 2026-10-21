# Agronegócio — continuidade

Pedido executado: `Prompt_Codex_Agronegocio_Scrutiniums.txt`, versão 3 de 17/10/2026, original anexado pelo usuário (50.130 bytes). Autorização explícita: implementação, branch, commits, PR, merge após controles e publicação. Sem equipe automática de agentes, serviços pagos ou LLM em cálculos.

Base: `5df384765` (main, inclui Energia bilíngue); árvore inicial limpa. Branch `codex/observatorio-agronegocio`. Checkout existente, sem worktree extra. AGENTS/CLAUDE, skill local completa de layout e skills cloud runtime/setup lidas. Ambiente e dependências já preparados; Chromium local requer `I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium`.

## Contrato da entrega

Observatório próprio `/agronegocio`, sete cadeias (soja, milho, arroz, feijão, café, bovinos e leite), oito capítulos, panorama, atlas, sete fichas, comparador, explorador, calendário quando houver fonte e simuladores. Catálogo de 68 artefatos deve ser percorrido individualmente. Não contar componentes repetidos, cartões ou explicações como medições. Identificar observado, conceitual e cenário. Nenhuma promessa de impacto causal econômico/social.

## Rede observada

Primeira sondagem: `/workspace/agro-pesquisa/sondagem.json`, script `/tmp/agro-sondar-fontes.py`. As APIs de metadados PAM 5457, PPM 3939/74, IPCA 7060 e Censo Agro 6753, Conab, Comex, BCB e INPE responderam CONNECT 403 da política de rede. Não é falta de dado nem erro de autenticação da fonte.

Domínios oficiais adicionados de forma cumulativa ao rascunho do ambiente, preservando os dez anteriores. Salvamento confirmado, `requires_publish:true`; usuário orientado em comentário a revisar/salvar as configurações e publicar o ambiente. Rascunho não muda a rede em execução. Não repetir pedidos iguais sem mudança de estado; não contornar proxy/TLS.

## Fontes preservadas para investigar/reaproveitar

- Crédito: `public/obs/data/gold/rural.json`, fonte BCB MDCR/Sicor, gerado em 24/09/2026, meses 2013-01 a 2026-08 (parcial), janela fechada 2025-08 a 2026-07. Nacional, 27 UFs, programas, finalidade e produtos; `rural_mun.json` separado. Verificar hashes, grão e reconciliação; não reutilizar textos de variação sem conferir as janelas (a janela anterior no arquivo não é adjacente à atual).
- Geometria oficial: `public/energia/geo/uf.json`, com fonte, data, projeção e checksums; reutilizar, não desenhar mapa aproximado.
- IPCA geral: `data/contas-publicas/ipca-2026-10-12/ipca.json` e original `pipeline/gas/seed/ibge/ipca-gas.json.gz`; itens de alimentos ainda não conferidos.
- Trabalho e renda: brutos e gold existentes em `public/eficiencia/trabalho-renda`, ainda verificar abertura CNAE e elegibilidade agro.
- Clima: séries e origem em `public/energia/series/clima_diario.csv` e pipeline próprio; cobertura não é necessariamente produção agro, verificar antes de reaproveitar.

## Marco de implementação e primeiro piloto

Pipeline offline próprio (`pipeline/agro/run.py`) gera snapshot, dois CSVs e manifesto a partir de sete fontes fixadas por hash/commit. Crédito fecha por UF, programa e 12 meses; variação anterior recalculada com janela adjacente. Metadados de captura oficial PAM/PPM preparados em `capturar.py`, sem chamada repetida à fonte bloqueada. As capturas online ainda não foram integradas ao gerador: não afirmar atualização de produção pronta.

Núcleo de cenários em `src/lib/agro/calculos.ts`, contratos em `laboratorios.ts`; componentes em `src/components/agro`; oito capítulos, início, panorama, atlas e comparador implementados. Dados públicos preservados mantidos separados de entradas do usuário. Registro adicional X1 anterior à implementação: grupo ocupacional Censo 2022 por UF e sexo; não é emprego formal de todo o agro.

15 testes Python e 29 testes Vitest de cálculo aprovados. Piloto de Custos no navegador/dev com banco e sessão exclusivamente locais: 4 larguras, 13 checks, nenhum erro, axe/reflow e comparação base/cenário com foco aprovado. Capturas em `/workspace/agro-piloto`; relatório em `resultado.json`. Um erro inicial de sintaxe JSX foi corrigido; o relatório aprovado é o v2 (`/tmp/agro-piloto-v2.log`). O servidor de teste foi encerrado pelo script. Após o piloto, valores grandes do atlas/gráficos e SVG mobile foram refinados e precisam de nova validação. Não usar build antigo: dev alterou .next.

Integração do novo domínio Agro iniciada em domínio, seletor, vitrine, navegação, eventos de seleção e cache dos dados. Testes e textos de sete observatórios devem ser atualizados para oito; seletor tem nove destinos incluindo Judiciário. Tipos ainda pendentes dessa atualização de fixtures. Nenhuma dependência/lockfile alterada.

Próximo: concluir sete fichas/T2, percursos T3, glossário T4, oficinas T7, síntese T6, cobertura/método T8 e catálogo com estados finais por item. Completar interfaces e a validação global, remover helper temporário `scripts/agro/.piloto.mjs`, regenerar i18n só após o código final. Rede ainda bloqueia fontes agrícolas e ambientais; rascunho salvo e ação do usuário já explicada, sem nova solicitação de confirmação.

## Marco de integração e validação global

Todas as rotas e componentes do recorte parcial foram construídos: oito capítulos, sete fichas/T2, percursos, glossário, oficinas, síntese e catálogo. Catálogo: 69 contratos, 56 tarefas implementadas (7 observadas, 16 conceituais, 33 cenários), 13 bloqueios integrais individualizados. Não afirmar cumprimento integral das medições da especificação. D1 e H2 são parciais no grão; K11/K12, custos de referência e outros cenários não substituem medição observada. Fonte Bovinos não distingue corte/leite.

Suíte Python completa passou com pyarrow no destino gravável: 1900 testes, seis ignorados. 16 contratos de dados e 37 cálculos/privacidade passaram; 146 testes de integração focada aprovados. Build v2 compilou e gerou 1140 páginas, mas recebeu correções posteriores e não é o build final. QA dev v1 interrompido por recarga durante edição, sem aprovação global. QA dev v2 em andamento, com foco, definição de lista e exclusividade dos SVGs corrigidos. Precisa build novo depois de dev, então QA de produção completo, Vitest global com HTML obrigatório, revisão visual final, evidências, PR/CI/revisão/merge/deploy. Não iniciar next dev durante build/teste de produção nem editar árvore durante Vitest global.

Configuração cloud: rascunho cumulativo revisão 9 salvo, incluindo dependência Python no install_script e instrução PYTHONPATH=/workspace/.python-deps. Os 29 domínios foram preservados. requires_publish=true; usuário já orientado a revisar/salvar/publicar ambiente, sem nova pergunta. Runtime continua revisão 1, rede restrita sem os domínios adicionais efetivos. Não repetir as mesmas sondagens 403. Fonte Agro nova online ainda não integrada.

## Estado antes dos gates finais

Build final dos componentes e QA de produção concluídos: 611 checks, 96 telas, nenhum erro, 32 laboratórios + cenário qualitativo, dez mecanismos, percursos, busca, CSV/PDF, menu, teclado e zoom equivalente. Evidências copiadas em docs/agro/evidencias; relatório inclui hash do snapshot e BUILD_ID, codigoGit null por ser anterior ao commit. Últimas alterações posteriores são integração global de nomes/fixtures/i18n, sem mudança nos componentes Agro. CI executará novamente a interface no SHA da entrega.

Primeira suíte completa: 301 arquivos, 7752 testes; falhas de fixtures antigas e de inventário/registro foram tratadas. Timeout de Mobilidade foi reproduzido como contenção de CPU, não falha de reconciliação; caso passou isolado sem mudança de teste/dado. Cinco arquivos corrigidos: 96 testes verdes. Necessário build novo com o glossário atualizado e suíte global sem a captura concorrente. Nenhum PR ou merge Agro ainda. Fontes online continuam bloqueadas.

## Fechamento da implementação — registro anterior ao PR

Componentes Agro finais: 613 checks em produção local, 96 telas, zero erros. Dois casos novos garantem limpar a base quando a unidade muda. Home PT/EN: 44 testes verdes; demais cinco arquivos de integração: 96 verdes; pipeline completo: 1900 testes, seis ignorados. Nova execução integral no CI obrigatório. As falhas remanescentes das duas passagens globais foram expectativas de uma grade de sete itens e unidade do índice; corrigidas explicitamente sem apagar a detecção de adulterações. Não modificar tolerâncias de Mobilidade: o caso passou isolado, e a segunda suíte integral não repetiu seu timeout.

A grade pública usa oito páginas por pergunta para Agro nos dois idiomas, com cobertura parcial visível no texto da vitrine. Fontes, coeficientes e funções matemáticas não mudaram nesse ajuste. Build integrado de 1140 páginas aprovado; i18n regenerado após o último código. Evidências atualizadas em docs/agro/evidencias. Código e documentos deste marco antecedem os checks/merge; consultar o PR da branch codex/observatorio-agronegocio para estado final, SHA, revisão e produção. Autorização para PR/merge/publicação já consta do anexo executado, sem nova confirmação.
