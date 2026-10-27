# Recuperar e compartilhar uma análise — frente 3

Pedido do dono em 27/10/2026: iniciar a terceira recomendação do conselho. Este incremento corrige a fidelidade do recorte e o fluxo da conta. Não cria um arquivo de edições históricas dos dados.

## Linha de base

`main` atualizado em `3e6ca25b086173dafead7dcff50cfefcb8a7297f`, depois da publicação das frentes 1 e 2. Preparação com `bash scripts/preparar-sessao.sh`, build de produção, Chromium 154 local e sessão real em banco PGlite efêmero. Nenhuma credencial ou conta de produção.

As duas avaliações iniciais foram feitas em agentes separados: leitura de layout e inspeção mecânica. A segunda reproduziu as jornadas no build da linha de base em 320, 390, 768 e 1440 px.

| Falha anterior | Evidência |
|---|---|
| Selecionar Pernambuco e 60 litros; recarregar devolvia 40 litros, mantendo Pernambuco. | [Registro nas quatro larguras](antes/mecanica-antes.json) |
| Abrir Salvar em SP e voltar para PE mantinha SP no formulário. | [Histórico com painel aberto](antes/voltar-painel-antes.json) |
| Negar a área de transferência não oferecia mensagem nem cópia manual. | [Registro de interação](antes/mecanica-antes.json) |
| Escolher Salvar no menu móvel deixava o foco no corpo da página. | [Registro de foco](antes/mecanica-antes.json) |

Capturas anteriores: [Combustíveis, 390 px](antes/combustiveis-390-antes.png), [Salvar, 390 px](antes/salvar-390-antes.png), [Minha conta, 390 px](antes/conta-390-antes.png); [Combustíveis, 1440 px](antes/combustiveis-1440-antes.png), [Salvar, 1440 px](antes/salvar-1440-antes.png), [Minha conta, 1440 px](antes/conta-1440-antes.png).

## Contrato de recuperação

- A captura usa o estado no momento de salvar, copiar ou exportar uma citação, incluindo digitação ainda pendente.
- Os esquemas do kit contribuem com parâmetros explícitos, inclusive os padrões em uso. Se o padrão de período mudar depois, o link continua pedindo o período original, quando disponível.
- Ilhas com a mesma chave respeitam a ordem das alterações por campo; uma cópia antiga não vence uma digitação recente pela ordem de montagem.
- Parâmetros alheios ao componente e a âncora são preservados. A captura não varre formulários nem coleta atributos de perfil.
- Campo vazio do tanque continua sem cálculo; não vira zero nem 40 litros. Nenhuma fórmula ou valor da fonte foi alterado.
- O recorte reaplica os parâmetros aos dados disponíveis ao reabrir. Salvar e Minha conta explicam essa condição. A citação conserva as fontes e identificadores já disponíveis no produto; não inventa versão histórica para domínios sem manifesto.

## Cobertura deste incremento

| Consulta | Parâmetros que passam a ser recuperados |
|---|---|
| `/combustiveis` e `/combustiveis/no-meu-estado` | Litros, junto da UF já persistida; entrada e resultado da consulta detalhada sincronizados. |
| `/custo-de-vida` | Fatias do orçamento do modelo de inflação, por grupo. |
| `/educacao-municipal` e suas consultas que usam o laboratório do Ideb | Aprendizagem e fluxo; cenários nacional e municipal têm chaves distintas. |
| `/contas-publicas-estaduais` | Despesa e entregas do cenário didático. |
| Versões públicas PT/EN de `/setor-eletrico/conta-de-luz` | Distribuidora, consumo e município com seus vínculos e ressalvas, recuperado no índice oficial. Esse índice usa nome e UF, sem código IBGE. |
| Ferramentas da conta nos painéis Next | Recorte atual ao salvar/copiar/citar; alternativa manual de cópia; foco ao abrir e fechar. |
| `/app/conta#recortes` | Copiar o link diretamente na lista; foco ao renomear/cancelar/apagar; caminho para começar no estado vazio. |

A melhoria da captura beneficia os controles que usam `useEstadoUrl`. Ela não converte automaticamente controles locais de outros laboratórios, nem a SPA legada do Crédito, em parâmetros de URL. Não há alegação de cobertura integral de todos os modelos didáticos da plataforma. Os modelos de Agro que informam manter parâmetros apenas no navegador exigem uma solução explícita de compartilhamento que preserve esse compromisso.

## Reprodução

```sh
bash scripts/preparar-sessao.sh
NODE_OPTIONS=--max-old-space-size=4096 npm run build
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium npx vitest run src/tests/analise-recuperavel.test.ts src/tests/analise-recuperavel-browser.test.ts src/tests/energia-comp-estado-url.test.ts
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/analise-recuperavel-verificacao.mjs --saida /tmp/analise-evidencias
```

Os testes de componente usam o hook e componentes reais em Vite; somente o leitor de pathname do Next recebe o endereço da fixture. O roteiro de integração usa `next start`, API e persistência reais em banco temporário. Não confundir o primeiro com prova de autenticação ou persistência.

## Verificações e revisão final

Resultados finais, capturas do build correspondente e parecer independente serão registrados após a execução das verificações obrigatórias. As imagens em `antes/` são exclusivamente a linha de base.

O carregador e o detector executável da Impeccable não estavam presentes no ambiente. Foram lidas as orientações disponíveis e realizada inspeção manual do código e das telas. Leitor de tela real e testes com usuários externos não fazem parte das provas já realizadas.

## Decisão de produto ainda necessária

Reabrir uma publicação antiga com os valores exatos exige definir armazenamento, retenção, acesso e comportamento diante de revisões da fonte. Esta entrega preserva consultas; não promete arquivamento histórico. A decisão é a segunda camada da recomendação 3 do conselho de 27/10/2026.
