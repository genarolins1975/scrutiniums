# Validação da edição Agro

Data: 17/10/2026. Interface própria aprovada no build de produção: **613 verificações, 96 telas, nenhum erro**. Relatório e amostra de capturas em `evidencias/`. O CI repete o roteiro no commit da entrega. O CI do PR é o gate final da suíte global no SHA da entrega. Os resultados finais ficam nos checks e artefatos do próprio PR. Não confundir diagnósticos/dev com essa evidência.

## Dados e cálculo

- Suíte Python completa, dependência existente pyarrow instalada em diretório gravável: **suíte de 1.900 testes sem falhas, seis ignorados**. A primeira execução expôs a falta dessa dependência do módulo de Energia; os erros não foram ocultados nem os testes alterados para passar. Reexecução após instalar a dependência declarada: aprovada.
- Contratos Agro: **16 testes Python**, incluindo hashes, reprodução determinística, reconciliação nacional/UF/programa/finalidade, 12 meses fechados, janela anterior adjacente, sinais SIDRA, original corrompido, duplicação, fonte incompleta, 84 perfis de sexo e preservação do total publicado, universo formal/Censo e conversões de unidades de candidatos PAM/PPM.
- **30 testes de cálculo**: contas independentes e contraprovas em margem, sensibilidade, decomposição com interação, unidades sem conversão de cabeça/litro para massa, cesta ponderada, SAC/Price, proteção, armazenagem, caixa, VPL, perdas, logística, câmbio, HHI/CV, água, especialização, ausência e escape de CSV; contagens rejeitam frações.
- **7 testes da fronteira de privacidade**: ação enum, sem parâmetro/identificador no evento, campos extras recusados, origem externa recusada, ausência de sessão sem gravação e limite de frequência.
- Foco de integração: 146 testes aprovados em seis arquivos. Expectativas de sete domínios foram atualizadas deliberadamente para oito, preservando os antigos destinos; seletor passa a nove opções incluindo o módulo Judiciário. Demais invariantes de autorização e conteúdo mantidos.

## Navegador

`scripts/agro/verificacao.mjs` inicia um servidor de produção do build existente, com PGlite e sessão temporários, sem credencial real, SMS/e-mail ou conta de produção. Testa 24 rotas em 320, 390, 768 e 1440 px, oito domínios logados/deslogados, seletor com nove destinos, painel/dado protegido e método/glossário públicos. Não acessa conta de cliente.

O script percorre os 32 laboratórios numéricos, cenário qualitativo, dez mecanismos com interpretação, comparação com base, unidades, divisor zero, CSVs integrais, URL/reload/histórico, seleção vazia/repetida/inválida, reset, perfil Censo, impressão PDF, foco/teclado e emulação equivalente a zoom de 200%. Axe A/AA roda nos documentos e nos resultados numéricos. Uma versão responsiva por figura é verificada. A síntese preserva fonte, data, unidade e ressalva. Uso mínimo é inspecionado no corpo entregue às APIs originais de envio do navegador, sem alterar o envio: contém somente `acao`. O Chromium pode omitir o postData de Beacon/Blob no protocolo; os testes também verificam a recusa de campos extras no servidor.

Rodadas de diagnóstico encontraram e corrigiram: endereço desconhecido respondendo 200; `<p>` fora de `<dd>` em listas de definição; regra CSS que exibia simultaneamente SVG mobile e desktop. Uma rodada dev foi interrompida por recarga durante edição e não vale como aprovação. Os controles foram preservados e passaram a integrar o roteiro final.

Nenhuma auditoria integral com leitor de tela ou pesquisa externa foi realizada. A emulação de 200% usa viewport de 720 pixels CSS e DPR 2 para uma janela de 1440 pixels, com reflow e teclado; não aciona o controle de zoom nativo nem cobre todas as combinações de ampliação de texto, navegador e tecnologia assistiva. Impressão solicitada não é contada como impressão efetivamente concluída.

## Didática e limites

[TAREFAS.md](TAREFAS.md) registra as dezesseis tarefas, exemplos e limites de atendimento. A tarefa 5 permanece bloqueada no emprego formal territorial; 12 e 15 são parciais por falta de referências observadas. As demais operações podem ser verificadas por walkthrough; isso não comprova aprendizagem de pessoas reais nem impacto econômico/social. [RELEVANCIA.md](RELEVANCIA.md) separa esses eixos e propõe estudo voluntário posterior.

Os 11 bloqueios integrais (13 até a fase 1 da economia, que entregou E3 e E6) e os requisitos de medição não atendidos por cenário estão individualizados no catálogo. Publicar as páginas não remove esses bloqueios. Fontes oficiais: `fontes-acesso.json` registra as falhas CONNECT 403. Atualizar configuração do ambiente requer publicação do rascunho salvo; nenhuma tentativa de contornar proxy/TLS foi feita.

A primeira suíte global identificou expectativas fixas de sete observatórios, ausência do novo nome de produto no glossário de infraestrutura e formatação do inventário gerado. As expectativas foram atualizadas para oito de forma explícita; não foram removidos invariantes de conteúdo, nomes, destinos ou acesso. O inventário de Energia foi regenerado pelo seu gerador. Uma verificação aritmética de Mobilidade excedeu cinco segundos durante execução concorrente com capturas; os valores reconciliaram sem diferença e o teste passou isoladamente, sem alterar dado ou tolerância. Os cinco arquivos de integração corrigidos passaram em 96 testes. A suíte global é repetida sem a captura concorrente.

O PDF foi também inspecionado com extração de texto: pergunta, três UFs, unidade, fonte, período, hash e ressalva material preservados. Pode ocupar mais de uma página; não é uma imagem sem contexto.

Fechamento local: 44 testes dos dois arquivos de HTML/navegador da home PT/EN aprovados após ajustar a grade de oito cartões, a contagem e os testes de rejeição de adulterações. O roteiro Agro passou novamente, agora com 613 checks/96 telas e dois casos adicionais: mudar a unidade da margem ou o destino de uma conversão encerra a base anterior; não se subtraem números em kg/saca ou litros/mil litros como se fossem a mesma unidade. Nenhum dado ou tolerância aritmética dos outros observatórios foi alterado. As execuções integrais anteriores cobriram 301 arquivos/7.752 testes; os seis casos restantes das fixtures da home foram corrigidos e revalidados nos 44 testes. O CI repete a suíte inteira.

O gate de navegação completo detectou um contraste transitório no comparador internacional do Judiciário: texto claro enquanto o fundo ainda fazia transição a partir do branco. A troca foi tornada imediata, sem alterar dados ou limiares da auditoria. O roteiro passou a medir também o contraste no primeiro quadro da seleção por teclado, além da auditoria Axe posterior, com diagnóstico detalhado em caso de falha.

A revisão identificou dois contratos incompletos: as decomposições A2/E5 declaravam barras sem renderização e a contagem de visitas do novo domínio não recebia eventos. A2/E5 passaram a ter barras divergentes com origem zero e tabela equivalente, verificadas com contribuições positivas, negativas e nulas em quatro larguras. Visitas usam apenas `agro:paginas`: sem usuário no registro, caminho, consulta ou parâmetros. O painel administrativo informa que usuários únicos/ativos do Agro não são medidos.

Rodapés completo e compacto: grades redistribuídas para oito e seis elementos, respectivamente, sem coluna institucional órfã. Roteiro verifica PT/EN e compacto em 768, 1024, 1280 e 1440 px, além das quatro larguras do restante da interface.

A conferência de 320 px encontrou também o cabeçalho público sem quebra entre marca e ação de cadastro. A linha agora pode quebrar, preservando ambos os destinos; o teste PT/EN passa a exigir largura absoluta compatível com o viewport, além de comparar os idiomas.

Regressão da revisão: 638 verificações locais em modo de desenvolvimento no commit `35c2c4b1b`; depois, 18 verificações específicas de cabeçalho/rodapés em seis larguras, todas aprovadas. As quatro imagens `decomposicao-*`/`rodape-*` registram essas inspeções. O roteiro de CI acrescenta 12 casos de rodapé à suíte de produção; o resultado definitivo fica no run do SHA integrado, sem confundir a regressão em desenvolvimento com build de produção.

Captura candidata: revisão adicional fortaleceu a cobertura para cada indicador × ano × território, com rejeição de variáveis omitidas, células ausentes, anos extras e IDs repetidos nos metadados. Os 20 testes Agro de dados/captura passaram; os quatro novos casos incluem captura simulada completa e preservação byte a byte do candidato anterior em falha, sem chamadas de rede ou alterações na Gold preservada.
