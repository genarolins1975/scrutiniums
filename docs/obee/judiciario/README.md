# Judiciário brasileiro — OBEE

Rota canônica: `/eficiencia-estatal/judiciario`. Entrada, panorama, seis capítulos (recursos, tempo, filas, entrega, acesso e comparação), métodos e 57 fichas. Integração no mapa do OBEE, vitrine da home e capítulo existente de Acesso à Justiça. Painéis e downloads exigem sessão; método segue a exceção pública já existente no projeto.

## Cobertura implementada

- Justiça Estadual, Federal e do Trabalho: casos novos, baixados, pendentes, idade média dos pendentes por fase, centros de solução de conflitos, despesa e IAD/congestionamento oficiais em 2025.
- 27 TJs, 6 TRFs e 24 TRTs: duração média dos baixados, idade média dos pendentes, congestionamento bruto e IPC-Jus oficial. TJs/TRTs também têm porte, despesa, casos novos/pendentes e contagens de magistrados/servidores nas tabelas da edição.
- Despesa real: 2009–2025, 17 anos, referência nacional e três ramos separadamente, com ajuste IPCA já publicado pelo CNJ. A série nominal histórica não está no relatório; modo nominal mostra somente 2025, sem reconstruir os demais anos.
- Composição nacional do pessoal em cinco rubricas, separada da despesa restante; nenhuma rubrica interna é novamente somada ao total.
- Conciliação nacional: série publicada de 2015–2025. Homologação e baixa não são tratadas como cumprimento do direito.
- Comparador: até três tribunais do mesmo ramo e porte selecionado, referências recalculadas, distribuição completa dos pares elegíveis, contexto financeiro e IPC-Jus, tabela e CSV. Sem ordenação geral entre ramos nem escore próprio.
- Jornada interativa conceitual, sem sequência universal ou funil quantitativo. Acesso reutiliza a base existente de Defensorias/comarcas, preservando URLs.

## Fonte e precisão

CNJ, Justiça em Números 2026, ano-base 2025. O PDF integral foi obtido da Biblioteca Digital em **17/10/2026**, com SHA-256 `7aafbf664cbd3edadf46492151988468e154fe9cb131b460fe7dde335c3dca19`, idêntico ao original identificado no capítulo anterior. O portal principal retorna 403 do CloudFront; isso impede confirmar a edição/revisão mais recente, mas não a conferência do original utilizado. O painel financeiro adicional ainda teve acesso negado pela política de rede.

A captura ampliada preserva texto de 39 páginas e, nos gráficos financeiros, os rótulos com coordenadas de extração. O original de 25 MB é referenciado por URL e hash; não entra no bundle ou no carregamento da página. Sementes e saídas têm hashes verificados. Não há microdados ou identificadores pessoais.

Localizadores: tabelas 1/2, p. 40–41; despesa por ramo, figura 30/p. 64; finanças p. 62–71, 110–118, 132–139, 157–165; tempos p. 24, 333, 397 e 459; desempenho p. 310–313, 383–384 e 438–440; IPC-Jus p. 351–353, 407 e 473; conciliação p. 232–234. Dicionário completo em `src/lib/eficiencia/judiciario/indicadores.ts`, apresentado na página de métodos.

**Distinções necessárias:**

- Volumes do sumário têm precisão de 0,1 milhão. A conversão para processos não cria precisão adicional. A razão derivada desses volumes é aproximada, separada do IAD oficial, que não é reconstituído do sumário.
- Tempos são médias publicadas, convertidas para meses. A mediana das médias dos pares não é mediana dos processos. Médias nacionais não são reponderadas sem denominadores.
- Os três ramos não são o total do Judiciário. A referência financeira nacional mantém os seis segmentos da figura 30; não se soma o STF de uma seção diferente.
- IPC-Jus é o indicador oficial, sem reprodução de DEA/SFA pela Scrutiniums. O Federal é consolidado das áreas judiciárias por seção e grau; não comparar percentuais entre ramos nem convertê-los em qualidade jurídica.
- Financeiro histórico: os rótulos da fonte têm resolução de R$ 100 milhões. O CNJ informa IPCA e base 2025, mas o trecho não explicita mês-base versus média anual; não inventamos essa convenção nem recalculamos o ajuste.
- Categoria de despesa é a publicada pelo CNJ; não houve reconciliação independente do estágio contábil com SIAFI/Siconfi nem dedução de receitas.
- TJs conciliam exatamente em despesa. TRTs somam R$ 27.664.994.118, enquanto a figura do ramo publica R$ 27.664.994.120. O resíduo de R$ 2 permanece explícito; tolerância máxima de R$ 12,50 decorre de R$ 0,50 para cada uma das 24 parcelas e o total, apresentados em reais inteiros. Nenhuma parcela foi ajustada.
- A nota de variações/pessoal do sumário p. 22 menciona outros anos; essas variações e as contagens de pessoal do sumário não são usadas. As contagens institucionais empregadas vêm das tabelas com ano-base declarado.

## Reprodução e atualização

```bash
# Sem rede, a partir de sementes verificadas:
python3 -m pipeline.judiciario.run
python3 -m pipeline.judiciario.run --check
python3 -m unittest pipeline.tests.test_judiciario

# Nova captura do mesmo original fixado (requer pdftotext):
python3 -m pipeline.judiciario.capturar --baixar
# Ou arquivo já baixado, sempre conferindo o hash do PDF:
python3 -m pipeline.judiciario.capturar --pdf /caminho/relatorio.pdf
```

Timeout, limite de 40 MiB e no máximo três tentativas para erros transitórios; erros permanentes não são repetidos. A captura valida a origem antes de escrever a semente; o extrator valida estruturas, duplicatas, unidades, ramos e reconciliações antes de promover arquivos. Uma falha de validação preserva a publicação anterior; não zera indicadores. Arquivos são preparados em diretório temporário e o snapshot é promovido por último. Não se promete transação atômica entre múltiplos arquivos diante de interrupção de I/O: repetir reprodução e `--check` recupera a consistência.

A captura é específica da edição, não um coletor genérico que presume que figuras/páginas nunca mudam. Uma edição/revisão nova requer localizar os dados oficiais, preservar original/localizadores e hashes, revisar contratos e quebras e reconciliar os valores. Não basta trocar um hash para aceitar artefato não verificado. Atualização anual e revisões extraordinárias devem manter registro explícito. Build é offline; não há cron que finja atualizar a fonte nem coleta nacional do DataJud.

## Verificação funcional e visual

```bash
npm run lint
npx --no-install tsc --noEmit
npx --no-install vitest run --maxWorkers=2
npm run build
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/obee/judiciario-verificacao.mjs
```

O script de navegador usa build de produção, PGlite e sessão exclusivamente locais, porta efêmera e conta de fixture; remove o banco ao terminar. Testa os três ramos, quatro larguras, URLs, histórico, seleção incompatível, ausência, tabelas, exportações e autenticação. Artefatos em `/tmp/judiciario-qa`, ou no diretório definido por `JUDICIARIO_QA_DIR`. Não usa credenciais reais e não publica fixtures. Leitor de tela e zoom nativo não são substituídos por axe/reflow; evidências e limitações constam em `VALIDACAO.md`.

## Incompletudes materiais

| Item da especificação | Limite atual |
|---|---|
| Histórico próprio por tribunal | Apenas 2025 por tribunal. Histórico financeiro de ramo não é apresentado como histórico do tribunal. |
| Despesa individual por TRF | Não está nas tabelas utilizadas; não distribuímos o agregado federal. |
| Nominal histórico e convenção detalhada do IPCA | Só nominal de 2025; série real reproduzida da edição com ressalva temporal. |
| Custeio/investimento/tecnologia completos | Pessoal tem composição; o restante não é classificado artificialmente nessas categorias. |
| População/jurisdições e unidades | Sem novo mapa ou despesa/demanda por habitante; a base de Defensorias existente permanece separada. |
| Grau, assuntos, coortes e percentis | Não há eventos individuais integrados; médias mantêm o universo da fonte. |
| Cumprimento e satisfação do direito | Não mensuráveis nas bases utilizadas; sem nota de qualidade com recursos/reformas. |
| Metas oficiais e carga de trabalho | Não calculadas sem contratos e vigência adequados. |
| Produção | Estado real, SHA, PR e verificação registrados em `VALIDACAO.md` e na resposta final. |

A entrega cobre os três ramos com dados reais, sem representar esta lista como atendimento integral da especificação. Próxima melhoria estrutural: base histórica estruturada por tribunal, com controle de revisões, graus, fases e mudanças institucionais como a criação do TRF6.
