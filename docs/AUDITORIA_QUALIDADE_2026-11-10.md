# Auditoria de qualidade independente

Branch atual contra `origin/main` (16 commits, 288 arquivos). Auditoria de 10/11/2026, sobre o código em HEAD (`6c68bf95`), o build existente em `.next`, as golds em `public/obs/data/gold` e as capturas de `docs/ux-2026-11-10`. Nenhum arquivo do repositório foi alterado.

## 1. Veredito

1. **Não está pronto para merge.** Há três defeitos que a própria rubrica da seção 10 manda reprovar: sobreposição ilegível de rótulos no primeiro gráfico do Consignado, uma afirmação que o número da mesma página desmente no Crédito imobiliário e estimativa exibida com o selo "Observado" no Desenrola.
2. **A fidelidade numérica é boa.** Em cerca de 60 números conferidos contra as golds nos nove painéis, não achei valor divergente. Os problemas são de rótulo, natureza, período e texto, não de conta.
3. **A decisão do dono sobre painel duplicado não está cumprida.** As nove vistas antigas seguem no ar, agora rotuladas como Economia, sem aviso nem redirecionamento, e a aplicação do Crédito ainda leva a elas.
4. **O "portfólio honesto" conta páginas com duas unidades diferentes**, e a navegação de Renda e trabalho tem dois itens "Emprego formal".
5. **Testes novos são, no geral, de invariante e passam** (132 de 132 nos 10 arquivos que rodei), mas não pegam nenhum dos defeitos acima, e parte das evidências está desatualizada em relação ao HEAD.

## 2. Achados

Gravidade: **B** bloqueia merge, **P** corrigir antes de produção, **M** melhoria.

### Bloqueiam merge

**1. [B] Rótulos de marcos sobrepostos e ilegíveis no primeiro gráfico de `/divida-das-familias/consignado`.**
- Evidência: `docs/ux-2026-11-10/integracao/divida_das_familias_consignado-1440-com-sessao.jpg`, y de 1230 a 1290. "Margem temporária de 40%" e "Margem cai para 40%, com redução programada" estão um sobre o outro; "Lei nº 15.179/2025" e "MP nº 1.292/2025" também, e cruzam a linha dos servidores públicos. Na captura de 390 px (y de 420 a 600) sete rótulos se empilham sobre as três séries e nenhum se lê.
- Mesma figura: o rótulo direto diz "Públicos" e a legenda "Servidores públicos".
- Regra: seção 10, "Reprovar enquanto houver [...] valor ilegível, sobreposição".
- Correção: numerar os marcos no gráfico e listar o texto abaixo, ou escalonar os rótulos; no celular, só o número. Unificar o nome da série.

**2. [B] `/credito-imobiliario` afirma "Um terço do saldo" e mostra 26,2% na mesma página.**
- Evidência: `public/obs/data/gold/moradia.json`, `concentracao_contabil.part_dessas = 26.23`, enquanto `concentracao_contabil.leitura` e `achados[3]` dizem "Um terço do saldo imobiliário do país está contabilizado em um ou dois municípios". O HTML do build (`.next/server/app/credito-imobiliario.html`) traz o título "Um terço do saldo está escriturado em um ou dois municípios" e, adiante, "26,2% do saldo está escriturado em um ou dois municípios [...] Um terço do saldo imobiliário do país...".
- O erro vem da gold e já existia na vista antiga, mas a página nova o promove a título de achado.
- Correção: gerar a frase do número (ou corrigir a gold) e acrescentar ao teste a regra "fração escrita por extenso confere com o campo numérico".

**3. [B] Estimativa com selo "Observado" na abertura de `/divida-das-familias/desenrola`.**
- Evidência: `src/app/divida-das-familias/desenrola/page.tsx:32` mapeia `reportado` para `OBSERVADO`. Em `desenrola.json`, `oficiais[0]` é "Público potencialmente elegível", 30 milhões, com a nota "Estimativa oficial de elegíveis à Faixa 1". A página exibe "30 milhões de pessoas · Natureza do dado: Observado".
- Mesmo problema, mais brando: "Pessoas beneficiadas pelo programa, 15 milhões" (declaração da SRE no relatório) e "5 milhões de pessoas (menos de)" saem como Observado.
- Regra: seção 1, "Tratar ausência, zero, estimativa, previsão e cenário como estados diferentes".
- Correção: natureza por item (ESTIMADO para elegíveis; "declarado pela fonte" para os demais) em vez de um mapa único do selo.

### Corrigir antes de produção

**4. [P] As nove vistas antigas seguem no ar como painéis da Economia, sem aviso e sem redirecionamento.**
- Evidência: captura que gerei, `/tmp/claude-0/-home-user-scrutiniums/9e7155bb-c719-55f4-b7ea-2732bc2ce43f/scratchpad/auditor/ev1/observatorio_bets_financial_risk-1440-com-sessao-primeira-tela.jpg`: `/observatorio/bets-financial-risk` responde 200 com o rótulo "Observatório da Economia · Crédito e sistema financeiro" e o título "Bets e risco financeiro". `src/lib/observatorios/reescritos.ts` tem `redirecionar: false` nos nove.
- Caminhos que ainda levam às vistas antigas: `src/lib/boletim.ts:134-135` (email do boletim aponta para `/observatorio/bets-financial-risk` e `/observatorio/financial-fraud`); `src/lib/credito/navegacao.ts:95-100` (`GRUPOS_CREDITO` ainda lista as nove, e `gruposDoMenu()` em `public/obs/app.js:13466` monta o "Início do painel" a partir dessa lista); pontes internas da aplicação (`app.js:9867`); a tabela "Fontes e atualidade" de `/observatorio/map` (links "Sanções e reclamações" e "Bancos cobrando na Justiça", vistos na captura `ev1/observatorio_map-1440-com-sessao.jpg`).
- Inferência: o leitor que entra pelo Crédito encontra o mesmo painel em dois observatórios, com títulos e formatos diferentes. É a situação que o dono reprovou em 10/11/2026.
- Correção: redirecionar depois da paridade no navegador ou, até lá, aviso "Este painel mudou para..." na vista antiga; tirar as nove de `GRUPOS_CREDITO`; corrigir o boletim.

**5. [P] "Clientes contra bancos na Justiça" promete o que a base não mede.**
- Evidência: `judicial.json`, `camada_nacional.assuntos`: os maiores assuntos "cíveis" são "Indenização por Dano Moral" (4,9 milhões de casos) e "Dano Material" (4,0 milhões), contra qualquer réu; a categoria "garantias_cobranca" é tipicamente movida pelo banco; a aba "Justiça do Trabalho" conta rescisão, FGTS e horas extras contra qualquer empregador. `page.tsx:92` rotula o número de abertura como "temas bancários cíveis" e `page.tsx:215` soma cível e trabalhista ("15 tribunais, 54,4 milhões de casos únicos").
- A ressalva existe (`page.tsx:155-156`), mas não está junto ao número; título, H1 e lead ("Processos sobre contratos bancários, indenizações e garantias em 15 tribunais") afirmam mais que o dado.
- Correção: renomear o recorte ("assuntos em que bancos costumam ser parte"), levar a ressalva para a nota do número, não somar os dois ramos e rever o nome do painel.

**6. [P] Dois itens "Emprego formal" na navegação da coleção Renda e trabalho.**
- Evidência: saída de `navegacaoDaColecao("renda")`: "Emprego formal → /eficiencia-estatal/trabalho-renda/emprego-formal" e "Emprego formal → /emprego-formal". Na porta aberta (`abertas/perguntas_familias-1440-sem-sessao.jpg`, y≈2680) o cartão diz "Emprego formal, Emprego formal nacional".
- Correção: tirar da navegação a página que virou cópia (`copias.ts:95` já a declara) ou dar nomes distintos pelo conteúdo.

**7. [P] "Portfólio honesto" conta "páginas" com unidades diferentes.**
- Evidência: `retratoDoPortfolio()` devolve Renda e trabalho com 2 páginas (a navegação tem 14 links), Justiça 2 (12 links), Segurança 2 (7), Saúde 2 (6), e Setor Elétrico 23, Saneamento 20. A home (`abertas/inicio-1440-sem-sessao.jpg`) publica "Famílias: 5 coleções · 17 páginas" ao lado de "Energia e Infraestrutura: 4 coleções · 58 páginas". Um painel da antiga Eficiência Estatal com 13 subpáginas vale 1; cada subrota do Setor Elétrico vale 1.
- Regra: anexo de componentes, "A unidade da contagem é a do dado".
- `portfolio-honesto.test.ts` confere que o retrato coincide com o mapa da conta, não que a unidade é a mesma entre coleções.
- Correção: contar endereços navegáveis em todas, ou chamar de "painéis" e dizer a regra.

**8. [P] Período das reclamações do consignado esconde um mês ausente.**
- Evidência: `consignado.json`, `reclamacoes.competencias` tem 11 meses, sem 2026-05; a página mostra "116.291 reclamações · out/2025 a set/2026" (`page.tsx:70` e número 3 da abertura), sem nota.
- Correção: "11 dos 12 meses; sem mai/2026" no período ou na nota.

**9. [P] Juízo de valor e afirmação sem suporte nos "achados" do Crédito imobiliário.**
- Evidência: `moradia.json`, `achados`: "É o crédito com menor inadimplência do país" (a página não compara com nenhuma outra modalidade; FGTS tem 1,72% e home equity 2,27% no mesmo `brasil.inad`), "apenas 8,7%", "quase nunca construção ou reforma".
- Correção: títulos descritivos com o número ("Inadimplência de 0,90% no SFH e 0,93% a taxas de mercado").

**10. [P] Unidade duplicada e rótulo impreciso nos números de abertura de Apostas e de Golpes.**
- Evidência: `integracao/divida_das_familias_apostas-1440-com-sessao-primeira-tela.jpg`: "R$ 37,0 bi R$ bilhões", "≈ R$ 164/mês R$ por apostador ao mês"; em Golpes, "9,3% % do valor contestado", "24% % da população 16+", "R$ 10,1 bi R$ bilhões em 2024". "Pessoas em autoexclusão" tem unidade "solicitações acumuladas" (`bets.json`, `sintese[3]`).
- Em Golpes, o primeiro número da página é grau D, de divulgação via imprensa, e o próprio conceito diz "sem nota técnica pública" enquanto o grau se chama "Estimativa privada com metodologia publicada". "24%" do DataSenado (pesquisa amostral) sai como "Observado".
- Caixa alta de ênfase vinda da gold ("Perda CONSUMADA", "TENTATIVAS", "PLAUSÍVEL", "SUBESTIMADO"); o teste do Desenrola a reprova, os de Apostas e Golpes não.
- Correção: não repetir a unidade quando `exibir` já a traz; rótulo "Solicitações de autoexclusão"; abrir Golpes por um número de grau A.

**11. [P] "Aplicados, não pagos" como unidade das multas em Sanções e reclamações.**
- Evidência: `sancoes-e-reclamacoes.txt` (HTML do build): "R$ 72,3 mi aplicados, não pagos". O dado (`conduta.json`, `bcb.janela_12m.multas_valor`) é valor aplicado; a situação de pagamento está em `cobranca_multas`. Lido ao pé da letra, afirma que não foram pagos.
- Correção: "aplicados" na unidade e "multa aplicada não é multa paga" na nota (que já existe).

**12. [P] Figura do Consignado mostra 17 municípios acima de 50% e a leitura guiada diz 159.**
- Evidência: figura "Quanto os benefícios pesam na renda dos municípios?": tabela "mais de 50%: 17" (4.110 municípios sem confiabilidade baixa) e "Como ler: Em 159 dos 5.570 municípios..." (`page.tsx:271`, `totais.dependencia_acima_50`). Os dois estão certos em universos diferentes; a página não diz que 142 dos 159 foram rebaixados.
- Correção: uma frase ligando os dois números.

**13. [P] Tabelas cortadas no celular sem indicação de rolagem, no Consignado.**
- Evidência: `integracao/divida_das_familias_consignado-390-com-sessao.jpg`, y≈2600 a 3000 ("Juros c / nova / operaçõe", "não es / nes / bas") e y≈5150 a 5500 ("Parte da populaçã"). A tabela de Bancos cobrando traz o aviso "A tabela é mais larga que a tela"; estas não.
- Correção: o mesmo aviso e a sombra de rolagem em toda tabela do kit.

**14. [P] Evidências de `docs/ux-2026-11-10/minha-cidade` e `divida-das-familias` são anteriores à fusão.**
- Evidência: capturas dos commits `daf42390` e `14017fac` (02h17 e 07h04); a fusão é de `be4a178b` (08h38). A captura mostra "FOGO E QUEIMADAS", "GÁS NATURAL", "COMBUSTÍVEIS"; o código atual (`src/lib/lugar/ficha.ts:84-190`) escreve `nomeDaColecao(...)`.
- Consequência no HEAD (inferência pelo código): "Mobilidade e conectividade" sobre "Quanta internet fixa a cidade tem?", "Educação e cultura" sobre o Ideb, "Fogo e desastres" sobre focos de calor. Rótulo mais largo que o conteúdo do cartão. "cinco coleções" está escrito à mão em `minha-cidade/page.tsx:44`.
- Correção: refazer as capturas; no cartão, usar o nome da parte (`ALCANCE_DA_DATA` já tem "Conectividade", "Educação", "Queimadas").

### Melhorias

**15. [M] Faixa de gravura do "Para ir além" não aparece em nenhuma captura.** Em todas (`integracao/*`, e na que gerei de `/gas-natural/gas-de-cozinha`) há uma barra escura vazia de 96 px (64 no celular) acima do bloco. Causa provável: `loading="lazy"` em `ParaIrAlem.tsx:58` com captura de página inteira. Não consegui confirmar que a imagem carrega ao rolar. Mesmo carregando, é um recorte de 13% da altura de uma ilustração, `aria-hidden`, em toda página de coleção: decoração sem função pela seção 10. Sugestão: decisão do dono com captura real, ou retirar.

**16. [M] Rótulos da fusão.** Procedem, sem gravidade isolada: (a) a porta de "Mobilidade e conectividade" é o painel de internet, e dentro dela há "Energia e conectividade"; (b) páginas de gás levam o título de aba "· Gás e combustíveis" e o método do gás passou a dizer "A coleção Gás e combustíveis apresenta..." (`src/app/gas-natural/metodologia/page.tsx`), sem eu ter confirmado que cobre combustíveis; (c) "Fogo e desastres" e "Educação e cultura" abrem em páginas que tratam só da primeira metade do nome; (d) o texto da parceria na home ainda lista "Gás Natural [...] e Combustíveis"; (e) a entrada das Famílias cita "Eficiência Estatal" e "Gás Natural" no lead; (f) na porta, "vem de Famílias e Eficiência Estatal" dentro do próprio Observatório das Famílias; (g) domínio `gas` renomeado afeta rótulos de frescor e telemetria. Não tive acesso à lista de sete pontos do agente da fusão; estes são os que encontrei.

**17. [M] Números escritos à mão nas páginas novas.** `apostas/page.tsx:631`: "salta de cerca de 2% para cerca de 12%" (em `epae.json`, 2024 = 1,9%, 2025 = 11,8%, mas 2026 = 8,8% e set/2026 = 6,7%; o texto omite a queda, e "a partir de janeiro de 2025 passa a absorver saldo" ignora out e nov/2024, já positivos). `apostas/page.tsx:351`: "132 processos, cerca de 550 contas" (declarado na paridade). `apostas/page.tsx:443`: "7% a 17%". `consignado/page.tsx:275`: "11,1% dos beneficiários".

**18. [M] Promessas das portas não conferem com o destino.** "Os aposentados estão mais endividados? Crédito consignado por idade, benefício e instituição" leva a uma página que não tem consignado por idade e declara não responder à pergunta. "Golpes [...] com fonte primária" leva a uma página cujo primeiro número é de imprensa.

**19. [M] Páginas muito longas.** Apostas: 17.069 px a 1440 e 30.309 a 390; Desenrola: 16.922 e 29.771; Consignado: 14.537 e 23.944; Crédito imobiliário: 13.618 e 23.371. Não há orçamento de comprimento para painel, mas 30 mil px no celular pede recolhimento.

**20. [M] Inconsistências de acabamento.** Apostas e os dois painéis da Justiça não mostram o rótulo "Dívida e crédito das famílias" acima do H1 (Consignado e Emprego mostram). "Golpes e fraud" aparece cortado na linha de navegação a 1440. `/arte` foi aberto por prefixo (`rotasPublicas.ts:46`): hoje só há seis `.webp`, mas qualquer arquivo futuro na pasta nasce público; a regra `ARTE` vizinha é por expressão exata.

**21. [M] `docs/familias/PARIDADE.md`.** As tabelas que conferi (Emprego, Apostas, Cobrança) correspondem ao código antigo e são francas sobre o não migrado. Números de linha de `app.js` estão defasados (por exemplo, `renderBets` "7700 a 8123", real 7774). A própria tabela do Emprego diz "a página não foi vista no navegador". Pendência aberta: pesos do score do Risco setorial (0,15 / 0,19 / 0,56 / 0,25) não migrados.

**22. [M] Teste do `outputFileTracingIncludes` é espelho.** `lugar.test.ts:107-116` confere que o `next.config.mjs` contém uma lista escrita no próprio teste, não o que `ficha.ts` lê. Pela leitura do código a lista cobre as leituras; um teste que interceptasse `readFileSync` provaria.

## 3. Conferido e certo

- **Consignado:** 2,28%, 10,84%, 116.291, R$ 798,2 bi, 280,9 / 393,2 / 124,1, 23,22%, 23,57%, 92,6 meses, R$ 159,6 bi, 19,5%, pirâmide etária, 41,64 mi, R$ 74,2 bi, R$ 1.782, 129,7, 18,7%, 159, 843, 3.156 conferem com `consignado.json`.
- **Desenrola:** 2.682.020, R$ 4,51 bi, R$ 1.682, 11,7 vezes, 26,4% e 708.832 (SP), 15,4 por mil, 21,9% (Caixa), 59 grupos, 37 datas-base conferem.
- **Apostas e Golpes:** os oito itens de cada síntese saem de `bets.json` e `fraudes.json` sem alteração de valor, período ou fonte.
- **Bancos cobrando:** 819.641, 1.777.239, 14,7%, 9,1%, 46%, 3,84, 105,7 conferem com `cobranca.json`.
- **Sanções:** 1.301, 1.370, R$ 72,3 mi, 1.312, mediana e p90 de R$ 25.000, 3, 51, 151, 398 e 972 conferem com `conduta.json`.
- **Emprego:** 48.244.696, +165.827, +77.659, +887.708, +1.451.367, +1,88%, 2.294.563, 2.128.736, 53%, 2,38% conferem com `emprego.json`.
- **Crédito imobiliário:** 72,46 mi, 8,7%, 22,2%, R$ 3,09 tri, 13,85%, 65,7%, 666,6 / 602,3 / 156,5 / 27,0 conferem com `moradia.json`.
- **Acesso:** as dez rotas novas e `/app/minha-cidade` exigem conta (`ehRotaPublica` devolve falso); as golds municipais seguem fechadas; `/arte` hoje só expõe as seis gravuras.
- **Links:** 144 destinos internos das páginas novas resolvem em rota existente; nenhum link renderizado aponta para vista antiga; a busca traz as páginas novas e não as antigas.
- **Texto:** nenhum travessão no HTML das oito páginas estáticas.
- **Testes:** nenhum teste existente foi afrouxado sem motivo; as mudanças acompanham a fusão (28 para 24) e a saída das vistas do registro. Um caso foi substituído, com justificativa no comentário.
- **Leitor de gold:** `src/lib/gold` só é importado pelo teste; com a chave ausente nada muda.
- **`outputFileTracingIncludes`:** cobre o que `ficha.ts`, `clientes-contra-bancos.ts` e `bancos-cobrando-na-justica.ts` leem (por leitura do código e pelo `.nft.json` do build).

## 4. Não conferido

- Não rodei a suíte inteira, nem build, nem `verificar:pr`.
- Os painéis dinâmicos (Clientes contra bancos, Bancos cobrando) só foram conferidos por código e captura, não pelo HTML servido; o recorte `?ramo=trabalhista` e os de `?classe=` e `?medida=` não foram abertos.
- Interações de cliente: explorador municipal do Consignado (arquivo de 8 MB sob demanda), simulador de prestação, consulta municipal do Crédito imobiliário, mapa por UF do Desenrola, downloads CSV.
- Paridade de Consignado, Desenrola, Golpes, Sanções e Crédito imobiliário bloco a bloco contra `app.js`; conferi em detalhe Emprego e, por amostra, Apostas e Cobrança.
- Se a faixa de gravura do "Para ir além" carrega no navegador real.
- Ficha "Minha cidade" no estado atual do código (capturas são anteriores à fusão); teclado, leitor de tela e zoom de 200%.
- Recorte geográfico nos títulos da antiga Eficiência Estatal: os testes passam, mas não abri as páginas.
- Tamanho das funções em produção: o `.nft.json` local lista cerca de 730 MB por página, inclusive em páginas antigas, o que contradiz a frase "cada função leva só os seus" de `docs/DADOS_FORA_DO_DEPLOY.md`; não sei se o empacotamento da Vercel reproduz isso. Não é regressão desta branch.
- A lista de sete pontos do agente da fusão não estava nos arquivos que li.
