# Avaliação independente de dados e método: Saúde nas capitais (OBEE), rodada 1

## 1. Identificação e natureza

| Item | Registro |
| --- | --- |
| Avaliador | Avaliador independente de dados e método, agente Claude (Claude Code, modelo Sonnet 5.5), contexto limpo, sem participação na construção do módulo |
| Data e ambiente | 09/10/2026; repositório em `/home/user/scrutiniums`, branch `claude/determined-knuth-21z58z`; produção local em `http://localhost:3111` (não reconstruída nem encerrada) |
| Critérios | E (indicadores, referências e comparabilidade), F (rigor metodológico), G (rastreabilidade e reprodutibilidade) e K (confiabilidade técnica e desempenho), nas sete rotas: entrada, Panorama, Gastos, Rede e atenção primária, Atendimento e resultados, Comparar capitais, Dados e métodos |
| O que li | `RUBRICA.md`; código de `src/`, `pipeline/eficiencia_saude/`, `pipeline/eficiencia/` (apenas para localizar entradas e entender regras), testes, gold, séries CSV, seed, catálogo e os seis documentos de `docs/obee/saude/` como material sob avaliação |
| O que não li | `MATRIZ_DE_AVALIACAO.md`, relatórios de outras rodadas ou de outros avaliadores, `git log`, `git diff`, `git show`. Durante a rodada apareceram capturas PNG de outro avaliador na pasta `evidencias/`; não as abri. Os arquivos que gerei têm o prefixo `dados_` |
| Natureza | Inspeção heurística feita por um agente. Não há participantes, tempos, taxas de sucesso humano nem validação por especialistas. O que não pude conferir está marcado como "não verificado" e não sustenta nota alta |
| Regra de nota | Escala da rubrica. Nenhuma nota chega a 9,5, porque não houve validação adicional por pessoas ou especialistas |
| Alterações | Nenhuma em `src/`, `scripts/`, `public/`, `pipeline/`, testes ou docs fora desta pasta. A reconstrução do pipeline foi feita em cópia temporária fora do repositório |

## 2. Resultado em uma linha

**Não aprovado.** Os dados de origem foram reproduzidos sem divergência (8.110 de 8.135 checagens iguais; as 25 restantes são explicadas), mas há 4 bloqueios de aprovação (razão agregada exibida em escala errada em 7 de 8 medidas, composição agregada por subfunção com 1 a 6 capitais, afirmação causal sem suporte e quebra de base populacional não sinalizada na cobertura potencial). Médias por critério: E 7,4; F 7,5; G 7,9; K 7,4. Nenhuma página atinge 9,0 nos quatro critérios; a maior nota por critério é 8,5 (E), 8,4 (F), 8,7 (G) e 9,0 (K, só na entrada).

## 3. Matriz de notas

Avaliador: avaliador independente de dados e método (agente Claude, contexto limpo). Meta do executor: mínimo 9,0 em cada critério e página. Os arquivos de evidência estão em `evidencias/` desta pasta; `código:linha` aponta para o repositório.

| Página | Critério | Nota | Justificativa | Evidência | Correção necessária |
| --- | --- | --- | --- | --- | --- |
| Panorama | E | 8,5 | Mediana, n ("25 de 26" em despesa por habitante), menor e maior com nomes e empates, faixa central só quando n é 8 ou mais. Todas as medianas e n do Panorama iguais à gold. Limita: uma referência numérica por medida, sem série própria nem referência nacional. Não é menor porque as 900 referências da gold reproduzem em recomputação | `dados_consistencia_superficies.csv`; 900 de 900 grupos de referência recalculados | Mostrar a referência nacional onde existe (cobertura APS, ICSAP) ou registrar que não se aplica |
| Panorama | F | 8,3 | Três perímetros separados, rótulos fiéis (despesa do município, capacidade teórica, cadastro, residência), exclusões Campo Grande 2021 e Macapá 2025 tratadas. Limita: ASPS aparece como "exercício 2025" sem dizer que usa o estágio empenhado; "UBS públicas" exclui UBS de gestão municipal operadas por entidades não públicas (P9) | `dados_asps_estagio_empenhado_vs_liquidado.csv`; P7, P9 | Dizer o estágio do ASPS na definição curta; explicitar o recorte de natureza das UBS |
| Panorama | G | 8,0 | Cada medida abre a ficha de 16 campos com fonte, captura e validações; os números do Panorama reproduzem do seed e das APIs oficiais. Limita: sem exportação nem passo de reprodução na própria página; sem URL do repositório | `dados_conferencia_fonte_original.csv`; P12 | Link para Dados e métodos junto de cada medida e URL pública do repositório ou do seed |
| Panorama | K | 8,8 | Sem erro de console, LCP 76 a 208 ms, CLS no máximo 0,0007, sem rolagem horizontal em 320, 390, 768 e 1440 px, valores iguais à gold. Limita: os testes não cobrem a renderização das referências nem o texto público (P1 a P4 passaram despercebidos nas outras páginas) | `dados_desempenho_laboratorio.csv`; `dados_peso_das_paginas_1440.csv` | Testes de interface sobre referências exibidas |
| Gastos | E | 6,5 | Referências completas (mediana, média simples, quartis, empates, grupo por região, mínimo legal de 15% como norma). Reduzem a nota: razão agregada do ASPS exibida como "0,2%" quando é 21,8% (P1); composição agregada por subfunção que usa 1 a 6 capitais sob o rótulo "capitais com valor comparável" (P2); composições agregadas de natureza e fonte sem n (P11) | `dados_razao_agregada_exibida_vs_correta.csv`; `dados_composicao_subfuncao_agregada_n.csv` | Corrigir P1, P2 e P11 |
| Gastos | F | 7,0 | Rigor forte onde importa: DCA liquidada, IPCA explícito, conferência DCA, RREO e MSC, natureza só quando reconcilia, população de 2021 e 2023 com quebra. Limita: ASPS no estágio empenhado ao lado de despesa liquidada sem aviso no topo, com ASPS acima da despesa da função em Vitória 2021 e 2022 (P7); notas de natureza que descrevem MSC vazia como "R$ 0,00" (P6); agregado enganoso (P2) | `dados_recomputacao_universo_resumo.csv`; `dados_asps_estagio_empenhado_vs_liquidado.csv` | Corrigir P2, P6, P7 |
| Gastos | G | 7,8 | Registro de origem, numerador e denominador por linha, hash e versão nas séries; reproduzi 100% dos valores de despesa, subfunção, ASPS e população. Limita: o exemplo de ASPS do documento não fecha no centésimo (P13); "Fonte" do CSV exportado traz identificadores internos; razão agregada sem unidade nem entrada no dicionário (P14) | `dados_recomputacao_amostra.csv`; P8, P13, P14 | Completar dicionário e fonte legível nos CSV; corrigir exemplo |
| Gastos | K | 6,0 | Desempenho excelente, mas há valor exibido incorreto (razão agregada do ASPS) e agregado enganoso na tela padrão (sem capital). Os 130 pares de despesa, subfunção e ASPS conferem com a fonte | `dados_razao_agregada_exibida_vs_correta.csv` | Corrigir P1 e P2 e cobrir com teste |
| Rede e APS | E | 6,0 | Razão agregada errada nas quatro medidas ("0,00" para UBS, eSF e eAP; "0,7%" para cobertura) (P1). Cobertura potencial exibida em série com salto de denominador entre dez/2022 e dez/2023 sem aviso (P4). Pontos fortes: referência nacional de mesma fórmula para cobertura (Brasil, Relatório APS), n, empates | `dados_razao_agregada_exibida_vs_correta.csv`; `dados_cobertura_potencial_quebra_de_populacao.csv` | Corrigir P1 e P4 |
| Rede e APS | F | 6,5 | Cobertura apresentada como capacidade teórica, sem teto de 100%, eSF e eAP separadas, viés de série das UBS declarado. Limita: quebra de base da população do Ministério não tratada (P4); UBS por natureza pública exclui 125 UBS de gestão municipal operadas por entidades não públicas (52 no Rio de Janeiro, 38 em São Paulo) (P9) | idem; P9 | Corrigir P4 e P9 |
| Rede e APS | G | 7,8 | Retrato do CNES reproduzido do arquivo original (sha256 igual ao manifesto; 364 de 364 contagens iguais) e série de dezembro amostrada na API (8 de 8 estabelecimentos iguais). Limita: P12 e P14; texto da matriz diz que a API é igual ao retrato nas 26 capitais, mas 5 diferem (P17) | `dados_conferencia_fonte_original.csv` | Corrigir texto E01; P12 |
| Rede e APS | K | 5,5 | Quatro valores de razão agregada incorretos na mesma página e salto de denominador não sinalizado; desempenho e acessibilidade técnica sem falha. Menor que 6,0 porque o erro atinge todas as medidas da página | `dados_razao_agregada_exibida_vs_correta.csv` | Corrigir P1 e P4; testes |
| Atendimento e resultados | E | 6,5 | Boas referências externas (Brasil e Brasil sem as 26 capitais, calculadas do mesmo arquivo RIPSA, conferidas por mim: 1.026,03 e 1.095,40 em 2024). Reduzem: razão agregada "0" para a taxa (correto 776,1) e "0,1%" para a participação (correto 14,4%), o que esconde o comparador equivalente do Brasil (P1); razão 1,07 a 2,79 sem fonte reproduzível (P5) | `dados_razao_agregada_exibida_vs_correta.csv`; `dados_conferencia_fonte_original.csv` | Corrigir P1 e P5 |
| Atendimento e resultados | F | 6,8 | ICSAP por residência, taxa bruta, AIH como unidade, duas populações publicadas, nenhuma razão despesa por atendimento. Reduzem: sentença causal sobre planos privados, contrariada pelos dados do módulo (P3); razão por local de internação sem fonte (P5); escopo de COB.2.01 como denominador da participação não verificado | `dados_planos_privados_vs_icsap_correlacao.csv` | Corrigir P3 e P5; verificar escopo de COB.2.01 |
| Atendimento e resultados | G | 7,5 | ICSAP de São Paulo 2024 reproduz do documento e do CSV (83.391 e 11.895.578 dão 701,03) e todos os 104 pares reproduzem do arquivo RIPSA baixado. Limita: números de verificação independente (SIH espelhado, 1,07 a 2,79) não reproduzíveis com o que está no repositório (P5); soma por sexo e faixa etária só no manifesto | `dados_conferencia_fonte_original.csv` | Incluir ou apontar a fonte dos números do espelho, ou retirá-los |
| Atendimento e resultados | K | 6,0 | Valores de ICSAP corretos; razão agregada incorreta na página e frase causal; desempenho sem falhas | `dados_razao_agregada_exibida_vs_correta.csv` | Corrigir P1 e P3 |
| Comparar capitais | E | 8,0 | Mesma mediana e mesmo n na página, no CSV da medida e no CSV da tabela (valores das 26 capitais iguais à gold) em 10 recortes da própria página (despesa por habitante, ASPS, UBS, ICSAP, eSF e cobertura, em 1 ou 2 anos); Campo Grande 2021 e Macapá 2025 marcados "não" nas superfícies. Limita: sem razão agregada nem referência nacional; diferenças em medidas percentuais ambíguas (P10); colunas de períodos diferentes sob um só "ano" (P15) | `dados_consistencia_comparar.csv`; `dados_consistencia_superficies.csv` | Corrigir P10 e P15 |
| Comparar capitais | F | 7,5 | Elegibilidade única para as superfícies. Limita: "3,3% a mais ... (17% maior, em valor)" mistura ponto percentual e variação relativa; tabela alinha exercício, dezembro e ano de processamento sem rotular o tipo de período | `dados_consistencia_superficies.csv`; P10, P15 | Corrigir P10 e P15 |
| Comparar capitais | G | 7,0 | CSV da medida traz "Fonte" com identificadores internos e sem data, versão ou hash; CSV da tabela não traz fonte, nota, ressalva nem tipo de período; convenção decimal mista (texto "R$ 1.087" e número `1087.484542` em arquivo com ponto e vírgula). Não é menor porque os valores são exatos e a exclusão aparece em cada linha | `dados_consistencia_superficies.csv`; P8 | Acrescentar fonte legível, data de captura, versão, hash e ressalvas aos dois CSV |
| Comparar capitais | K | 8,0 | Valores consistentes, sem erro de console, LCP 120 a 156 ms. Limita: rótulo "Exercício 2025 não coberto" aplicado a ICSAP (ano de processamento) no CSV; testes não cobrem o CSV da tabela | `dados_desempenho_laboratorio.csv`; P8 | Rótulo por tipo de período; teste do CSV da tabela |
| Dados e métodos | E | 8,0 | Fichas trazem comparação por indicador e a matriz de fontes explica cada decisão. Limita: a página não apresenta a política de referências (mediana, quartis tipo 7, limiar de 8, razão agregada, empates), que só está no JSON | `politica_referencias` da gold; P16 | Seção curta com a política de referências |
| Dados e métodos | F | 8,2 | 20 validações; reproduzi com código próprio S02, S05, S06, S07, S09, S10, S11, S13, S15, M01, M03 e M04 e os resultados conferem. Limita: afirmações incoerentes (E01 versus M03; R05 sem fonte; exemplo de ASPS) | `dados_recomputacao_universo_resumo.csv`; P5, P13, P17 | Corrigir P5, P13, P17 |
| Dados e métodos | G | 8,3 | Melhor página do critério: manifesto com URL, data e sha256 (originais de RIPSA e CNES baixados de novo têm o hash do manifesto); reconstrução em cópia temporária reproduz `hash_dados` f111efb2ef09c540; 24 downloads servidos. Limita: sem URL do repositório; hash dos 681 recortes é do conteúdo descomprimido e `sha256sum` do arquivo diverge; receita do `hash_dados` não documentada; `versao_codigo` da gold não corresponde ao código atual (P18); contagens do documento erradas (P19); trilhas com valores crus (P20) | `dados_conferencia_fonte_original.csv`; P12, P18, P19, P20 | Corrigir P12, P18, P19, P20 |
| Dados e métodos | K | 8,7 | Página estática correta, links 200, sem console, LCP 160 a 184 ms; conteúdo das validações confere com meu recálculo. Limita: contém E01 incorreto (P17) | `dados_desempenho_laboratorio.csv` | Corrigir P17 |
| Entrada `/eficiencia-estatal` | E | 8,5 | Universo (26 capitais), exclusão do DF e escopo de cada tema declarados; sem comparações numéricas. Aplicação adaptada: clareza do universo e do que não se inclui | leitura da página renderizada; `dados_peso_das_paginas_1440.csv` | Nenhuma obrigatória |
| Entrada `/eficiencia-estatal` | F | 8,4 | Escopo fiel aos três perímetros. Limita: diz que filas foram "avaliadas e não publicadas, com o motivo", mas a matriz registra R07 "não pesquisado nesta rodada" (P17) | P17 | Ajustar o texto |
| Entrada `/eficiencia-estatal` | G | 8,7 | Cada tema leva a Dados e métodos e mostra a data da última captura; correspondência com o módulo de origem verificada (links 200). Sem lista de fontes na própria entrada | links verificados | Opcional: lista curta de fontes por tema |
| Entrada `/eficiencia-estatal` | K | 9,0 | Estática, 7,5 KB transferidos, LCP 76 a 112 ms, CLS 0, sem erro, sem rolagem horizontal, links válidos. Não é maior por não haver validação adicional | `dados_desempenho_laboratorio.csv` | Nenhuma obrigatória |

Médias por critério: E 7,43; F 7,53; G 7,87; K 7,43. Média por página: Panorama 8,40; Gastos 6,83; Rede e APS 6,45; Atendimento e resultados 6,70; Comparar 7,62; Dados e métodos 8,30; Entrada 8,65. Menor nota por página: Panorama 8,0; Gastos 6,0; Rede 5,5; Resultados 6,0; Comparar 7,0; Métodos 8,0; Entrada 8,4.

## 4. Bloqueios de aprovação encontrados

| # | Bloqueio da rubrica | Fundamento (resumo; detalhe em P1 a P4) |
| --- | --- | --- |
| B1 | Valor incorreto | A "razão agregada" está em escala errada em 7 das 8 medidas que a exibem: "0,00" para eSF, eAP e UBS por 10 mil, "0" para a taxa de ICSAP, "0,2%" para ASPS, "0,1%" para participação, "0,7%" para cobertura. Valores corretos: 1,89; 0,29; 0,66; 776,1; 21,8%; 14,4%; 72,6% (`dados_razao_agregada_exibida_vs_correta.csv`). Só a despesa por habitante está certa |
| B2 | Comparação materialmente incompatível e ressalva essencial pouco visível | A composição agregada por subfunção, tela padrão de Gastos, rotulada "soma das capitais com valor comparável", usa 1 capital em 2021 e 2022 (Natal), 3 em 2023 e 2025 e 6 em 2024, enquanto 25 ou 26 capitais são elegíveis. A contagem só aparece em nota de 12 px ("Soma das despesas de 1 capitais") |
| B3 | Afirmação causal sem suporte | "Capitais com mais beneficiários de planos têm menos internações pagas pelo SUS por habitante por esse motivo" (página de Resultados e ficha da taxa de ICSAP). Nos dados do próprio módulo a correlação de postos entre cobertura de planos e taxa de ICSAP nas 26 capitais é positiva ou quase nula (0,13; 0,18; 0,10; 0,07 de 2021 a 2024) |
| B4 | Comparação materialmente incompatível | A cobertura potencial usa como denominador a população de referência do Ministério, que passa de estimativa pré Censo (dez/2022, ano base 2021) para Censo 2022 (dez/2023). A população cai em mediana 8,5% (de 16,6% de queda a 4,4% de alta). A mediana de cobertura vai de 62,2% a 76,9% e 9,1 dos 14,6 pontos percentuais decorrem só do denominador. A interface só marca 2021 como quebra e apresenta "de 53,0% em 2022 para 59,5% em 2025" para São Paulo, sem aviso, enquanto bloqueia o mesmo tipo de quebra nas medidas por habitante |

Não encontrei: ausência tratada como zero em valor publicado; exclusão aplicada ao gráfico mas não à tabela, ao CSV, ao resumo ou às referências (as cinco superfícies concordam); razão despesa por atendimento ou usuário; nota, ranking de gestão, semáforo, DEA, SFA, estimativa de desperdício ou recomendação de corte; Distrito Federal misturado às capitais; dado pessoal (nenhum e-mail, CPF, endereço ou nome de profissional nas saídas); indicador `NAO_PUBLICAVEL` com observação, arquivo ou texto exibido como número.

## 5. Problemas encontrados

Severidade: bloqueante (fundamenta B1 a B4), alta, média, baixa.

**P1. Bloqueante. Razão agregada exibida em escala errada.**
Onde: `pipeline/eficiencia/referencias.py:83` grava `razao_agregada = soma_numerador / soma_denominador` sem o fator da unidade; `src/components/eficiencia/saude/ExploradorSaude.tsx:132-137` formata esse número com a unidade da medida; `public/eficiencia/series/saude_referencias_capitais.csv` repete o valor bruto, sem entrada no dicionário.
Reproduzir: `/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria?med=esf_10mil&ano=2025` mostra "Razão agregada 0,00" (8.737 ÷ 46.295.650 × 10.000 = 1,89); `/atendimento-e-resultados?med=icsap_taxa&ano=2024` mostra "0" (358.518 ÷ 46.192.631 × 100.000 = 776,1); `/gastos?med=asps_pct&ano=2025` mostra "0,2%" (21,8%).
Correção: gravar a razão na unidade da medida (fator na ficha) ou aplicar o fator na interface e no CSV; teste que compare a razão exibida com soma_numerador ÷ soma_denominador × fator para toda medida com `razaoAgregada`.

**P2. Bloqueante. Composição agregada por subfunção com 1 a 6 capitais.**
Onde: `src/lib/eficiencia/saude/consulta.ts:151` (`composicaoAgregada` exige as oito categorias observadas e elegíveis); a linha 306 existe em 14 dos 130 pares e FU10 em 94; uso em `DetalhesSaude.tsx:57,91`.
Reproduzir: `/gastos?med=despesa_hab&ano=2021`, sem capital escolhida, bloco "Por subfunção orçamentária": subtítulo "soma das capitais com valor comparável" e nota "Soma das despesas de 1 capitais" (Natal, com 48,3% em Administração geral).
Correção: somar as linhas presentes (a soma das linhas de cada declaração reproduz o total em 130 de 130 pares, validação S02) e declarar a regra, ou retirar o agregado; escrever o n no texto principal, não em nota; teste do universo da composição.

**P3. Bloqueante. Afirmação causal sem suporte.**
Onde: `DetalhesSaude.tsx:308` e `pipeline/eficiencia_saude/catalogo_indicadores.json:877`.
Reproduzir: `/atendimento-e-resultados`, bloco "Cobertura de planos de saúde privados"; ficha "Sobre este dado" da taxa de ICSAP, campo "O que não mede".
Correção: reescrever de forma descritiva ("internações pagas por planos privados não entram na taxa; a cobertura de planos vai de 6,5% a 65,5%"); incluir expressões causais ("por esse motivo", "devido a", "em razão de") no teste de neutralidade.

**P4. Bloqueante. Quebra de base populacional da cobertura potencial não tratada.**
Onde: `pipeline/eficiencia_saude/padroniza.py:321,378` (`ANO_INICIO_REGRA_VIGENTE = 2022` só trata 2021), `ExploradorSaude.tsx:117` (anotação só de 2021).
Reproduzir: `/rede-e-atencao-primaria?cap=sao-paulo&med=cobertura_aps&vis=evolucao` ("de 53,0% em 2022 para 59,5% em 2025", linha contínua). Em São Paulo a população de referência passa de 12.396.372 (dez/2022) para 11.451.999 (dez/2023); em Salvador cai 16,6%.
Correção: marcar quebra de base entre dez/2022 e dez/2023 (ou recalcular com a população de um mesmo ano base), interromper a linha, bloquear a variação e anotar no gráfico, como nas medidas por habitante; teste. Vale também para a linha "Brasil" (87,79 para 97,24).

**P5. Alta. Razão "1,07 a 2,79 vezes" sem fonte reproduzível.**
Onde: `src/components/eficiencia/saude/DetalhesSaude.tsx:277`, `pipeline/eficiencia_saude/matriz_fontes.py:70` (R05, com acesso "Não obtido").
Reproduzir: `/atendimento-e-resultados`, bloco "O que este resultado mede". O número não tem origem rastreável no repositório: R05 registra que a série por local não foi obtida, e R04 diz que o espelho de terceiros do SIH serviu só de conferência. As verificações de R01 ("nacional dentro de 0,05%; por capital 1% a 2%, acima de 5% em cinco capitais") parecem ter a mesma origem. Não verificado por mim.
Correção: guardar o recorte do SIH usado e a conta no seed, ou retirar os números e manter a explicação qualitativa.

**P6. Alta. Notas de natureza descrevem ausência como valor.**
Onde: `padroniza.py:145-155` e `derivados.py:36`.
Reproduzir: `/gastos?cap=rio-de-janeiro&ano=2022` (e São Luís 2022 e 2023), bloco "Por natureza da despesa": "A MSC aberta por natureza (R$ 0,00 ...) não reproduz a DCA; diferença de R$ 6.544.885.413,18". A MSC desses pares tem 0 linhas (ausência), não valor zero. Florianópolis 2022 e 2023: "não reproduz a DCA (R$ 466.493.256,91); diferença de R$ 0,00", porque há 24 e 30 linhas D e C sem natureza que se compensam.
Correção: distinguir "MSC sem registros no ente e exercício" de "MSC que não fecha"; reescrever a nota de Florianópolis com o motivo real.

**P7. Média. Estágio do ASPS não aparece na definição curta.**
Onde: `src/lib/eficiencia/saude/medidas.ts` (medida `asps_pct`), `padroniza.py:240-241` (usa a coluna empenhada).
Evidência: em 76 de 130 pares a despesa empenhada difere da liquidada (até 15,4% em Rio Branco 2021: 15,63% contra 13,54%); em Vitória 2021 e 2022 o ASPS empenhado supera a despesa liquidada da função (100,9% e 101,7%). O estágio está na fórmula da ficha e na matriz, não no texto principal. `dados_asps_estagio_empenhado_vs_liquidado.csv`.
Correção: dizer "despesa empenhada, regra do último bimestre" na definição e avisar que difere do estágio da despesa total.

**P8. Média. Exportações incompletas para uso fora do site.**
Onde: `ExploradorSaude.tsx:99`, `ComparadorSaude.tsx` (`exportarTabela`), `consulta.ts` (`linhasCsvComparacao`).
Evidência: coluna "Fonte" com identificadores internos ("siconfi_dca_anexo_i_e; ibge_populacao; ibge_ipca"), sem URL, data de captura, versão metodológica nem hash; o CSV da tabela de comparação não tem fonte, nota nem ressalva; texto "R$ 1.087" e número `1087.484542` convivem num arquivo com separador ponto e vírgula; para ICSAP o CSV da tabela diz "Exercício 2025 não coberto".
Correção: fonte legível com data e hash, ressalvas gerais, uma convenção decimal e rótulo de período por medida.

**P9. Média. Recorte de UBS por natureza jurídica pública.**
Onde: `padroniza.py:562,613`; `medidas.ts` (`ubs_10mil`).
Evidência: 125 UBS de gestão municipal têm natureza não pública (Rio de Janeiro 52, São Paulo 38). Contando as UBS de gestão municipal (299), o Rio de Janeiro passa de 0,37 para 0,44 UBS por 10 mil. A definição alerta para gestão estadual e dupla, não para este lado.
Correção: avisar na definição e oferecer a medida por gestão municipal ou por atendimento SUS declarado.

**P10. Média. Diferença de medidas percentuais ambígua.**
Onde: `ComparadorSaude.tsx:85` e `frases.ts`.
Reproduzir: `/comparar?cap=sao-paulo&vs=recife&med=asps_pct&ano=2025`: "São Paulo tem 3,3% a mais que Recife ... (17% maior, em valor)". Também "25% abaixo da mediana" para Rio Branco 2021 em ASPS.
Correção: usar "pontos percentuais" para a diferença absoluta e "relativa" para a razão.

**P11. Média. Composições agregadas de natureza e fonte sem n.**
Onde: `DetalhesSaude.tsx` (blocos `aNat` e `aFon`).
Evidência: natureza completa em 21 capitais (2021 e 2022), 23 (2023), 26 (2024), 25 (2025); fonte em 24 (2021). O texto não informa o n nem quem ficou de fora.
Correção: mostrar "N de 26 capitais" e as ausentes.

**P12. Média. Reprodução depende de acesso ao repositório não indicado.**
Onde: `metodos/page.tsx` (seção Reprodução), `FichaConteudo.tsx:156`.
Evidência: nenhuma URL de repositório nas sete páginas; o seed (recortes) não é baixável; o `sha256` do manifesto é do conteúdo descomprimido (`sha256sum` do `.gz` diverge em 681 de 681; conteúdo confere 681 de 681), sem aviso; a receita do `hash_dados` (JSON canônico, chaves ordenadas, separadores compactos, UTF-8) não está documentada.
Correção: URL pública, nota sobre o hash do conteúdo e receita do `hash_dados`.

**P13. Média. Exemplo de ASPS do documento não fecha.**
Onde: `docs/obee/saude/VALIDACOES_E_REPRODUCAO.md` (exemplo Recife 2025).
Evidência: 1.111.965.826,08 ÷ 5.628.463.971,49 = 19,756%, não 19,75%; o SIOPS publica 19,75 (truncado). Em 64 de 130 pares o percentual publicado é 0,01 ponto menor que XVI ÷ III arredondado.
Correção: escrever "o SIOPS informa 19,75 (truncado); a divisão dá 19,756".

**P14. Média. Dicionário sem 18 colunas de `saude_referencias_capitais.csv`.**
Evidência: faltam `grupo`, `capitais_no_grupo`, `mediana`, `razao_agregada` e as demais; a unidade da razão não é dita. Correção: completar o dicionário.

**P15. Média. Tabela de comparação mistura tipos de período.**
Evidência: exercício, dezembro e ano de processamento em colunas sob "em 2025". Correção: rótulo do tipo de período em cada coluna.

**P16. Média. Política de referências ausente da página de métodos.**
Evidência: quartis tipo 7, limiar de 8 capitais, razão agregada e empates só no JSON. Correção: seção curta.

**P17. Baixa. Afirmações incoerentes.**
(a) Matriz E01: "igual à API de dados abertos nas 26 capitais"; a medição M03 mostra 5 capitais diferentes (Manaus, Palmas, Recife, São Luís, São Paulo; refiz). (b) A entrada diz que filas foram "avaliadas e não publicadas, com o motivo"; R07 diz "não pesquisado nesta rodada". (c) Macapá 2025: "A MSC capturada também não reconcilia" omite que a MSC sem intraorçamentárias (R$ 503.269.686,89) é igual ao RREO e que a DCA destoa em exatos R$ 8.000.000,00.

**P18. Baixa. `versao_codigo` da gold não corresponde ao código atual.**
Evidência: a gold traz `gerador-46c4eacd9e67` com 19 arquivos; a reconstrução em cópia gera `gerador-313689ec1f10` com 20; `documenta.py` tem data de modificação posterior à da gold (14:46 contra 14:43), o que é compatível com a diferença, mas não identifiquei com certeza o arquivo. `hash_dados` reproduz. Correção: regenerar a gold depois da última alteração de código.

**P19. Baixa. Contagens da documentação.**
"25 CSVs" (são 23 CSV e 1 JSON de manifesto, 24 arquivos `sau_*` e `saude_*`); gold "5,9 MB" (6.090.065 bytes, mostrado como 6,1 MB no site); "46 testes" (47 executados). Link para `MATRIZ_DE_AVALIACAO.md` ainda sem destino.

**P20. Baixa. Exemplos de reconstrução crus.**
Na página de métodos, "Valor publicado: 8412103.39" e "Valor publicado: 1" sem componente nem unidade. Correção: rótulo do componente e formatação.

**P21. Baixa. Utilidade da evolução por habitante.**
Todas as ligações entre 2021 e 2024 ficam interrompidas; 2022 para 2023 usa a mesma população do Censo e 2023 para 2024 usa estimativa derivada dele. Conservador, sem erro, mas só 2024 para 2025 fica conectado.

**P22. Baixa. Detalhes de texto e de interface.**
Empates listados em ordem diferente na frase e no painel (eAP 2025); "(de 26 a 26)" em nota de variação do número de capitais; frases de escopo nacional com pontuação truncada ("por 100 mil. no mesmo ano e pela mesma regra; razão agregada. que pesa ..."); valores com artefato de ponto flutuante na gold e nos CSV (66.49000000000001); parâmetros inválidos na URL caem para o padrão sem aviso (ano=2025 em ICSAP mostra 2024); `DetalheRede` soma `valor ?? 0` nas somas de 26 capitais (sem efeito hoje); M02 registra Porto Velho 2023 com paga maior que liquidada, sem nota na observação.

Estas observações não alteram o número de bloqueios. Sobre pontuação, não encontrei hífen nem travessão como pontuação nos seis documentos nem nas páginas renderizadas; as únicas ocorrências são o rótulo literal da fonte "10 - Saúde", aceitável como citação.

## 6. O que foi recomputado e o que não foi

### 6.1 Recomputação independente a partir do seed bruto

Código próprio, sem importar funções do pipeline (`evidencias/dados_recomputa_independente.py`, executado com `python3 -I`). Cobre as 26 capitais e todos os anos, não só a amostra exigida; a amostra pedida (16 capitais das cinco regiões, primeiro e último ano de cada série e as seis exceções) está em `evidencias/dados_recomputacao_amostra.csv` (727 linhas).

| Grupo | Checagens | Resultado |
| --- | --- | --- |
| Despesa liquidada da função 10 (DCA I-E, linha "10 - Saúde", coluna "Despesas Liquidadas"), nominal | 130 | 130 iguais ao centavo |
| Despesa em reais de 2025 (fator próprio a partir do IPCA do seed) | 130 | 130 iguais |
| População residente (seed de IBGE) e despesa por habitante nominal e real | 130 + 260 | 390 iguais |
| Subfunções (837 valores) e somas das subfunções contra o total, na DCA e na gold | 837 + 260 | 1.097 iguais |
| ASPS: percentual publicado, percentual recalculado XVI ÷ III, valor aplicado, base de receita | 520 | iguais dentro de 0,011; em 64 pares o percentual da fonte é 0,01 menor que o arredondamento (truncamento do SIOPS) |
| UBS de dezembro (total ativas, públicas, gestão municipal) e por 10 mil | 520 | 520 iguais |
| UBS do retrato (total, públicas, gestão municipal) | 78 | 78 iguais; no arquivo original, 364 de 364 componentes |
| Equipes (eSF, eAP 20 h e 30 h) e por 10 mil | 650 | 650 iguais |
| Cobertura potencial do serviço contra a gold | 130 | 130 iguais |
| Cobertura potencial pela fórmula da NT 2/2025 | 130 | 107 iguais (104 de 104 em 2022 a 2025 e 3 de 26 em 2021); 23 diferentes em 2021, esperado e documentado |
| ICSAP: número, taxa nas duas populações, soma e valores dos 19 grupos, participação | 2.600 | 2.600 iguais |
| Natureza: publicação coerente com a DCA e valores | 130 + 348 | 128 coerentes e 348 valores iguais; 2 diferentes (Florianópolis 2022 e 2023), explicadas em P6 |
| Despesa por fonte: fechamento das nove fontes e valores | 130 + 1.152 | 1.282 iguais (Fortaleza e São Paulo 2021 não fecham e não são publicadas, como na gold) |
| Grupos de referência da gold (mediana, média, mínimo, máximo, quartis tipo 7, razão agregada) | 900 grupos | 0 divergências (cálculo à parte do total acima) |

Total: 8.135 checagens, 8.110 iguais, 25 diferentes e explicadas (`evidencias/dados_recomputacao_universo_resumo.csv`).

Exceções pedidas (valor recalculado igual à gold): Boa Vista 2024 R$ 503.187.172,75 (RREO 93.508.841,73; MSC sem modalidade 91 igual à DCA); Campo Grande 2021 R$ 1.573.583.018,36 (RREO sem intra 1.499.131.890,72 mais intra 74.451.127,64); Macapá 2025 R$ 495.269.686,89 (RREO e MSC sem intra 503.269.686,89); São Luís 2022 R$ 1.041.712.262,30 e Rio de Janeiro 2022 R$ 6.544.885.413,18 (CONFERE; MSC sem registros, natureza não publicada); Goiânia 2021 R$ 1.669.191.901,80 (CONFERE; MSC líquida 1.777.707.947,80 não reconcilia, natureza não publicada, como na gold).

### 6.2 Conferência com a fonte original (rede disponível)

Resumo (detalhe em `evidencias/dados_conferencia_fonte_original.csv`):

| Fonte | O que conferi | Resultado |
| --- | --- | --- |
| Siconfi, API DCA | 7 pares (São Paulo 2025, Recife 2023, Curitiba 2021, Manaus 2024, Boa Vista 2024, Macapá 2025, Campo Grande 2021) | 7 de 7 iguais ao seed e à gold |
| Siconfi, API RREO 02 e MSC | RREO de Macapá 2025 e de Boa Vista 2024; MSC de Macapá 2025 (saldo líquido, sem modalidade 91) | RREO igual ao seed nos dois; MSC de Macapá 503.269.686,89, igual ao RREO e ao seed |
| SIOPS, API RREO Anexo 12 | Recife 2025, São Paulo 2024, Porto Alegre 2023, Rio Branco 2021 (percentual, XVI, III) | 4 de 4 iguais |
| SIOPS, despesa por subfunção e fonte | São Paulo 2025 (total) e dicionário MetaDados.pdf (valor1 a valor10) | igual; mapeamento das nove fontes igual ao usado |
| IBGE SIDRA 6579 e 4714 | 7 populações (São Paulo 2021, 2022, 2024, 2025; Recife 2021, 2022, 2024) | 7 de 7 iguais |
| IBGE SIDRA 1737 | Fatores de IPCA para reais de 2025 | iguais aos dez dígitos |
| Relatório APS | São Paulo dez/2025: 1.723 eSF, 336 eAP 20 h, 160 eAP 30 h, capacidade 7.074.342, cobertura 59,47% | igual |
| RIPSA MRB.4.02 | Arquivo `mgdi_ms_qu3.csv.zip` baixado de novo (sha256 e 3.342.102 linhas iguais ao manifesto) | 104 de 104 pares iguais (número, grupos, população, taxa); totais nacionais iguais |
| CNES, arquivo diário | `cnes_estabelecimentos_csv.zip` baixado de novo (sha256 igual) | 364 de 364 componentes do retrato iguais |
| CNES, API por estabelecimento | 8 estabelecimentos sorteados, dezembros 2021 a 2025 | 8 de 8 iguais ao seed |

### 6.3 Consistência entre superfícies

Playwright em `http://localhost:3111`. Nas páginas de exploração, 15 recortes (despesa por habitante nominal 2021 e 2025 e em reais de 2025, despesa total 2025, ASPS 2021 e 2025, eSF 2021 e 2025, UBS 2025, cobertura 2021 e 2022, ICSAP taxa 2021 e 2024, ICSAP número e participação 2024): gold, gráfico (mediana e círculos), tabela, CSV baixado e painel de referências coincidem em n e mediana em 15 de 15 (`evidencias/dados_consistencia_superficies.csv`). Na página Comparar, 10 recortes (despesa por habitante 2021 e 2025, ASPS 2021 e 2025, UBS 2021 e 2025, ICSAP taxa 2021 e 2024, cobertura 2022, eSF 2025): painel, CSV da medida e CSV da tabela coincidem com a gold, sem divergência em nenhum dos 260 valores da coluna conferida (`evidencias/dados_consistencia_comparar.csv`). Campo Grande 2021 e Macapá 2025 saem do gráfico (linha tracejada "fora da comparação"), da contagem da tabela (n = 25), do CSV ("Na comparação = não"), do resumo ("mediana das 25 capitais"), da razão agregada (25), das composições agregadas, do CSV estático (`elegivel_comparacao = nao`) e do CSV da tabela de comparação. Bloqueio de variação por base populacional: aparece em despesa por habitante e por 10 mil habitantes (linhas interrompidas e frase "não é uma medida direta"), mas não em cobertura potencial (P4). Reais correntes e de 2025: a mediana de 2021 passa de R$ 877 para R$ 1.098 (fator 1,2528) e a de 2025 não muda (fator 1,0), como esperado.

### 6.4 Reprodução seguindo só o documento

| Exemplo de `VALIDACOES_E_REPRODUCAO.md` | Resultado |
| --- | --- |
| Despesa por habitante, São Paulo 2025 | 23.342.248.911,99 ÷ 11.904.961 = 1.960,72. Reproduz com o documento e o seed |
| ICSAP, São Paulo 2024 | 83.391 ÷ 11.895.578 × 100.000 = 701,03. Reproduz com o CSV `sau_icsap_taxa.csv`; a partir do arquivo original do RIPSA exige somar sexo e faixa etária, o que só o manifesto diz |
| Cobertura potencial, São Paulo dez/2025 | 1.723 × 3.500 + 336 × 1.750 + 160 × 2.625 + 35.842 = 7.074.342; ÷ 11.895.578 = 59,47%. O termo 35.842 (cadastro vinculado) não está no texto e é preciso ir ao seed |
| ASPS, Recife 2025 | A divisão dá 19,756%; o documento diz 19,75% (P13). Reproduz dentro de 0,01 ponto |

Um terceiro com acesso ao repositório consegue refazer os quatro, com um desvio de 0,01 no ASPS e um termo a buscar na cobertura; sem acesso ao repositório (URL não informada, P12) só refaz razões a partir dos CSV e valida a origem pelas URLs e hashes do manifesto. Reconstrução completa em cópia temporária (`python3 -m pipeline.eficiencia_saude.run`, 2,3 s, sem rede): 8.751 observações, 20 validações com os mesmos resultados, `hash_dados` f111efb2ef09c540 reproduzido; observações, referências, fichas e validações idênticas às publicadas; apenas `gerado_em` e `versao_codigo` diferem (P18). O `hash_dados` também se recalcula da gold com JSON canônico (receita em P12).

### 6.5 Testes e riscos sem teste

Executei `python3 -m unittest pipeline.tests.test_eficiencia_saude` (47 testes, OK, 16,3 s) e `npx vitest run src/tests/obee-saude.test.ts` (58 testes, OK). Riscos sem teste: escala da razão agregada exibida (P1); universo da composição agregada por subfunção (P2); texto causal e comparações sem ressalva, pois a neutralidade se apoia numa lista de palavras proibidas; quebra de base populacional em cobertura potencial (P4); CSV da tabela de comparação e rótulos de período no CSV; correspondência entre a ficha e o texto curto das medidas (estágio do ASPS); consistência entre documento e gold (contagens); sem teste de interface no navegador (o gate de HTML só procura `NaN`/`undefined`). A suíte completa de vitest, `next build` e o gate `html-gerado` não foram executados por mim.

### 6.6 Desempenho (laboratório, não experiência real)

Protocolo: Chromium sem limitação de rede ou CPU, servidor local, uma carga por rota e largura (320, 390, 768, 1440 px), espera de 700 ms após rede ociosa. Resultado nas 7 rotas e 4 larguras (28 medições): 0 erros ou avisos de console, 0 px de rolagem horizontal, CLS no máximo 0,0007, LCP de 76 a 236 ms; HTML de 7,5 KB (entrada) a 93,9 KB (Gastos) transferidos, 169 KB de JavaScript (208 KB na entrada); 57 links internos únicos, todos 200; 24 arquivos de download servidos com 200. Observação: nas rotas com `Link` ocorre um `?_rsc` abortado para `/` ao fim da navegação, sem efeito visível.

### 6.7 Tarefas orientadas (inspeção heurística, sem usuários)

Tarefas 1 a 4 e 8 foram executáveis só com a interface e os documentos: despesa por habitante e elegibilidade (Gastos com capital), mediana e grupo (painel de referências e "Grupo de comparação" por região), correntes contra reais de 2025 (alternância e fator), motivos de Campo Grande 2021 e Macapá 2025 (bloco de conferência e "fora da comparação"), ICSAP de São Paulo 2024 (reproduzida). A tarefa 7 (exportar) funciona, mas o arquivo perde a fonte legível e as ressalvas (P8). Tarefas 5 e 6 dependem de leitura e didática, fora do meu escopo; na tarefa 6, a leitura da cobertura potencial ao longo do tempo exige atenção a P4.

### 6.8 O que não foi recomputado ou verificado

Conferência ao vivo de DCA, RREO e MSC só em 7 pares (os demais dependem do seed e dos hashes do manifesto); população de 2023 da relação do DOU (conferi só a igualdade com o Censo de SP e Recife); escopo do indicador COB.2.01 usado como denominador da participação; a recomputação a partir do espelho do SIH (R04) e a afirmação de acesso aos 1.620 arquivos; as afirmações negativas sobre Siaps, Sisab e Banco Mundial (testes de 09/10/2026 do executor); suíte vitest completa (143 arquivos), `next build` e regressão de Educação; o restante do conteúdo de `docs/obee/saude/` além das contagens e dos quatro exemplos; a data de homologação do SIOPS (a API não informa).

## 7. Limitações desta avaliação

* Inspeção heurística de um agente, em um único ambiente e momento (09/10/2026); medições de desempenho são de laboratório e não representam redes ou dispositivos reais.
* Não houve usuários, especialistas, revisão externa nem teste com leitores; as notas dizem respeito ao módulo, não às administrações.
* A recomputação usa o mesmo seed do executor para a maior parte dos valores; a independência de fonte vem das conferências ao vivo (7 pares da DCA, 4 do SIOPS, 7 populações, RIPSA e CNES completos, 8 estabelecimentos), não de uma segunda captura integral.
* Algumas regras de negócio (por exemplo, quais contas da MSC formam o liquidado; a regra do último bimestre do Anexo 12) foram aceitas do documento do executor e não reverificadas contra o manual da STN.
* Os critérios A a D, H a J ficaram fora; a nota K trata de confiabilidade técnica, desempenho e testes, não de acessibilidade.
* A pasta `evidencias/` é compartilhada com outro avaliador; os arquivos `dados_*` são meus e os demais não foram abertos.
* Qualquer correção do executor exige nova rodada localizada; as notas acima não são negociáveis e valem apenas para o estado do repositório observado.

## 8. Reavaliação 1

Data: 09/10/2026, depois das correções do executor. Avaliador: o mesmo avaliador independente de dados e método (agente Claude, contexto limpo), sem leitura do `avaliador-experiencia.md` nem de `MATRIZ_DE_AVALIACAO.md`. Li `CORRECOES.md` (mapa do executor) e verifiquei cada linha de forma independente, no build servido em `http://localhost:3111` e nos arquivos. Estado verificado: gold `hash_dados` `ce882081d96f44d5`, 8.777 observações, `versao_codigo` `gerador-4b7d9bcad56f`.

**Resultado em uma linha da reavaliação:** os quatro bloqueios da primeira rodada foram corrigidos em três e em parte no quarto; **resta 1 bloqueio** (a troca de base da população de referência da cobertura potencial entre dezembro de 2024 e dezembro de 2025, não sinalizada), mais 3 defeitos novos de gravidade média. Médias por critério: E 8,57; F 8,46; G 8,46; K 8,57 (antes 7,43; 7,53; 7,87; 7,43). Ficam abaixo de 9,0 vinte e cinco das 28 combinações de página e critério; chegam a 9,0 só Panorama K, Gastos E e Entrada K.

### 8.1 Verificações de regressão

| Verificação | Resultado |
| --- | --- |
| `python3 -m unittest pipeline.tests.test_eficiencia_saude` | 56 testes, OK (14,8 s) |
| `npx vitest run src/tests/obee-saude.test.ts` | 67 testes, OK |
| Reconstrução em cópia temporária fora do repositório (`python3 -m pipeline.eficiencia_saude.run`) | 8.777 observações, 21 validações com os mesmos resultados, `hash_dados` ce882081d96f44d5 reproduzido; todas as seções da gold iguais às publicadas, exceto `gerado_em`; `versao_codigo` agora igual (4b7d9bcad56f nos dois) |
| Recomputação independente a partir do seed bruto (mesmo código da primeira rodada, todas as capitais e anos) | 8.135 checagens, 8.110 iguais, 25 diferentes e as mesmas explicadas (23 de cobertura 2021 pela fórmula da NT 2/2025 e 2 de natureza de Florianópolis); nenhum valor mudou (`evidencias/dados_reavaliacao1_recomputacao_resumo.csv`) |
| Nova linha do retrato do CNES (`gestao_municipal_nao_publica`) contra o arquivo original do OpenDataSUS | 26 de 26 iguais; total 125, Rio de Janeiro 52, São Paulo 38 |
| Referências de grupo da gold | Razão agregada = soma do numerador ÷ soma do denominador × fator, dentro de [mínimo, máximo], em 276 de 276 linhas (900 grupos conferidos); `fator_razao` 1, 100, 10.000 ou 100.000 por medida |
| Hashes do manifesto | 682 de 682 recortes conferem no conteúdo descomprimido |
| Desempenho em laboratório (7 rotas, 320, 390, 768 e 1440 px, 28 medições) | 0 erros ou avisos de console, 0 px de rolagem horizontal, CLS no máximo 0,0007, LCP de 72 a 212 ms |
| Consistência entre superfícies | Páginas de exploração: 15 de 15 recortes com o mesmo n e a mesma mediana na gold, na tabela e no CSV do recorte. Comparar: 10 recortes, painel, CSV da medida e CSV da tabela iguais à gold, 260 de 260 valores. Exportações novas conferidas contra a gold sem divergência: 6 CSV de recorte, 2 CSV de série, 2 CSV da tabela de comparação (`dados_reavaliacao1_csv_exportados.csv`) |

### 8.2 Estado de cada achado

| Achado | Estado | Verificação independente |
| --- | --- | --- |
| B1 e P1: razão agregada em escala errada | Corrigido | 24 exibições (8 medidas, todos os anos de cada uma) iguais a soma do numerador ÷ soma do denominador × fator: eSF 2025 1,89; eAP 0,29; UBS 0,66; ICSAP 2024 776; participação 14,4%; ASPS 21,8%; cobertura 72,6%. CSV de referências com `fator_razao` e dicionário. `dados_reavaliacao1_razao_agregada_ui.csv` |
| B2 e P2: composição por subfunção com 1 a 6 capitais | Corrigido | Soma de 25, 26, 26, 26 e 25 capitais de 2021 a 2025, escrita em texto normal com as capitais fora (Campo Grande 2021, Macapá 2025). Refiz a soma das subfunções a partir da DCA: percentuais e valores iguais nos cinco anos (diferenças só de arredondamento na exibição). Natureza (21, 21, 23, 26, 25) e fonte (24, 26, 26, 26, 26) também informam o n. `dados_reavaliacao1_composicao_agregada.csv` |
| B3 e P3: frase causal sobre planos privados | Corrigido | Página: "As internações pagas por planos privados não entram na taxa ... sem relação estabelecida com a taxa"; ficha igual; busca de "por esse motivo", "devido a", "em razão de", "em consequência" e do trecho antigo sem ocorrência em página, catálogo, gold, código e documentos |
| B4 e P4: troca de base da cobertura potencial | Corrigido em parte | Corrigida a passagem de dezembro de 2022 para dezembro de 2023: marcas de base em 2021 e 2022, aviso único na tela, nota na referência do Brasil, medição M05 (confere com meu recálculo: população de referência com mediana de queda de 8,5%, mediana 62,2% para 76,9%, 9,1 de 14,6 pontos percentuais só do denominador), linha interrompida e variação bloqueada. **Não corrigida a passagem de dezembro de 2024 para dezembro de 2025** (ver R1) |
| P5: razão "1,07 a 2,79" sem fonte | Corrigido | Números fora da página, da matriz (R05) e das referências; R01 diz que a conferência com o espelho de terceiros não está guardada e que nenhum número publicado depende dela; os 104 pares do RIPSA reproduzem (já verificado). Resta uma frase qualitativa ("sobretudo em capitais que são polo regional"), plausível e sem número |
| P6: notas de natureza | Corrigido | Três textos: "MSC sem linhas ... Não é um valor zero" (São Luís 2022 e 2023, Rio de Janeiro 2022); "MSC aberta ... não reproduz a DCA" com os valores certos; linhas sem natureza identificável (Florianópolis 2022 e 2023). Macapá 2025 agora diz que a MSC (503.269.686,89, que refiz ao vivo) é igual ao RREO e que a DCA é a única fonte com valor distinto |
| P7: estágio do ASPS | Corrigido | Definição na página: "pela despesa empenhada (regra do último bimestre do demonstrativo)"; "O estágio empenhado difere do liquidado da despesa total: em alguns exercícios o valor aplicado supera a despesa liquidada na função Saúde"; ficha com Vitória 2021 e 2022 |
| P8: exportações | Corrigido em parte | CSV do recorte, da série e da tabela trazem fonte por extenso, endereço, data de captura, versão, hash, numerador, denominador, mediana do grupo, ressalva geral, decimal declarado e período por medida. Defeitos novos no campo de endereço (ver N2) |
| P9: UBS de gestão municipal não pública | Corrigido | Definição e ficha avisam; linha nova do retrato igual ao arquivo original |
| P10: diferenças em percentual | Corrigido | "3,3 pontos percentuais"; "R$ 636 por habitante a mais ... (48% maior em valor relativo)"; total em reais sem percentual; "5,3 pontos percentuais abaixo da mediana" |
| P11: composições sem n | Corrigido | Ver B2 |
| P12: reprodução sem repositório, hash e receita | Corrigido em parte | Link para o repositório (público, conferido), nota de que o `sha256` do manifesto é do conteúdo descomprimido (682 de 682 conferem) e receita do `hash_dados`. A receita está incompleta: sem `ensure_ascii=False` o hash não reproduz (ver N5) |
| P13: exemplo de ASPS | Corrigido | "19,756%" e "O SIOPS informa 19,75 (valor truncado)" |
| P14: dicionário | Corrigido | 65 linhas, com o arquivo de cada coluna; cobrem as colunas dos CSV por indicador e do CSV de referências (incluindo `razao_agregada` e `fator_razao`). Resta a matriz de fontes sem entradas (N5) |
| P15: tipos de período na tabela | Corrigido | Cabeçalho em dois níveis (perímetro; medida, unidade e período); CSV da tabela com tipo de período por coluna e "sem dado em 2025; a série vai até 2024" |
| P16: política de referências | Corrigido | Seção "Como as referências são calculadas" (quem entra, mediana, média simples, razão agregada com unidade, quartis tipo 7, limiar de 8, empates, referência nacional, mínimo legal) |
| P17: E01 contra M03, filas, Macapá | Corrigido | E01 diz "coincide em 21 das 26" (confere: Manaus, Palmas, Recife, São Luís e São Paulo diferem); a entrada diz que filas "não foram pesquisadas"; Macapá corrigido (P6) |
| P18: `versao_codigo` da gold | Corrigido | A reconstrução em cópia gera o mesmo `versao_codigo` da gold |
| P19: contagens da documentação | Corrigido em parte | 24 arquivos, 6,2 MB e 56 testes conferem. O link para `MATRIZ_DE_AVALIACAO.md` segue sem destino e o registro de progresso de `CONTINUIDADE.md` ainda diz "4 medições" (agora 5) |
| P20: trilhas cruas | Corrigido em parte | Trilhas formatadas, com componente e unidade, para São Paulo. Três trilhas ganharam unidade errada (N3) |
| P21: evolução por habitante | Corrigido | Marcas por base: 2022 e 2023 (mesma população do Censo 2022) conectadas; quebras entre 2021 e 2022 e entre 2023 e 2024; a frase usa o último trecho da mesma base ("de R$ 1.843 em 2024 para R$ 1.961 em 2025; os valores de 2021, 2022, 2023 usam outra base") |
| P22: detalhes | Corrigido em parte | Corrigidos: "(de 26 a 26)", fragmentos das referências do Brasil, ponto flutuante nos CSV (nenhum artefato nos CSV estáticos), ano inválido normalizado na URL, soma só com capitais com valor, nota de Porto Velho 2023. Permanece: empates listados em ordem diferente na frase e no painel (eAP 2025: "Belo Horizonte, Boa Vista e mais 4" contra "Boa Vista, Macapá e mais 4"); "ponto percentual" no singular em "+4,75 ponto percentual" |

### 8.3 Matriz de notas atualizada

Avaliador: avaliador independente de dados e método (agente Claude, contexto limpo). Nenhuma nota chega a 9,5: não há validação adicional por pessoas ou especialistas.

| Página | Critério | Nota anterior | Nota nova | Justificativa da mudança | Evidência |
| --- | --- | --- | --- | --- | --- |
| Panorama | E | 8,5 | 8,6 | Legenda da faixa central com valores; referências sem mudança de substância e iguais à gold | `dados_reavaliacao1_recomputacao_resumo.csv` |
| Panorama | F | 8,3 | 8,8 | Definição do ASPS diz o estágio empenhado; aviso sobre UBS de gestão municipal não pública; exclusões e perímetros mantidos | P7, P9 verificados |
| Panorama | G | 8,0 | 8,2 | Ficha e Dados e métodos com repositório, hash e receita; sem exportação nem link do repositório dentro da ficha da própria página | P12 |
| Panorama | K | 8,8 | 9,0 | Todos os valores iguais à gold, desempenho de laboratório sem falha, testes agora cobrem razão, universo das composições e frases causais. Não é maior: sem validação externa | `dados_reavaliacao1_recomputacao_resumo.csv`; 56 e 67 testes |
| Gastos | E | 6,5 | 9,0 | Razão agregada correta nas cinco medidas de exercício e nos cinco anos; composições com n e capitais fora, refeitas por mim; política de referências na página de métodos. Resta só a ordem dos empates (Baixa) | `dados_reavaliacao1_razao_agregada_ui.csv`; `dados_reavaliacao1_composicao_agregada.csv` |
| Gastos | F | 7,0 | 8,9 | Estágio do ASPS dito e a exceção de Vitória registrada; notas de natureza corretas; composições sem agregado enganoso. Resta o singular "ponto percentual" e a generalidade de "fora da soma" (N4) | P6, P7 |
| Gastos | G | 7,8 | 8,5 | CSV com fonte, endereço, data, versão, hash, numerador e denominador; dicionário completo; exemplo de ASPS certo. Descontos: endereço da população errado e vazio em 2023 e marcadores `<ano>` no endereço da DCA (N2) | `dados_reavaliacao1_csv_exportados.csv` |
| Gastos | K | 6,0 | 8,9 | Erros de exibição corrigidos; 260 valores da tabela de comparação, 6 CSV de recorte e 2 de série iguais à gold. Desconto: N2 | idem |
| Rede e APS | E | 6,0 | 7,5 | Razão agregada correta nas quatro medidas e aviso da passagem de 2022 para 2023. Reduz: série e frase da cobertura potencial comparam dezembro de 2023 com dezembro de 2025 sem sinalizar a troca de base de 2025 (R1) | `dados_reavaliacao1_cobertura_base_2024_2025.csv` |
| Rede e APS | F | 6,5 | 7,3 | Aviso de UBS e de base de 2022 para 2023 corretos. Reduz: R1, que o próprio critério do executor (bloqueio por mudança de base) deveria cobrir | idem |
| Rede e APS | G | 7,8 | 8,4 | Retrato do CNES com a nova linha conferida no arquivo original; E01 corrigido; mesmos descontos de endereço (N2) | P9, P17 |
| Rede e APS | K | 5,5 | 7,3 | Erros de razão corrigidos; permanece comparação temporal incompatível na cobertura (R1) e o rótulo "Ausente na coleta" no ano sem mediana (N1) | R1, N1 |
| Atendimento e resultados | E | 6,5 | 8,8 | Taxa agregada 776 ao lado do Brasil 1.026; referências do Brasil com texto limpo; composição por grupo com n; números sem fonte retirados | `dados_reavaliacao1_razao_agregada_ui.csv` |
| Atendimento e resultados | F | 6,8 | 8,4 | Frase causal e razão sem fonte retiradas. Limita: escopo de COB.2.01 como denominador da participação continua não verificado, o que impede nota maior | P3, P5 |
| Atendimento e resultados | G | 7,5 | 8,4 | Sem números de origem não rastreável; R01 honesto sobre a conferência; ICSAP reproduzida; soma por sexo e faixa só no manifesto; N2 | P5 |
| Atendimento e resultados | K | 6,0 | 8,8 | Razão agregada e frases corrigidas; valores iguais ao arquivo do RIPSA (104 de 104) | `dados_reavaliacao1_recomputacao_resumo.csv` |
| Comparar capitais | E | 8,0 | 8,8 | Diferenças em pontos percentuais, razões e totais sem ambiguidade; cabeçalho com perímetro e período; 260 de 260 valores iguais à gold | `dados_consistencia_comparar.csv` (refeito depois das correções, mesmos resultados) |
| Comparar capitais | F | 7,5 | 8,4 | Mesmas correções; desconto: a evolução de cobertura potencial das capitais escolhidas herda R1 | R1 |
| Comparar capitais | G | 7,0 | 8,4 | CSV da medida e da tabela com fonte, hash, versão, período por medida e ressalva geral; desconto N2 | `dados_reavaliacao1_csv_exportados.csv` |
| Comparar capitais | K | 8,0 | 8,7 | Rótulo de período no CSV corrigido ("sem dado em 2025; a série vai até 2024"); valores exatos; R1 na evolução de cobertura | idem |
| Dados e métodos | E | 8,0 | 8,8 | Seção "Como as referências são calculadas" completa e correta (confere com o código e com a gold) | P16 |
| Dados e métodos | F | 8,2 | 8,6 | E01, R01, R05 e exemplo de ASPS corrigidos | P5, P13, P17 |
| Dados e métodos | G | 8,3 | 8,5 | Repositório, hash do conteúdo, `versao_codigo` consistente, dicionário, trilhas de São Paulo. Descontos: receita do hash incompleta, trilhas com unidade errada, matriz de fontes sem entradas no dicionário, link da matriz de avaliação | N3, N5 |
| Dados e métodos | K | 8,7 | 8,3 | Piora: três trilhas exibem valores em reais com a unidade "%" e ruído de ponto flutuante, defeito introduzido pela correção | N3 |
| Entrada `/eficiencia-estatal` | E | 8,5 | 8,5 | Sem mudança | txt da entrada |
| Entrada `/eficiencia-estatal` | F | 8,4 | 8,8 | Texto sobre filas corrigido ("não pesquisados nesta rodada") | P17 |
| Entrada `/eficiencia-estatal` | G | 8,7 | 8,8 | Leva a Dados e métodos, que agora tem o repositório; sem lista de fontes na entrada | links 200 |
| Entrada `/eficiencia-estatal` | K | 9,0 | 9,0 | Sem mudança: estática, sem erro, LCP 72 a 112 ms | `dados_desempenho_laboratorio.csv` |

Médias: E 8,57 (antes 7,43); F 8,46 (7,53); G 8,46 (7,87); K 8,57 (7,43). Média por página: Panorama 8,65; Gastos 8,83; Rede e APS 7,63; Atendimento e resultados 8,60; Comparar 8,58; Dados e métodos 8,55; Entrada 8,78. Menor nota por página: Panorama 8,2; Gastos 8,5; Rede 7,3; Resultados 8,4; Comparar 8,4; Métodos 8,3; Entrada 8,5. A meta de 9,0 em cada critério e página não foi atingida.

### 8.4 Bloqueios remanescentes

**R1 (resto de B4). Bloqueante. Troca de base da população de referência da cobertura potencial entre dezembro de 2024 e dezembro de 2025, não sinalizada.**
O Ministério usa como denominador a população do ano anterior ao da competência. Dezembro de 2023 e dezembro de 2024 usam a mesma população (a relação do Censo 2022, variação 0,0% em todas as capitais); dezembro de 2025 usa a estimativa de 2024, que sobe em mediana 6,2% (de 3,1% a 13,7%). A mediana de cobertura vai de 83,50% a 83,04% (queda de 0,46 ponto percentual), mas com a população de dezembro de 2024 seria 88,56%: a troca de base esconde 5,5 pontos percentuais de aumento da capacidade. O módulo trata dezembro de 2023, 2024 e 2025 como da mesma base (marca "nao" nos três), enquanto bloqueia o mesmo tipo de troca nas medidas por habitante (2023 para 2024, Censo para estimativa). A mesma lógica vale para a referência do Brasil (101,72% em 2024, 99,14% em 2025).
Onde: `pipeline/eficiencia_saude/padroniza.py` (`ANO_BASE_POPULACAO_PRE_CENSO`, marcas só até 2022), `referencias_externas.py`, `validacoes.py` (M05 só trata 2022 para 2023), `consulta.ts` (`avisoDoPeriodo`).
Reproduzir: `/eficiencia-estatal/saude-capitais/rede-e-atencao-primaria?cap=sao-paulo&med=cobertura_aps&vis=evolucao`: "de 58,4% em dez. 2023 para 59,5% em dez. 2025" com linha contínua de 2023 a 2025 (a população de referência de São Paulo passa de 11.451.999 para 11.895.578); `?med=cobertura_aps&vis=evolucao`: "de 76,9% em dez. 2023 para 83,0% em dez. 2025". Números em `evidencias/dados_reavaliacao1_cobertura_base_2024_2025.csv`.
Correção sugerida: marcar três bases (dezembro de 2021 e 2022; dezembro de 2023 e 2024; dezembro de 2025), interromper a linha e bloquear a variação entre 2024 e 2025, estender M05 e a nota da referência do Brasil, e cobrir com teste a regra "população de referência igual em anos consecutivos".

### 8.5 Problemas que permanecem ou são novos

**N2. Média (novo). Endereço da fonte errado ou incompleto nas exportações.**
Onde: coluna `fonte_url` dos CSV `sau_*` e coluna "Endereço da fonte" dos CSV baixados (`gold.py`, `consulta.ts`).
Evidência: o endereço da população é o da consulta SIDRA 6579 para 2021 (`.../v/9324/p/2021`) em todas as linhas, inclusive 2022 (Censo, tabela 4714), 2024 e 2025; em 2023 (relação do DOU) está vazio; o endereço da DCA vem com marcadores `<ano>` e `<código IBGE>` (este com espaço, o que quebra a lista "separados por espaço" que o dicionário descreve); o IPCA aparece como fonte e com endereço em valores nominais. Reproduzir: `public/eficiencia/series/sau_ctx_populacao_residente.csv`, colunas `ano` e `fonte_url`.
Correção: endereço por linha (ano e tabela corretos, ou texto "ver manifesto das capturas, chave X"), separador sem espaço dentro do endereço, e fonte do IPCA só para reais de 2025.

**N3. Média (novo). Trilhas de reconstrução com unidade errada e ruído numérico.**
Onde: Dados e métodos, "Exemplos de reconstrução passo a passo" (seção Reprodução); trilhas geradas em `gold.py`.
Evidência: "Valor publicado: 2.284.588.849,15 % da despesa liquidada na função Saúde, componente pessoal" (é valor em reais), "2.637.769.742,32 % ... componente 122" e "0 % da despesa total empenhada ... recursos_ordinarios"; valores com cauda de ponto flutuante ("23.342.248.911,990002", "82.799.878.206,479996", "19.065.464.730,450001"), embora a DCA traga 23.342.248.911,99.
Correção: usar a unidade do componente (reais) e não a da participação; arredondar a centavos antes de formatar; teste que compare cada trilha com a observação.

**N1. Média (novo). "Ausente na coleta" para o ano sem mediana de cobertura (2021).**
Onde: Evolução da mediana (legenda "○ no eixo: ano sem valor (2021: ausente na coleta)") e coluna "Estado do dado" do CSV da série (`consulta.ts`).
Evidência: os valores de 2021 existem e estão fora das comparações; "ausente" sugere falha de coleta. Reproduzir: `/rede-e-atencao-primaria?med=cobertura_aps&vis=evolucao` e o CSV da série.
Correção: "Fora das comparações (regra anterior)" e estado `NAO_COMPARAVEL`.

**N4. Baixa (novo). Motivo genérico em "Fora da soma".**
Nas composições de natureza, São Luís 2022 e 2023, Rio de Janeiro 2022 (MSC sem registros) e Florianópolis 2022 e 2023 (linhas sem natureza) aparecem com "abertura não publicada: não reproduz a DCA", diferente do texto correto da nota da capital. A nota de Florianópolis ainda compara dois valores iguais ("R$ 466.493.256,91 ... DCA (R$ 466.493.256,91)") sem dizer que as linhas sem natureza se compensam.

**N5. Baixa (novo ou residual).**
(a) A receita do `hash_dados` na página não diz `ensure_ascii=False`: com o padrão do Python o hash é bbd9cb7d143be643 e não ce882081d96f44d5. (b) O dicionário não tem entradas para as colunas de `saude_matriz_de_fontes.csv`. (c) `README.md` e `CONTINUIDADE.md` apontam para `MATRIZ_DE_AVALIACAO.md`, ainda inexistente, e o registro de progresso diz "4 medições". (d) Os exemplos de cobertura e de ICSAP do documento não trazem o termo 35.842 nem a soma por sexo e faixa etária. (e) Empates em ordem diferente e "ponto percentual" no singular (P22). (f) "Em todos os anos a mediana usa as mesmas 26 capitais" na cobertura, mas 2021 não tem mediana. (g) Texto qualitativo sobre capitais polo regional (R05 e página) sem fonte numérica.

### 8.6 Limitações da reavaliação

* Inspeção heurística de um agente, no build servido às 16h do dia 09/10/2026; desempenho de laboratório.
* A recomputação independente usa o mesmo seed do executor; a independência de fonte vem das conferências ao vivo feitas na primeira rodada (que não repeti, pois o seed não mudou: os 682 hashes do manifesto conferem) e da recomputação da DCA, dos grupos de referência e do retrato do CNES a partir do arquivo original.
* Não verificado: escopo de COB.2.01 usado como denominador da participação (por isso Resultados F fica em 8,4); suíte vitest completa (143 arquivos), `next build`, regressão de Educação; regras de negócio aceitas do documento do executor (contas da MSC, regra do último bimestre do Anexo 12); a nova explicação de "datas de referência diferentes" nas cinco capitais de M03 (as contagens diferem, a causa não foi confirmada).
* Não avaliei A a D, H a J nem li o relatório do avaliador de experiência; as correções X1 a X28 só foram observadas quando afetam dados e método (CSV, textos, números).
* Não houve usuários, especialistas nem revisão externa.
* As notas valem para o estado observado; uma nova rodada localizada deve rever R1, N1, N2 e N3.


## 9. Reavaliação 2

Data: 09/10/2026, depois do segundo ciclo de correções do executor (rodada 1, ciclo 2). Avaliador: o mesmo avaliador independente de dados e método (agente Claude, contexto limpo), sem leitura do `avaliador-experiencia.md` nem de `MATRIZ_DE_AVALIACAO.md`. Li a seção 5 de `CORRECOES.md` (mapa do executor) e verifiquei cada linha de forma independente, no build servido em `http://localhost:3111` (processo iniciado às 16h42 UTC, depois do build das 16h42) e nos arquivos. Estado verificado: gold `hash_dados` `159b76024a953f4d`, 8.777 observações, `versao_codigo` `gerador-49a4de465bef`, `gerado_em` 2026-10-09T16:39:56Z, 21 validações (S01 a S16 e M01 a M05). Parte das minhas capturas anteriores foi feita antes dessa reinicialização do servidor; refiz todas contra o processo atual e só uso aqui as refeitas.

**Resultado em uma linha da reavaliação:** o bloqueio R1 e os problemas N1 a N5 foram corrigidos, **não resta nenhum bloqueio**, e o que sobra são dois defeitos de gravidade média, de pequena extensão (endereço da fonte da população de 2023 no CSV estático e metadados do CSV da tabela de Comparar) e defeitos baixos. Médias por critério: E 8,83; F 8,86; G 8,69; K 9,01 (antes 8,57; 8,46; 8,46; 8,57). Nove das 28 combinações de página e critério chegam a 9,0 (os sete K e, em Gastos, E e F); as outras dezenove ficam entre 8,3 e 8,9. A meta de 9,0 em cada critério e página **não foi atingida**; o critério mais distante é G, que depende de metadados de exportação e de documentos.

### 9.1 Verificações de regressão

| Verificação | Resultado |
| --- | --- |
| `python3 -m unittest pipeline.tests.test_eficiencia_saude` | 57 testes, OK (15,8 s) |
| `npx vitest run src/tests/obee-saude.test.ts` | 70 testes, OK |
| Testes Python de Educação e Saúde juntos (`test_eficiencia`, `test_eficiencia_comparacoes`, `test_eficiencia_saude`) | 154 testes, OK. `pipeline/tests` inteiro: 1.370 testes com 1 falha e 69 erros, todos em módulos de energia, por falta do pacote `pyarrow` neste ambiente (fora do escopo) |
| Reconstrução em cópia temporária fora do repositório (`python3 -m pipeline.eficiencia_saude.run`) | 8.777 observações, `hash_dados` 159b76024a953f4d reproduzido, `versao_codigo` igual; todas as seções da gold iguais às publicadas, exceto os carimbos de tempo; nos 21 CSV estáticos regenerados só a coluna `dados_gerados_em` difere (10.577 de 355.225 células) |
| Receita do `hash_dados` da página (JSON das observações, chaves ordenadas, separadores compactos, UTF-8, sem escape ASCII) | Reproduz 159b76024a953f4d. Sem `ensure_ascii=False` sai e078ebe2c1def20f, o que a página agora avisa ("caracteres acentuados mantidos (sem escape ASCII)") |
| Recomputação independente a partir do seed bruto (mesmo código da primeira rodada, todas as capitais e anos) | 8.135 checagens, 8.110 iguais, 25 diferentes e as mesmas explicadas (23 de cobertura 2021 pela fórmula da NT 2/2025; 2 de natureza de Florianópolis 2022 e 2023). Nenhum valor mudou (`evidencias/dados_reavaliacao2_recomputacao_resumo.csv`) |
| RIPSA COB.2.01 e COB.5.01 contra os arquivos originais (baixados agora) | COB.2.01: 104 de 104 pares (internações SUS e população do denominador) iguais no original, no seed e na gold; a participação de ICSAP (ICSAP ÷ COB.2.01) recalculada é igual à gold nos 104. COB.5.01, linha Total: 104 de 104 iguais |
| Consistência entre superfícies (gold, gráfico, tabela e CSV do recorte) | Páginas de exploração: 15 de 15 recortes com o mesmo n, mediana e capitais fora. Comparar: 10 recortes de painel e CSV da medida iguais; tabela de 2021 a 2025 baixada do site: 5 × 26 capitais × 10 medidas = 1.300 células iguais à gold e células sem dado vazias. CSV de série (capital, mediana, capitais fora): 35 linhas, valor e elegibilidade iguais |
| Razão agregada exibida | 24 de 24 combinações (8 medidas, todos os anos) iguais a soma do numerador ÷ soma do denominador × fator, calculada por mim a partir da gold (`dados_reavaliacao2_razao_agregada_ui.csv`) |
| Composições agregadas (subfunção, natureza, fonte) | 15 de 15 blocos (5 anos × 3): n de capitais igual à gold e soma das linhas igual ao total da gold (diferenças só de arredondamento da exibição). Natureza: 21, 21, 23, 26 e 25 capitais; subfunção: 25, 26, 26, 26, 25 |
| Cobertura potencial, trocas de base | Ver 9.2, R1 (`dados_reavaliacao2_cobertura_tres_bases.csv`) |
| Trilhas de reconstrução | 20 de 20 de São Paulo 2025 com unidade, casas e participação corretas, iguais à minha recomputação e aos arquivos do RIPSA |
| Desempenho em laboratório (7 rotas, 320, 390, 768 e 1440 px, 28 medições, Chromium sem estrangulamento) | 0 erros ou avisos de console, 0 px de rolagem horizontal, CLS no máximo 0,0007, LCP de 68 a 208 ms |
| Parâmetros de URL inválidos (9 casos) | Nenhum NaN ou undefined; `med=foo` e `cap=distrito-federal` ficam na URL e a página mostra o padrão (ver D9) |
| Busca de expressões causais ou de julgamento nas sete páginas e na gold | Nenhuma ocorrência; "semáforo" e "recomendação" só aparecem em avisos de que não existem |
| Links internos das sete rotas | 66 links, nenhum quebrado. Das 11 páginas externas citadas, 10 respondem 200; a página do IBGE da relação de populações (e a de estimativas, citada nos CSV) respondem 403 por desafio anti robô neste ambiente: não verificado |

Os resumos estão em `evidencias/dados_reavaliacao2_verificacoes_novo_build.csv`.

### 9.2 Estado de cada achado

| Achado | Estado | Verificação independente |
| --- | --- | --- |
| **R1** (resto de B4): troca de base da população de referência da cobertura potencial entre dez. 2024 e dez. 2025 | **Corrigido** | (1) Três bases marcadas na gold nos 130 pares: 2021 e 2022 pré Censo, 2023 e 2024 Censo (mesma população), 2025 estimativa de 2024; marcas `quebra_serie` True, True, False, False, True em todas as 26 capitais. (2) Notas: na observação (São Paulo 2025: "mistura dois anos de crescimento populacional e não mede só a cobertura"; 2022: "anterior ao Censo 2022"; 2023 e 2024: "a mesma, a do Censo 2022: a variação entre os dois meses vem só da capacidade das equipes") e na referência do Brasil de 2025 (99,1%). (3) M05 trata as duas trocas e o título da validação na página agora diz "trocas ... (dezembro de 2022 para 2023 e de 2024 para 2025)". Meu recálculo a partir da gold: 2022 para 2023, população de referência −8,5% (de −16,6% a 4,4%), mediana 62,2% a 76,9% (+14,6 pontos percentuais), 67,7% com a população antiga, efeito só do denominador +9,1; 2024 para 2025, +6,2% (de 3,1% a 13,7%), mediana 83,5% a 83,0% (−0,5), 88,6% com a população de 2024, efeito −5,5. Iguais ao texto da página. Os casos listados conferem (Salvador 2.900.319 para 2.417.678 = −16,64%; Fortaleza 80,19% com a população antiga). (4) Interface: a linha só liga 2023 a 2024 (SVG de São Paulo e da mediana: um único segmento entre os pontos de 2023 e 2024), a frase da evolução usa o último trecho da mesma base ("de 76,9% em dez. 2023 para 83,5% em dez. 2024. Os valores de dez. 2022, dez. 2025 usam outra base e não entram nesta variação"), a variação 2024 para 2025 está bloqueada nas visões de capital e mediana, a legenda diz "Mudança de base entre 2022 e 2023; 2024 e 2025: a linha se interrompe". (5) CSV da série: coluna "Marca de base do denominador" sim, sim, nao, nao, sim. (6) Teste novo cobre as duas trocas, as populações iguais em 2023 e 2024 e os textos. `dados_reavaliacao2_cobertura_tres_bases.csv` |
| **N1** "Ausente na coleta" para o ano sem mediana de cobertura | **Corrigido** | Legenda "○ no eixo: ano sem valor (2021: fora da comparação)"; CSV da série: estado "Fora da comparação", "Na comparação" não, n 0 e nota "Nenhuma capital entra na comparação neste período: os valores oficiais existem e ficam fora da mediana" |
| **N2** endereço da fonte | **Corrigido nos CSV baixados da interface e quase todos os estáticos** | 17 CSV baixados da interface (recorte, medida, série) conferidos quanto aos endereços e artefatos: uma célula "Páginas oficiais da fonte" por arquivo, endereços de páginas que uma pessoa abre, separados por espaço e sem espaço interno, sem `<ano>`, `<código>`, `undefined`, `NaN` ou `[object`; o IPCA (SIDRA 1737) aparece só nos CSV em reais de 2025. Estáticos: 19 dos 20 `sau_*` completos; resta `sau_ctx_populacao_residente.csv` (D1). Restam também D2 (CSV da tabela de Comparar, que nunca trouxe endereço) e D3 |
| **N3** trilhas com unidade errada e ruído numérico | **Corrigido** | As 20 trilhas de São Paulo 2025 trazem unidade do componente, casas decimais coerentes com a medida e participação separada ("Valor publicado: R$ 2.284.588.849,15, componente pessoal, participação de 9,7874% no total"; "R$ 2.637.769.742,32, componente 122, participação de 11,3004%"; "R$ 0, componente recursos_ordinarios, participação de 0%"). Todas iguais à recomputação (9,7874% = 2.284.588.849,15 ÷ 23.342.248.911,99; 59,47% = 7.074.342 ÷ 11.895.578; 1,4473 = 1.723 ÷ 11.904.961 × 10.000; 701,0252 e 14,7624 conferidos com o RIPSA; 48,3068% de planos privados conferido com o original). Há teste |
| **N4** motivo genérico em "Fora da soma" de natureza | **Corrigido** | Motivos por capital: "a MSC de dezembro não traz registros deste exercício" (São Luís 2022 e 2023, Rio de Janeiro 2022), "a MSC traz linhas sem natureza identificável" (Florianópolis 2022 e 2023), "a abertura não reproduz a DCA" (as demais). Nota de Macapá 2025 completa (MSC 503.269.686,89 contra DCA 495.269.686,89, diferença de R$ 8.000.000,00). Resta a nota de Florianópolis comparar dois valores iguais sem dizer que as linhas sem natureza se compensam (D6) |
| **N5a** receita do hash | **Corrigido** | Ver 9.1 |
| **N5b** dicionário sem a matriz de fontes | **Corrigido** | `saude_dicionario_das_colunas.csv` com 73 linhas: 35 de `sau_*`, 26 de `saude_referencias_capitais.csv`, 8 de `saude_matriz_de_fontes.csv` e 4 gerais; cobre as colunas dos três tipos de arquivo |
| **N5c** `MATRIZ_DE_AVALIACAO.md` e "4 medições" | **Corrigido em parte** | "16 validações e 5 medições" em `CONTINUIDADE.md` e `ARQUITETURA.md`. O arquivo `MATRIZ_DE_AVALIACAO.md` continua inexistente e `README.md` (linha 12) e `CONTINUIDADE.md` (linha 9) continuam apontando para ele (D7) |
| **N5d** exemplos de cobertura e ICSAP | **Não corrigido** | Os quatro exemplos de `VALIDACOES_E_REPRODUCAO.md` reproduzem (1.960,72; 701,03; 59,47%; 19,756% truncado em 19,75). O de cobertura continua sem o termo 35.842 (cadastro vinculado: 7.074.342 menos 7.038.500) e o de ICSAP sem a soma por sexo e faixa etária (D7) |
| **N5e** empates e singular | **Corrigido** | eAP 2025: "vão de 0,00 em Belo Horizonte (MG), Boa Vista (RR) e mais 4 a 1,28 em Curitiba (PR)" e o painel lista os mesmos seis em ordem alfabética; "5,3 pontos percentuais abaixo da mediana" e "+0,63 pontos percentuais"; concordância "vão" e "vai" nos títulos dos 15 recortes conferidos |
| **N5f** "Em todos os anos a mediana usa as mesmas 26 capitais" | **Não corrigido** | A legenda da evolução da cobertura ainda diz isso, mas 2021 não tem mediana (n 0) (D6) |
| **N5g** texto sobre capitais polo regional | **Corrigido** | Não há mais a frase na taxa de ICSAP; a única ocorrência é uma observação sobre leitos (indicador não publicado) |
| Outros itens do mapa: marca de base da mediana | **Corrigido** | Mediana por habitante: marcas nao, sim, sim, nao, nao; o segmento liga só 2022 a 2023 e 2024 a 2025 (2 segmentos no SVG); n de cada ano na frase (25, 26, 26, 26, 25) e a nota de que o conjunto muda. Campo Grande 2021 (perímetro distinto) não altera a base do conjunto (há teste) |
| Outros itens do mapa: linha de capitais fora da comparação | **Corrigido** | "Fora da comparação neste recorte: Macapá (AP). Motivo e detalhe abaixo." acima do gráfico de Gastos 2025; em Campo Grande 2021 e Macapá 2025 as séries não têm segmento para o ano fora |
| Outros itens do mapa: nota de zero observado | **Corrigido** | eAP 2025: "Valor zero observado em 6 capitais: Belo Horizonte (MG), Boa Vista (RR), Cuiabá (MT), Macapá (AP), São Luís (MA), Teresina (PI). A fonte informa zero, e não ausência de dado." Conferi o zero nas seis na gold e no seed |
| Outros itens do mapa: avisos de período da cobertura | **Corrigido** | 2025: "A variação entre dezembro de 2024 e dezembro de 2025 mistura dois anos de crescimento populacional"; 2024: "Dezembro de 2023 e dezembro de 2024 usam a mesma população de referência"; 2021: "segue regra anterior de equipes e de cadastro"; 2022: "anterior ao Censo 2022" |

Correção de uma afirmação minha da Reavaliação 1: na linha P8 de 8.2 e na linha de Comparar G de 8.3 escrevi que o CSV da tabela de Comparar traz endereço, data de captura e versão. Ao conferir agora, esse CSV traz apenas "Fontes das medidas" (nomes curtos), "Dados gerados em" e o hash; o recorte, a medida e a série é que trazem endereço, captura e versão. A tabela já era assim na Reavaliação 1. A nota de Comparar G abaixo já considera isso (D2).

### 9.3 Matriz de notas atualizada

Avaliador: avaliador independente de dados e método (agente Claude, contexto limpo). Inspeção heurística de um agente, sem usuários nem especialistas; nenhuma nota chega a 9,5.

| Página | Critério | Nota anterior (Reavaliação 1) | Nota nova | Justificativa da mudança | Evidência |
| --- | --- | --- | --- | --- | --- |
| Panorama | E | 8,6 | 8,6 | Sem mudança. Cartões iguais à gold (n, mediana, extremos, faixa central, mínimo legal, referência do Brasil); razão agregada e história própria ficam nas páginas de exploração | 9.1 |
| Panorama | F | 8,8 | 8,8 | Sem mudança | idem |
| Panorama | G | 8,2 | 8,3 | O caminho para Dados e métodos termina agora numa receita de hash que reproduz e em trilhas corretas. Continua sem exportação própria nem endereço do repositório na ficha da página | `dados_reavaliacao2_verificacoes_novo_build.csv` |
| Panorama | K | 9,0 | 9,0 | Sem mudança: valores iguais à gold, 57 e 70 testes, nenhum erro de console | idem |
| Gastos | E | 9,0 | 9,2 | Mediana da evolução por habitante interrompida onde a base muda e com o n de cada ano; linha de capitais fora acima do gráfico; empates na mesma ordem na frase e no painel; razão agregada 10 de 10 nas medidas de exercício; composições com n e capitais fora (15 de 15 blocos). Resta o rótulo "26 capitais" no CSV da mediana (D4) | `dados_reavaliacao2_razao_agregada_ui.csv`; `dados_reavaliacao2_composicao_agregada.csv` |
| Gastos | F | 8,9 | 9,0 | Motivos de natureza diferenciados e corretos; concordância corrigida; elegibilidade igual em gráfico, tabela, resumo e CSV (15 de 15). Descontos: nota de Florianópolis (D6), marca do CSV de Campo Grande 2021 (D5) e as regras aceitas do documento do executor (último bimestre do Anexo 12, contas da MSC), que não validei com a fonte | 9.2 |
| Gastos | G | 8,5 | 8,9 | CSV com páginas oficiais sem marcadores, IPCA só em reais de 2025 na interface, receita do hash exata, dicionário completo e 20 trilhas corretas. Descontos: população de 2023 sem endereço no CSV estático (D1) e IPCA ausente nas linhas reais do CSV estático (D3) | `dados_reavaliacao2_csv_exportados.csv` |
| Gastos | K | 8,9 | 9,1 | 15 recortes, 1.300 células da tabela de Comparar e as séries iguais à gold; sem erro de console; testes cobrem razão, bases e notas. Só defeitos baixos. Não verificado: suíte vitest completa e `next build` | 9.1 |
| Rede e APS | E | 7,5 | 8,9 | R1 resolvido: três bases marcadas, avisos em 2024 e 2025, nota na referência do Brasil, linha interrompida, variação bloqueada; razão agregada correta nas quatro medidas e nos anos (cobertura 61,5; 70,9; 74,1; 72,6); nota de zero observado. Descontos: 2021 sem mediana (regra anterior, documentado) e marcas dos CSV (D5) | `dados_reavaliacao2_cobertura_tres_bases.csv` |
| Rede e APS | F | 7,3 | 8,9 | A troca de 2024 para 2025 é tratada como a de 2022 para 2023 e a cobertura é apresentada como capacidade teórica, sem teto. Descontos: explicação de M03 (cinco capitais com contagens diferentes) não confirmada; 2021 fora por fórmula (23 de 26 diferem da NT 2/2025) | idem |
| Rede e APS | G | 8,4 | 8,7 | Páginas oficiais nos CSV, trilhas de cobertura e equipes corretas, retrato do CNES conferido na primeira rodada. Descontos: D5 e o arquivo diário do CNES sem competência (a captura é a única referência temporal, dito na página) | 9.2 |
| Rede e APS | K | 7,3 | 9,0 | O erro de comparação foi corrigido; valores iguais à gold; testes cobrem as duas trocas; sem erro de console nem rolagem horizontal. Desconto: componentes compartilhados (D9) | idem |
| Atendimento e resultados | E | 8,8 | 8,9 | Empates e concordância corrigidos; razão agregada 776 e 14,4% conferidas; referência do Brasil (1.026) e n mantidos | `dados_reavaliacao2_razao_agregada_ui.csv` |
| Atendimento e resultados | F | 8,4 | 8,8 | COB.2.01 e COB.5.01 conferidos contra os arquivos originais (104 de 104 cada) e a participação recalculada é igual à gold; no Brasil, ICSAP é 14,4% das internações SUS em 2021 (1.643.747 de 11.438.662), ordem de grandeza coerente. Não confirmado: que o universo de internações de COB.2.01 seja o mesmo (tipo de AIH) de MRB.4.02, pois não obtive a ficha técnica do RIPSA; taxa bruta | 9.1 |
| Atendimento e resultados | G | 8,4 | 8,7 | Trilhas de ICSAP e de planos privados conferidas com os originais; exportações com páginas oficiais. Descontos: exemplo de ICSAP sem a soma por sexo e faixa (D7) e página do RIPSA com denominador listada junto de páginas do IBGE (D8) | idem |
| Atendimento e resultados | K | 8,8 | 9,0 | 104 de 104 valores do RIPSA; 24 de 24 razões; sem erro de console; sem mudança de cálculo | idem |
| Comparar capitais | E | 8,8 | 8,9 | Evolução de cobertura das capitais escolhidas com as três bases e a mediana tracejada alinhada; 1.300 de 1.300 células e 10 painéis iguais à gold | `dados_reavaliacao2_verificacoes_novo_build.csv` |
| Comparar capitais | F | 8,4 | 8,9 | R1 não afeta mais a evolução de cobertura (linha só entre 2023 e 2024; "◇ 2021: valor oficial fora das comparações e sem linha com os anos vizinhos"); Macapá 2025 e Campo Grande 2021 em itálico e fora de medianas | 9.2 |
| Comparar capitais | G | 8,4 | 8,6 | CSV da medida e da série completos; o CSV da tabela não traz endereço da fonte, data de captura nem versão metodológica (D2), corrigindo minha leitura da Reavaliação 1 | D2 |
| Comparar capitais | K | 8,7 | 9,0 | Nenhuma divergência em valores, elegibilidade ou n entre painel, tabela e CSV; sem erro de console | 9.1 |
| Dados e métodos | E | 8,8 | 8,8 | Sem mudança. Política de referências correta | idem |
| Dados e métodos | F | 8,6 | 8,8 | M05 com as duas trocas e título certo; ICSAP e cobertura com avisos de base. Descontos: explicação de M03 não confirmada; regras aceitas não validadas externamente | 9.2 |
| Dados e métodos | G | 8,5 | 8,8 | Receita do hash reproduz; 20 trilhas corretas; dicionário com 73 linhas e a matriz de fontes; 66 links internos sem quebra. Descontos: D1, D2, D7 (documentos do repositório com link quebrado e exemplo de cobertura sem o termo 35.842) | idem |
| Dados e métodos | K | 8,3 | 9,0 | N3 corrigido (unidade e casas nas 20 trilhas, com teste); 28 medições sem erro de console; LCP de 136 a 184 ms | idem |
| Entrada `/eficiencia-estatal` | E | 8,5 | 8,5 | Sem mudança | texto da página conferido |
| Entrada `/eficiencia-estatal` | F | 8,8 | 8,8 | Sem mudança | idem |
| Entrada `/eficiencia-estatal` | G | 8,8 | 8,8 | Sem mudança; data de última captura (09/10/2026) igual ao manifesto | idem |
| Entrada `/eficiencia-estatal` | K | 9,0 | 9,0 | Sem mudança: estática, sem erro, LCP de 68 a 104 ms | `dados_desempenho_laboratorio.csv` |

Médias: E 8,83 (Reavaliação 1: 8,57); F 8,86 (8,46); G 8,69 (8,46); K 9,01 (8,57). Média por página: Panorama 8,68 (8,65); Gastos 9,05 (8,83); Rede e APS 8,88 (7,63); Atendimento e resultados 8,85 (8,60); Comparar capitais 8,85 (8,58); Dados e métodos 8,80 (8,55); Entrada 8,78 (8,78). Menor nota por página: Panorama 8,3 (G); Gastos 8,9 (G); Rede e APS 8,7 (G); Atendimento e resultados 8,7 (G); Comparar 8,6 (G); Métodos 8,8; Entrada 8,5 (E). Combinações em 9,0 ou mais: 9 de 28.

### 9.4 Bloqueios remanescentes

**Nenhum.** Conferi um a um os bloqueios da rubrica: valor incorreto (nenhum; 8.110 de 8.135 checagens iguais e as 25 diferenças explicadas e já documentadas); comparação materialmente incompatível (a última, R1, foi corrigida; as demais passagens de base são marcadas e bloqueadas); despesa do município como gasto total (não); razão despesa por atendimento ou por usuário (não publicada); ausência tratada como zero (não; células sem dado vazias nos 1.300 valores da tabela e nota própria para o zero observado); exclusão aplicada ao gráfico mas não ao resumo ou CSV (15 de 15 recortes, 5 tabelas e 3 séries consistentes); ressalva essencial escondida (não); afirmação causal ou julgamento (busca sem ocorrência); nota, ranking, semáforo, DEA, estimativa de desperdício ou recomendação de corte (nenhum); Distrito Federal misturado ou sem motivo (não; `cap=distrito-federal` cai na página padrão); dado pessoal (nenhum); barreira a tarefa essencial (66 links internos e os downloads respondem).

### 9.5 Problemas que permanecem ou são novos

Numeração própria desta reavaliação (D1 a D9), por gravidade.

**D1. Média (residual de N2, pequena extensão). População de 2023 sem fonte legível nem endereço no CSV estático.**
Onde: `public/eficiencia/series/sau_ctx_populacao_residente.csv` (baixado pelo link "População residente" de Dados e métodos), 26 das 130 linhas.
Evidência: em `ano` 2023 a coluna `fonte` traz o identificador interno `ibge_populacao_relacao_2023` e `fonte_url` está vazia; os demais anos trazem o nome por extenso e as páginas do IBGE. O CSV baixado pela interface em 2023 está correto. Reproduzir: filtrar `ano` = 2023 no arquivo.
Correção: mapear o identificador para o texto legível e para a página da relação de populações do TCU no `gold.py`; incluir no teste de CSV "todas as linhas têm fonte legível e endereço".

**D2. Média. CSV da tabela de Comparar sem endereço da fonte, data de captura e versão metodológica.**
Onde: `/comparar?med=despesa_hab&ano=2025`, botão "Baixar CSV da tabela" (`consulta.ts`, montagem do CSV da tabela).
Evidência: as colunas finais são "Observações", "Fontes das medidas" (nomes curtos, como "Siconfi, DCA Anexo I-E; IBGE, população residente (SIDRA)"), "Dados gerados em", "Hash dos dados" e "Leia antes de usar". Faltam as páginas oficiais, a data de captura e a versão que os CSV de recorte e de série têm. Sem o arquivo do site, quem recebe a tabela não encontra a página nem a captura sem passar pelo hash.
Correção: acrescentar "Páginas oficiais das fontes", "Data de captura" e "Versão metodológica" (uma vez por arquivo) e testar que as colunas de metadados são as mesmas dos outros CSV.

**D3. Baixa. Linhas em reais de 2025 do CSV estático não citam o IPCA como fonte.**
Onde: `sau_despesa_funcao_saude.csv`, `sau_despesa_por_habitante.csv`, `sau_asps_valor_aplicado.csv` e `sau_asps_base_receita.csv`, linhas `componente` = `real_2025` (4 × 130).
Evidência: `base_monetaria` diz "R$ de 2025 (IPCA, média anual)", mas `fonte` e `fonte_url` listam só DCA, SIOPS e IBGE população; o CSV baixado pela interface em reais cita o IPCA (SIDRA 1737). Correção: incluir o IPCA na fonte e no endereço quando `componente` é `real_2025`.

**D4. Baixa. Rótulo "Mediana das 26 capitais na comparação" nos CSV de série da mediana em anos com 25 ou 0 capitais.**
Onde: "Baixar CSV da série" da visão Evolução sem capital (por habitante: 2021 e 2025 têm 25; cobertura: 2021 tem 0).
Evidência: a coluna "Capitais na mediana" está certa (25, 26, 26, 26, 25), mas a primeira coluna diz 26 em todas as linhas. Correção: rótulo sem número ou com o n do ano.

**D5. Baixa. A marca de base do denominador é um sim e nao alternado, que não identifica a base.**
Onde: coluna "Marca de base do denominador" dos CSV de série e `quebra_serie` dos CSV estáticos.
Evidência: na cobertura, 2021, 2022 e 2025 têm a mesma marca "sim" e são três bases diferentes (a regra "anos consecutivos só são comparáveis com a mesma marca" evita o erro, mas quem compara 2022 com 2025 pelo CSV se engana); no CSV de série de Campo Grande a marca de 2021 é "sim" por causa do perímetro e a de 2022 também é "sim" (uma passagem de base), embora "Na comparação" seja "não" em 2021 e a interface não ligue os anos. Os CSV estáticos têm o texto da base em `base_populacional`; os de série da interface não têm. Correção: coluna de texto "Base do denominador" nos CSV de série; marca de perímetro separada da marca de base.

**D6. Baixa. Dois textos imprecisos.**
(a) Nota de natureza de Florianópolis 2022 e 2023: "a soma das categorias identificadas (R$ 466.493.256,91) não pode ser conferida contra a DCA (R$ 466.493.256,91)" compara dois valores iguais sem dizer que as linhas sem natureza se compensam. (b) Legenda da evolução da cobertura por capital: "Em todos os anos a mediana usa as mesmas 26 capitais", mas 2021 não tem mediana. Reproduzir: `/gastos?med=despesa_hab&ano=2022&cap=florianopolis`; `/rede-e-atencao-primaria?cap=sao-paulo&med=cobertura_aps&vis=evolucao`. Correção: reescrever as duas frases.

**D7. Baixa. Documentos do repositório.**
`README.md` (linha 12) e `CONTINUIDADE.md` (linha 9) apontam para `MATRIZ_DE_AVALIACAO.md`, inexistente; `VALIDACOES_E_REPRODUCAO.md` linha 81 cita "testes Python de Educação e de Saúde aprovados (144)" (agora 154, dos quais 57 de Saúde) e "143 arquivos, 2.745 testes aprovados antes das últimas edições" (não verifiquei a suíte vitest completa); `ARQUITETURA.md` linha 19 diz 6,2 MB para a gold e a página diz 6,3 MB (o arquivo tem 6.267.099 bytes); o exemplo de cobertura da seção 3 não mostra o termo 35.842 e o de ICSAP não mostra a soma por sexo e faixa etária. Correção: criar o arquivo ou tirar os links; atualizar contagens; completar os dois exemplos.

**D8. Baixa. Endereços repetidos ou supérfluos.**
O CSV da série de despesa total repete três vezes o mesmo endereço do Siconfi na célula de páginas oficiais; o CSV do recorte de ICSAP com denominador do RIPSA lista as páginas do IBGE de população, que servem à variante com denominador do OBEE. Correção: deduplicar e listar por variante.

**D9. Baixa (componentes compartilhados, já reconhecidos pelo executor).**
Parâmetros inválidos (`med=foo`, `cap=distrito-federal`) permanecem na URL embora a página mostre o padrão sem NaN. Não reexaminei o encostar do marcador de nota "2" no rótulo de valor na evolução de São Paulo, que o executor diz não resolver por ser componente compartilhado.

### 9.6 Limitações da reavaliação

* Inspeção heurística de um agente, no build servido às 16h42 UTC do dia 09/10/2026 (processo `next start` iniciado às 16h42); desempenho de laboratório, sem estrangulamento, no mesmo ambiente do servidor.
* A recomputação independente usa o mesmo seed do executor (os 682 hashes do manifesto conferem, verificado na primeira rodada e o seed não mudou); a independência de fonte vem das conferências ao vivo da primeira rodada e desta: DCA, grupos de referência, retrato do CNES e MRB.4.02 a partir do arquivo original, e agora COB.2.01 e COB.5.01 do RIPSA.
* Não verificado: que o universo de internações de COB.2.01 seja o mesmo (tipo de AIH) de MRB.4.02 (conferi os números e a ordem de grandeza nacional, mas não obtive a ficha técnica); a explicação de M03 para as cinco capitais com contagens diferentes do CNES; as regras de negócio aceitas do documento do executor (contas da MSC, regra do último bimestre do Anexo 12); as duas páginas do IBGE citadas (respondem 403 com desafio anti robô); a suíte vitest completa (143 arquivos), `next build` e `tsc`; a regressão visual de Educação; as consultas ao vivo de DCA, RREO e MSC além das 7 da primeira rodada.
* Não avaliei A a D, H a J nem li o relatório do avaliador de experiência; só observei as correções de aparência quando afetam dados e método (CSV, textos, números, linhas dos gráficos).
* Não houve usuários, especialistas nem revisão externa; as notas valem para o estado observado e nenhuma passa de 9,2.
* Evidências: `evidencias/dados_reavaliacao2_*.csv` (recomputação, cobertura em três bases, razão agregada, composições, exportações e verificações do novo build).


## 10. Reavaliação 3

Data: 09/10/2026, depois do terceiro ciclo de correções do executor (rodada 1, ciclo 3). Avaliador: o mesmo avaliador independente de dados e método (agente Claude, contexto limpo), sem leitura do `avaliador-experiencia.md` nem de `MATRIZ_DE_AVALIACAO.md`. Li a seção 6 de `CORRECOES.md` (mapa do executor, sem notas) e verifiquei cada linha de forma independente, no build servido em `http://localhost:3111` (processo `next start` iniciado às 17h27 UTC, depois do build das 17h27) e nos arquivos. Estado verificado: gold `hash_dados` `ea1565fee6907c1a`, 8.777 observações, `versao_codigo` `gerador-b84de0984ebc`, `gerado_em` 2026-10-09T17:19:36Z, 21 validações (S01 a S16 e M01 a M05), HEAD `f3188a9b1` na verificação. Refiz todas as capturas contra esse processo. Depois dela o executor registrou `8f034c07e` (17h45), só com mudanças de apresentação em `src/` (siglas na linha "Fontes" da entrada e o quadro "O módulo em números" como lista semântica) que o servidor ainda não trazia (build das 17h27); essas mudanças não foram avaliadas.

**Resultado em uma linha da reavaliação:** D1 a D4, D6 e D8 foram corrigidos, D5 e D7 em parte, D9 não mudou (o executor o declarou); **não resta nenhum bloqueio** e **nenhum defeito de gravidade média**: o que sobra são nove problemas baixos (T1 a T9), dos quais o mais relevante é um conjunto de frases imprecisas nas fichas sobre a troca de base da população (T1). Médias por critério: E 8,86; F 8,83; G 8,89; K 8,99 (Reavaliação 2: 8,83; 8,86; 8,69; 9,01). Nove das 28 combinações de página e critério chegam a 9,0 (Gastos E, F, G e K; os K de Rede, Resultados, Comparar, Métodos e Entrada); as outras dezenove ficam entre 8,5 e 8,9. A meta de 9,0 em cada critério e página **não foi atingida**; a seção 10.5 diz, para cada nota abaixo de 9,0, o que falta.

### 10.1 Verificações de regressão

| Verificação | Resultado |
| --- | --- |
| `python3 -m unittest pipeline.tests.test_eficiencia_saude` | 57 testes, OK (15,0 s). O ciclo acrescentou uma asserção, não um teste |
| `npx vitest run src/tests/obee-saude.test.ts` | 70 testes, OK. O arquivo não foi alterado no ciclo |
| Suíte vitest completa (`npx vitest run`) | 143 arquivos, 2.762 testes aprovados e 1 ignorado, como diz `VALIDACOES_E_REPRODUCAO.md` (era "não verificado" na Reavaliação 2) |
| Testes Python de Educação e Saúde juntos | 154 testes, OK, como o documento passou a dizer |
| Reconstrução em cópia temporária fora do repositório (`python3 -m pipeline.eficiencia_saude.run`) | 8.777 observações, `hash_dados` ea1565fee6907c1a reproduzido, `versao_codigo` igual; as 22 seções comparáveis da gold iguais às publicadas (só diferem os carimbos de tempo e o commit da proveniência); nos CSV estáticos só a coluna `dados_gerados_em` difere (9.677 de 331.799 células) |
| Receita do `hash_dados` da página | Reproduz ea1565fee6907c1a; sem `ensure_ascii=False` sai 56ddc75d3a3fc121 |
| O que mudou na gold entre o ciclo 2 e o ciclo 3 | Só o texto da nota de natureza de Florianópolis 2022 e 2023 (6 observações) e o motivo correspondente em S04; nenhum valor mudou |
| Recomputação independente a partir do seed bruto (mesmo código, todas as capitais e anos) | 8.135 checagens, 8.110 iguais, 25 diferentes e as mesmas explicadas (23 de cobertura 2021 pela NT 2/2025; 2 de natureza de Florianópolis) (`evidencias/dados_reavaliacao3_recomputacao_resumo.csv`) |
| Hashes do manifesto do seed | 682 de 682 iguais no conteúdo descomprimido |
| Consultas ao vivo (novas) | Relatório APS dez. 2025 Brasil (99,14%) e São Paulo (59,47%), SIDRA 6579 São Paulo 2025 (11.904.961) e DCA 2025 de São Paulo (R$ 23.342.248.911,99): iguais à gold |
| População 2022 e 2023 do módulo contra o PDF do IBGE de 22/12/2023, baixado agora | 26 de 26 iguais (`dados_reavaliacao3_populacao_2022_2023_vs_censo.csv`); ver T2 |
| Consistência entre superfícies | Páginas de exploração: 15 de 15 recortes sem divergência de n, mediana e capitais fora. Comparar: 10 recortes de painel e CSV da medida (260 células) e tabelas de 2021 a 2025 baixadas do site (5 × 26 × 10 = 1.300 células) iguais à gold, com células sem dado vazias. CSV de série: 24 arquivos e 112 linhas, valor, n e base iguais à gold |
| Razão agregada exibida | 24 de 24 combinações iguais a soma do numerador ÷ soma do denominador × fator |
| Composições agregadas (subfunção, natureza, fonte) | 15 de 15 blocos: n e soma das linhas iguais à gold |
| Panorama: extremos, faixa central e n de 7 cartões | 7 de 7 iguais à gold (quartis tipo 7); a linha nova "Fora da comparação: Macapá (AP), conferência pendente: diferença material entre DCA e RREO sem explicação documentada" confere |
| Trilhas de reconstrução de São Paulo 2025 | 20 de 20 com unidade, casas e participação corretas |
| Linhas dos gráficos de Evolução (SVG, 9 gráficos) | Segmentos só entre anos com a mesma marca; sem segmento para Macapá 2025 e Campo Grande 2021 |
| Quadro "O módulo em números" de Dados e métodos (novo desde a Reavaliação 2) | 20 + 3 indicadores, 8.777 observações, 21 = 16 + 5 validações e 12 + 9 + 10 = 31 medidas candidatas: todos iguais à gold e à matriz de fontes |
| Desempenho em laboratório (7 rotas, 320, 390, 768 e 1440 px, 28 medições) | 0 erros ou avisos de console, 0 px de rolagem horizontal, LCP de 76 a 248 ms, CLS no máximo 0,0037 (Panorama a 1440 px, repetível; ver T8) |
| Links | 66 links internos sem quebra; âncora `#reproducao` existe; páginas oficiais externas respondem 200, exceto as duas do IBGE (403 por desafio anti robô, não verificado) |
| Parâmetros de URL inválidos (9 casos) | Nenhum NaN ou undefined; `med=foo` e `cap=distrito-federal` seguem na URL (D9) |

Resumos em `evidencias/dados_reavaliacao3_verificacoes_novo_build.csv`.

### 10.2 Estado de cada achado

| Achado | Estado | Verificação independente |
| --- | --- | --- |
| **D1** CSV estático de população de 2023 | **Corrigido** | As 26 linhas de 2023 trazem "IBGE, População dos municípios para o exercício de 2023: Censo Demográfico 2022 (segunda apuração), relação do DOU de 31/08/2023", a página da relação (37734) e a captura 2026-10-08. Os 20 `sau_*` têm fonte legível, endereço e data em todas as linhas, sem identificador interno nem marcador |
| **D2** CSV da tabela de Comparar | **Corrigido** | Três colunas novas: "Páginas oficiais das fontes" (sem repetição; com o IPCA, SIDRA 1737, quando a moeda é real), "Data de captura mais recente" (2026-10-09) e "Versões metodológicas" (uma por medida). Conferido na tabela de 2021 a 2025 e nas opções moeda real e denominador do OBEE |
| **D3** IPCA nas linhas `real_2025` dos CSV estáticos | **Corrigido** | 520 de 520 linhas `real_2025` (4 arquivos) citam o IPCA no texto da fonte e a tabela 1737 no endereço; 0 das linhas nominais citam |
| **D4** rótulo da mediana | **Corrigido** | "Mediana das capitais na comparação", com o n na coluna "Capitais na mediana" (25, 26, 26, 26, 25 por habitante; 0, 26, 26, 26, 26 na cobertura) |
| **D5** marca de base que não identifica a base | **Corrigido em parte** | Coluna "Base do denominador" por ano nos 24 CSV de série conferidos (12 medidas, capital e mediana): igual à gold em 112 de 112 linhas (`dados_reavaliacao3_serie_csv_base_do_denominador.csv`); vazia onde não há denominador populacional; cobertura mostra as três bases do Ministério; a taxa de ICSAP com denominador do RIPSA fica sem base e com marca única (série do RIPSA contínua, coerente com os valores) e com denominador do OBEE mostra as três. Resta T3: a marca de Campo Grande 2021 é "sim" ao lado de uma base "anterior ao Censo" |
| **D6** nota de natureza de Florianópolis; legenda da mediana | **Corrigido** | A nota diz "24 linhas" (2022) e "30 linhas" (2023) "sem natureza da despesa identificável", "saldo líquido (créditos menos débitos) R$ 0,00", que a soma identificada "coincide com a DCA" e que mesmo assim "a abertura completa não é verificável". Refiz no MSC do seed: 24 e 30 linhas, créditos iguais a débitos (R$ 24.464.371,33 e R$ 25.218.185,26), saldo 0,00. A legenda da cobertura diz "Nos anos com mediana, ela usa as mesmas 26 capitais" (2021 não tem mediana); a de despesa por habitante diz que o conjunto muda de 25 a 26. Há uma asserção nova em teste |
| **D7** documentos | **Corrigido em parte** | Corretos agora: gold de 6,3 MB (arquivo de 6.268.843 bytes), 154 testes Python e 2.762 de vitest (conferi os dois), termo 35.842 no exemplo da cobertura (1.723 × 3.500 + 336 × 1.750 + 160 × 2.625 + 35.842 = 7.074.342), hash e contagem de observações em `CATALOGO_COBERTURA_FORMULAS.md` e `CONTINUIDADE.md`. Seguem: `README.md` (linha 12) e `CONTINUIDADE.md` (linha 9) apontam para `MATRIZ_DE_AVALIACAO.md`, que não existe; o exemplo de ICSAP continua sem a soma por sexo e faixa etária (T4) |
| **D8** páginas oficiais repetidas; IBGE na taxa de ICSAP | **Corrigido** | 72 CSV conferidos (52 baixados da interface, entre eles as variantes de moeda real e de denominador do OBEE, e 20 estáticos): nenhum endereço repetido, marcador ou célula sem endereço. Com o denominador do Ministério (padrão) a taxa de ICSAP lista só a página do RIPSA, no CSV do recorte, da série e da tabela; com o denominador do OBEE lista também as duas páginas do IBGE |
| **D9** parâmetros inválidos na URL | **Não alterado** (declarado) | Como na Reavaliação 2 |
| **G** Panorama: links "Baixar a série completa (CSV)" e "Fonte e como reproduzir" por medida | **Corrigido** | Em cada um dos 7 cartões: CSV estático da medida (200; 151 a 484 KB), link para `/metodos#reproducao` (âncora existe) e alvo de 44 px de altura. Resta T6: o destino é o mesmo para as 7 medidas |
| **G** entrada: linha "Fontes" por tema | **Corrigido** | Saúde: "Tesouro Nacional (Siconfi), Ministério da Saúde (SIOPS, CNES, Relatório APS e RIPSA) e IBGE (população e IPCA)", igual às capturas do manifesto. Educação: "Tesouro Nacional (Siconfi), INEP (Censo Escolar, Ideb e Saeb) e IBGE (população e IPCA)"; não verifiquei o módulo de Educação e o manifesto dele também traz a OCDE (T7) |
| **G** Comparar | **Corrigido pelo D2** | CSV da medida e da série já traziam páginas, captura, versão e hash; a tabela agora também. A página continua sem link direto de fonte e reprodução no corpo (só na ficha, no rodapé e no menu) |

### 10.3 Matriz de notas atualizada

Avaliador: avaliador independente de dados e método (agente Claude, contexto limpo). Inspeção heurística de um agente, sem usuários nem especialistas; nenhuma nota passa de 9,2.

| Página | Critério | Nota anterior (Reavaliação 2) | Nota nova | Justificativa da mudança | Evidência |
| --- | --- | --- | --- | --- | --- |
| Panorama | E | 8,6 | 8,8 | Capitais fora da comparação agora aparecem no resumo com o motivo (Macapá 2025); extremos, faixa central e n de 7 de 7 cartões iguais à gold. Continua sem razão agregada e sem história própria na página (T6 e 10.5) | `dados_reavaliacao3_verificacoes_novo_build.csv` |
| Panorama | F | 8,8 | 8,8 | Sem mudança líquida: a linha de exclusão ajuda, mas as fichas abertas dali têm as frases imprecisas de T1 | T1 |
| Panorama | G | 8,3 | 8,8 | Cada medida tem "Baixar a série completa (CSV)" e "Fonte e como reproduzir"; a ficha traz fontes, páginas oficiais, datas de coleta, fórmula e cobertura. Descontos: destino genérico do link, sem histórico de revisões, referência do Brasil fora dos CSV (T5, T6) | `dados_reavaliacao3_panorama_links_de_dados.csv` |
| Panorama | K | 9,0 | 8,9 | Deslocamento de 46 px do conteúdo sob o primeiro cartão a 1440 px (CLS 0,0037, repetível; antes 0,0007) e links e linha novos sem teste automático (T8). Valores todos iguais à gold | 10.1 e T8 |
| Gastos | E | 9,2 | 9,2 | Sem mudança; D4 corrigido (rótulo da mediana), nada novo na página | 10.1 |
| Gastos | F | 9,0 | 9,0 | Nota de Florianópolis refeita e verificada contra o MSC (+); ficha de despesa por habitante com a frase imprecisa de T1 (−) | D6, T1 |
| Gastos | G | 8,9 | 9,0 | População de 2023 e IPCA corrigidos nos CSV estáticos (D1, D3), hash e receita reproduzem, dicionário completo (73 linhas), 20 trilhas corretas, três consultas ao vivo novas iguais. Descontos menores: rótulo da relação de 2023 (T2) e histórico de revisões (T5) | `dados_reavaliacao3_csv_exportados.csv` |
| Gastos | K | 9,1 | 9,0 | Valores iguais à gold em tudo o que conferi e suíte completa aprovada; baixa 0,1 porque as colunas novas dos CSV não têm teste (T8) | 10.1 |
| Rede e APS | E | 8,9 | 8,9 | Sem mudança | 10.1 |
| Rede e APS | F | 8,9 | 8,8 | Achei frases imprecisas nas fichas de UBS e equipes e da cobertura (T1), que a Reavaliação 2 não viu; M03 e a regra de 2021 seguem não confirmadas | T1 |
| Rede e APS | G | 8,7 | 8,9 | População legível nos CSV estáticos (denominador das três medidas por 10 mil); base do denominador por ano nos CSV de série (cobertura com as três bases); trilhas e hash corretos | `dados_reavaliacao3_serie_csv_base_do_denominador.csv` |
| Rede e APS | K | 9,0 | 9,0 | Sem mudança | 10.1 |
| Atendimento e resultados | E | 8,9 | 8,9 | Sem mudança; a taxa tem Brasil (1.026) e Brasil sem as 26 capitais (1.095) que refiz do seed; a participação de ICSAP não tem referência nacional | 10.2 |
| Atendimento e resultados | F | 8,8 | 8,8 | Sem mudança; universo de COB.2.01 continua não confirmado | 10.6 |
| Atendimento e resultados | G | 8,7 | 8,9 | CSV do recorte, da série e da tabela listam só a página do RIPSA com o denominador do Ministério e as do IBGE só com o do OBEE (D8); trilhas de ICSAP e planos conferidas com os originais. Descontos: exemplo de ICSAP sem a soma por sexo e faixa (T4) e referência do Brasil fora dos CSV (T6) | `dados_reavaliacao3_csv_exportados.csv` |
| Atendimento e resultados | K | 9,0 | 9,0 | Sem mudança | 10.1 |
| Comparar capitais | E | 8,9 | 8,9 | Sem mudança | 10.1 |
| Comparar capitais | F | 8,9 | 8,9 | Sem mudança | 10.1 |
| Comparar capitais | G | 8,6 | 8,8 | O CSV da tabela passou a trazer páginas oficiais, data de captura e versões (D2). Descontos: a tabela não traz fórmula nem numerador e denominador (estão no CSV da medida) e a página não tem link de fonte e reprodução no corpo | D2 |
| Comparar capitais | K | 9,0 | 9,0 | Sem mudança; 1.300 e 260 células iguais à gold | 10.1 |
| Dados e métodos | E | 8,8 | 8,8 | Sem mudança | 10.1 |
| Dados e métodos | F | 8,8 | 8,7 | A seção Indicadores reproduz as fichas com as frases imprecisas de T1 | T1 |
| Dados e métodos | G | 8,8 | 8,9 | Quadro "O módulo em números" (conferido), documentos de apoio corrigidos em parte, CSV estáticos completos. Descontos: sem histórico de revisões (só "revisão 1"), rótulo da relação de 2023 e links quebrados nos documentos do repositório (T2, T4, T5) | 10.2 |
| Dados e métodos | K | 9,0 | 9,0 | Sem mudança; 28 medições limpas, links sem quebra | 10.1 |
| Entrada `/eficiencia-estatal` | E | 8,5 | 8,5 | Sem mudança | texto da página conferido |
| Entrada `/eficiencia-estatal` | F | 8,8 | 8,8 | Sem mudança | idem |
| Entrada `/eficiencia-estatal` | G | 8,8 | 8,9 | Linha "Fontes" por tema, correta para Saúde; para Educação não verifiquei o módulo e a OCDE falta (T7). Mantém data de última captura igual ao manifesto | 10.2 |
| Entrada `/eficiencia-estatal` | K | 9,0 | 9,0 | Sem mudança; LCP de 76 a 140 ms, sem erro | 10.1 |

Médias: E 8,86 (Reavaliação 2: 8,83); F 8,83 (8,86); G 8,89 (8,69); K 8,99 (9,01). Média por página: Panorama 8,83 (8,68); Gastos 9,05 (9,05); Rede e APS 8,90 (8,88); Atendimento e resultados 8,90 (8,85); Comparar capitais 8,90 (8,85); Dados e métodos 8,85 (8,80); Entrada 8,80 (8,78). Menor nota por página: Panorama 8,8; Gastos 9,0; Rede e APS 8,8 (F); Atendimento e resultados 8,8 (F); Comparar 8,8 (G); Métodos 8,7 (F); Entrada 8,5 (E). Combinações em 9,0 ou mais: 9 de 28.

### 10.4 Bloqueios remanescentes

**Nenhum.** Conferi de novo a lista da rubrica: valor incorreto (8.110 de 8.135 checagens iguais, as 25 diferenças explicadas e documentadas; nenhum valor mudou no ciclo); comparação materialmente incompatível (as três bases da população e da referência do Ministério estão marcadas e bloqueadas nas variações; T1 e T3 são imprecisões de texto e de marca, não comparações indevidas na interface); despesa do município como gasto total (não); razão despesa por atendimento ou usuário (não); ausência tratada como zero (não; células sem dado vazias nos 1.300 valores da tabela e nota própria para o zero observado); exclusão no gráfico mas não no resumo ou CSV (15 recortes, 5 tabelas e 24 séries consistentes, e o Panorama agora também mostra a exclusão); ressalva essencial escondida (não); afirmação causal ou julgamento (busca sem ocorrência na Reavaliação 2; os textos novos deste ciclo são descritivos); nota, ranking, semáforo, DEA, estimativa de desperdício ou recomendação de corte (nenhum); Distrito Federal misturado ou sem motivo (não); dado pessoal (nenhum); barreira a tarefa essencial (66 links internos e 7 downloads do Panorama respondem).

### 10.5 Problemas que permanecem ou são novos

Numeração própria desta reavaliação (T1 a T9). Gravidade máxima: baixa.

**T1. Baixa (nova; pré-existente, não vista antes). Frases imprecisas nas fichas sobre a troca de base da população.**
Onde: `pipeline/eficiencia_saude/catalogo_indicadores.json` (linhas 163, 588, 743 e as ressalvas das fichas de UBS e de equipes por 10 mil, e a comparação da cobertura); aparecem em "Sobre este dado" (Panorama, Gastos, Rede e Comparar) e na seção Indicadores de Dados e métodos.
Evidência: a ficha de despesa por habitante diz "Variações que envolvem 2021 ou 2023 são bloqueadas: a base populacional muda", e as de UBS e equipes "Variações que envolvem 2021 ou 2023 misturam mudança de base populacional" e "2021 e 2023 têm base populacional distinta". Pela implementação e pelas notas, estão bloqueadas 2021 para 2022 e 2023 para 2024; a variação de 2022 para 2023 envolve 2023 e é permitida (mesma população do Censo 2022), e a de 2024 para 2025 também. Na ficha da cobertura, "a população de referência ... muda a cada janeiro" não vale para dezembro de 2023 e dezembro de 2024 (mesma população, variação de 0,0% nas 26 capitais). Reproduzir: abrir "Sobre este dado" de despesa por habitante no Panorama e comparar o item 12 com a linha contínua de 2022 a 2023 em `/gastos?med=despesa_hab&vis=evolucao`.
Correção: "Variações de 2021 para 2022 e de 2023 para 2024 são bloqueadas: a base da população muda. De 2022 para 2023 e de 2024 para 2025 a base é a mesma"; na cobertura, "a população de referência é a que o Ministério adota para o ano; dezembro de 2023 e dezembro de 2024 usam a mesma"; teste que compare o texto das fichas com as marcas da gold.

**T2. Baixa (nova). A população de 2023 é rotulada como "relação do DOU de 31/08/2023", mas os valores vêm do PDF do Censo 2022 de 22/12/2023.**
Onde: nota e `fonte` da população de 2023 (gold, CSV estático, ficha); manifesto do seed (`ibge_populacao_relacao_2023`).
Evidência: o manifesto diz que o arquivo usado é "POP2022_Municipios_Primeiros_Resultados_20231222.pdf" (pasta "Resultados_da_2a_apuracao_20231027") e que "o arquivo da relação do DOU não foi baixado (ibge.gov.br responde 403)". Baixei esse PDF: as 26 capitais coincidem com a população de 2022 e 2023 do módulo. A população de referência do Ministério (origem DOU) coincide em 25 de 26, e em Porto Alegre é 1.332.833 contra 1.332.845 no módulo (`dados_reavaliacao3_populacao_2022_2023_vs_censo.csv`). A nota afirma que a relação de 31/08/2023 já trazia a segunda apuração, cuja pasta é de 27/10/2023, depois do DOU. Efeito: 12 habitantes (0,0009%) em uma capital, invisível na exibição; o problema é o rótulo da procedência.
Correção: chamar a população de 2023 de "Censo 2022, resultado de 22/12/2023 (conferido com o SIDRA 4714)", dizer que a relação do DOU não foi obtida e que difere em Porto Alegre, ou obter a relação.

**T3. Baixa (resíduo de D5). A marca de base de Campo Grande 2021 contradiz a coluna de base ao lado.**
Onde: CSV de série de Campo Grande em despesa por habitante (e `quebra_serie` estático).
Evidência: 2021 e 2022 têm marca "sim", embora a coluna "Base do denominador" mostre "estimativa anterior ao Censo 2022" e "Censo 2022"; as demais capitais têm "nao" em 2021. A marca mistura perímetro com base; a interface não liga 2021 a 2022 porque 2021 está fora da comparação, mas quem aplica a regra do CSV ("mesma marca = comparável") erra.
Correção: derivar a marca da base e guardar o perímetro em outra coluna; teste "marcas iguais em anos consecutivos implicam bases iguais".

**T4. Baixa (resíduo de D7). Documentos do repositório.**
`README.md` (linha 12) e `CONTINUIDADE.md` (linha 9) apontam para `MATRIZ_DE_AVALIACAO.md`, que não existe; o exemplo de ICSAP de `VALIDACOES_E_REPRODUCAO.md` não mostra a soma por sexo e faixa etária. Correção: criar o arquivo ou retirar os links; completar o exemplo.

**T5. Baixa (nova). Sem histórico de revisões.**
Onde: Dados e métodos, "Atualidade e versões": "Versão do catálogo: 09/10/2026, revisão 1 ... Hash dos dados: ea1565fee6907c1a".
Evidência: o hash dos dados teve quatro valores no mesmo dia (f111efb2ef09c540, ce882081d96f44d5, 159b76024a953f4d e ea1565fee6907c1a, este último só por uma nota) e a página não lista o que mudou em cada versão, o que a rubrica pede em G. O módulo ainda não foi publicado em produção, o que atenua. Correção: tabela curta "Histórico de revisões" com data, `hash_dados` e o que mudou (dados, método, texto).

**T6. Baixa (nova). Destino único do link "Fonte e como reproduzir" e referências do Brasil fora dos CSV.**
Onde: Panorama (7 cartões); `saude_referencias_capitais.csv`.
Evidência: os 7 links vão para `/metodos#reproducao`, seção geral; as trilhas por medida estão lá, mas sem âncora por medida. As referências do Brasil (cobertura 99,14%; ICSAP 1.026 e 1.095) só existem na tela e no JSON da gold; o CSV de referências cobre só os grupos de capitais. Correção: âncora por indicador (`#reproducao-sau-aps-cobertura-potencial`) e uma linha de Brasil no CSV de referências, com fonte e captura.

**T7. Baixa (não verificada). A linha "Fontes" de Educação na entrada não cita a OCDE.**
O manifesto de Educação traz a OCDE (Education at a Glance, tamanho de turma e despesa por estudante) e o código usa essas referências internacionais; não verifiquei o módulo de Educação nem se aparecem nas páginas. Se aparecem, a linha deve citá-la.

**T8. Baixa (nova). Deslocamento de layout no Panorama e falta de teste para as mudanças do ciclo.**
Onde: Panorama a 1440 px: o texto "Menor: ... Maior: ...", a linha de exclusão, os links de dados e o cartão seguinte sobem 46 px a cerca de 250 ms (a altura do gráfico só é definida depois da montagem): CLS 0,0037, repetível nas quatro medições (nas demais rotas, 0). No ciclo, o arquivo de testes do vitest não mudou e o de Python ganhou uma asserção: não há teste para as colunas novas do CSV da tabela e da série, os links de dados do Panorama, a linha "Fontes" da entrada nem a linha de capitais fora do Panorama. Correção: reservar a altura do gráfico; testes de contrato dessas saídas.

**T9. Baixa (informativa). A nota de Florianópolis não diz o valor bruto.**
O saldo líquido zero esconde R$ 24.464.371,33 (2022) e R$ 25.218.185,26 (2023) de créditos e de débitos sem natureza (5,2% e 4,8% do total da DCA). Dizer o bruto deixa o leitor julgar a relevância.

**D9 (aberto, declarado pelo executor).** Parâmetros inválidos (`med=foo`, `cap=distrito-federal`) permanecem na URL; a página mostra o padrão sem NaN.

#### O que falta para cada nota abaixo de 9,0

| Página | Critério | Nota | O que falta para 9,0 |
| --- | --- | --- | --- |
| Panorama | E | 8,8 | Razão agregada e evolução da mediana por medida, ou atalho para a visão Evolução do recorte, ou registro expresso de por que o resumo só traz mediana e faixa |
| Panorama | F | 8,8 | Corrigir T1; confirmar o universo de COB.2.01 com a ficha técnica do RIPSA; revisão externa das regras aceitas |
| Panorama | G | 8,8 | Destino específico do link de reprodução, referências do Brasil exportáveis e histórico de revisões (T5, T6) |
| Panorama | K | 8,9 | Eliminar o deslocamento de 46 px e testar os links e a linha de exclusão novos (T8) |
| Rede e APS | E | 8,9 | Corrigir T1 e T3; mediana de 2021 segue sem existir por regra documentada |
| Rede e APS | F | 8,8 | Corrigir T1; explicar com a fonte a diferença de contagem de M03 em cinco capitais; checar a regra de 2021 (NT 2/2025) com a área técnica do Ministério |
| Rede e APS | G | 8,9 | Histórico de revisões e referências do Brasil exportáveis (T5, T6) |
| Atendimento e resultados | E | 8,9 | Referência nacional para a participação de ICSAP (a fonte permite: 1.643.747 de 11.438.662 internações em 2021) |
| Atendimento e resultados | F | 8,8 | Confirmar com a ficha técnica do RIPSA que o universo de internações de COB.2.01 é o de MRB.4.02 (mesmo tipo de AIH); revisão externa |
| Atendimento e resultados | G | 8,9 | Exemplo de ICSAP com a soma por sexo e faixa etária (T4); referência do Brasil fora dos CSV (T6) |
| Comparar capitais | E | 8,9 | Sem lacuna específica identificada além de T1 e da ausência de revisão externa; mostrar a razão agregada junto da mediana do recorte seria o próximo passo |
| Comparar capitais | F | 8,9 | Corrigir T1 e T3 (a evolução das capitais escolhidas herda a marca) e as pendências de F da Rede |
| Comparar capitais | G | 8,8 | Link de fonte e reprodução no corpo da página; fórmula e numerador e denominador no CSV da tabela ou aviso de onde estão |
| Dados e métodos | E | 8,8 | Exemplo reproduzível de mediana e razão agregada de um recorte, com n e capitais; explicar as marcas de base dos CSV (T3) |
| Dados e métodos | F | 8,7 | Corrigir T1 e T2; M03 e as regras aceitas com validação externa |
| Dados e métodos | G | 8,9 | Histórico de revisões, rótulo da população de 2023 e documentos do repositório (T2, T4, T5) |
| Entrada `/eficiencia-estatal` | E | 8,5 | Universo, anos cobertos e número de indicadores por tema na própria entrada (hoje só "26 capitais" e "anos em cada medida") |
| Entrada `/eficiencia-estatal` | F | 8,8 | Nenhuma lacuna própria da entrada; depende de fechar T1 e as pendências de método que ela resume (COB.2.01, M03) |
| Entrada `/eficiencia-estatal` | G | 8,9 | Confirmar e completar a linha de Educação (T7) e linkar o histórico de revisões (T5) |

### 10.6 Limitações da reavaliação

* Inspeção heurística de um agente, no build servido às 17h27 UTC do dia 09/10/2026 (HEAD `f3188a9b1`; a mudança posterior `8f034c07e`, de apresentação, não estava no build); desempenho de laboratório, sem estrangulamento, no mesmo ambiente do servidor.
* A recomputação independente usa o mesmo seed do executor (682 de 682 hashes do manifesto conferem); a independência de fonte vem das conferências ao vivo e dos arquivos originais: DCA, grupos de referência, retrato do CNES, MRB.4.02, COB.2.01 e COB.5.01 do RIPSA, o PDF do Censo 2022 do IBGE (22/12/2023) para a população de 2022 e 2023, e três consultas ao vivo novas.
* Não verificado: que o universo de internações de COB.2.01 seja o de MRB.4.02 (conferi os números e a ordem de grandeza, não a ficha técnica); a explicação de M03 para as cinco capitais com contagens diferentes do CNES; as regras de negócio aceitas do documento do executor (contas da MSC, regra do último bimestre do Anexo 12); a relação do DOU de 31/08/2023 e as duas páginas do IBGE citadas (403 com desafio anti robô); `next build`, `tsc` e a regressão visual de Educação; o módulo de Educação (a linha "Fontes" dele); a leitura integral das 23 fichas (li as frases de comparação e as ressalvas das cinco ligadas à base da população e à taxa de ICSAP).
* Não avaliei A a D, H a J nem li o relatório do avaliador de experiência; observei as correções de aparência só quando afetam dados e método.
* Não houve usuários, especialistas nem revisão externa; as notas valem para o estado observado e nenhuma passa de 9,2.
* Evidências: `evidencias/dados_reavaliacao3_*.csv` (recomputação, população contra o PDF do IBGE, CSV de série com a base do denominador, exportações, links de dados do Panorama e verificações do novo build).


## 11. Reavaliação 4 (final)

Data: 09/10/2026, depois do quarto ciclo de correções do executor (rodada 1, ciclo 4); as notas desta seção são as finais do módulo. Avaliador: o mesmo avaliador independente de dados e método (agente Claude, contexto limpo), sem leitura do `avaliador-experiencia.md`. Li a seção 7 de `CORRECOES.md` (mapa do executor, sem notas) só para saber o que procurar e verifiquei cada linha de forma independente, no build servido em `http://localhost:3111` (processo `next start` iniciado às 18h15 UTC, build das 18h15) e nos arquivos. Estado verificado: HEAD `28f7c5ec9`, gold `hash_dados` `6a4bac828fb3918d`, 8.777 observações, `versao_codigo` `gerador-bc610c11ef07`, `gerado_em` 2026-10-09T17:57:12Z, 21 validações (S01 a S16 e M01 a M05). Refiz todas as capturas contra esse processo.

**Resultado em uma linha da reavaliação:** T4, T6 e T9 estão corrigidos; T1, T2, T3, T5 e T8 em parte; T7 não foi alterado (o executor o declarou); **não resta nenhum bloqueio** e **nenhum defeito de gravidade média**: sobram oito problemas baixos (U1 a U8), o mais relevante é que três trechos de texto sobre a troca de base da população ainda contradizem as marcas (U1). Médias por critério: E 8,97; F 8,91; G 8,99; K 9,09 (Reavaliação 3: 8,86; 8,83; 8,89; 8,99). Dezoito das 28 combinações de página e critério chegam a 9,0 ou mais; dez ficam entre 8,8 e 8,9 (seção 11.5 diz o que falta a cada uma). A meta de 9,0 em cada critério e página **não foi atingida**: em F cinco das sete páginas ficam abaixo de 9,0 (nenhuma passa de 9,1), e as pendências de F dependem de **revisão externa** (11.6).

### 11.1 Verificações de regressão

| Verificação | Resultado |
| --- | --- |
| `python3 -m unittest pipeline.tests.test_eficiencia_saude` | 62 testes, OK (15,6 s); eram 57 |
| `npx vitest run src/tests/obee-saude.test.ts` | 79 testes, OK; eram 70 |
| Suíte vitest completa e testes Python de Educação e Saúde | 143 arquivos, 2.772 testes aprovados e 1 ignorado; 159 testes Python: iguais ao que `VALIDACOES_E_REPRODUCAO.md` diz |
| Reconstrução em cópia temporária fora do repositório (`python3 -m pipeline.eficiencia_saude.run`) | 8.777 observações, `hash_dados` 6a4bac828fb3918d reproduzido, `versao_codigo` igual; as 22 seções comparáveis da gold iguais às publicadas (só diferem os carimbos de tempo e o commit da proveniência); nos 24 CSV estáticos só a coluna `dados_gerados_em` difere (9.691 de 340.959 células) |
| Receita do `hash_dados` da página | Reproduz 6a4bac828fb3918d; sem `ensure_ascii=False` sai 15e302efd8528717. Recalculei o hash das observações de cada uma das 7 versões da gold no git: igual ao do meta em 7 de 7 |
| Recomputação independente a partir do seed bruto (todas as capitais e anos) | 8.135 checagens, 8.110 iguais, 25 diferentes e as mesmas explicadas (23 de cobertura 2021 pela NT 2/2025; 2 de natureza de Florianópolis). Nenhum valor mudou em relação ao ciclo 3: 188 observações com nota ou registro revisados, 0 com valor diferente (`evidencias/dados_reavaliacao4_recomputacao_resumo.csv`) |
| Conferência da despesa e perímetro, refeitas do seed (DCA, RREO e MSC) | Situação e marca de perímetro iguais ao CSV nos 130 pares; só Campo Grande 2021 tem perímetro distinto (MSC com R$ 74.451.127,64 de intraorçamentárias) (`dados_reavaliacao4_conferencia_perimetro.csv`) |
| Consistência entre superfícies | Páginas de exploração: 15 de 15 recortes sem divergência de n, mediana e capitais fora. Comparar: 10 recortes de painel e CSV da medida (260 células) e tabelas de 2021 a 2025 baixadas do site (5 × 26 × 10 = 1.300 células) iguais à gold, com células sem dado vazias. CSV de série: 24 arquivos, 112 linhas, valor, n e base do denominador iguais à gold |
| Razão agregada exibida; composições agregadas | 24 de 24 combinações; 15 de 15 blocos |
| Panorama: extremos, faixa central, n e exclusão em 7 cartões | 7 de 7 iguais à gold; a linha "Fora da comparação: Macapá (AP), conferência pendente ..." confere |
| Trilhas de reconstrução de São Paulo | 20 de 20, mesmos valores já conferidos; 20 âncoras `trilha-...` existem |
| Desempenho em laboratório (7 rotas, 320, 390, 768 e 1440 px, 28 medições) | 0 erros ou avisos de console, 0 px de rolagem horizontal, LCP de 72 a 220 ms, CLS no máximo 0,0037 (Panorama a 1440 px, repetível; ver U5) |
| Links | 67 links internos sem quebra |
| Consulta ao vivo nova | Relatório APS Brasil dez. 2021: 87,91%, capacidade 186.077.438, população 211.664.078, igual à referência nacional do CSV. A consulta ao SIOPS respondeu 500 neste ambiente: não verificada agora (a da primeira rodada vale) |

Resumos em `evidencias/dados_reavaliacao4_verificacoes_novo_build.csv`.

### 11.2 Estado de cada achado

| Achado | Estado | Verificação independente |
| --- | --- | --- |
| **T1** frases sobre a troca de base | **Corrigido em parte** | Fichas de despesa por habitante, UBS por 10 mil, equipes por 10 mil e cobertura potencial reescritas e coerentes com as marcas da gold: despesa, UBS e equipes têm marcas falso, verdadeiro, verdadeiro, falso, falso em todas as 26 capitais, logo 2021 para 2022 e 2023 para 2024 são bloqueadas e 2022 para 2023 e 2024 para 2025 não; a cobertura tem verdadeiro, verdadeiro, falso, falso, verdadeiro, logo as três bases são dezembro de 2021 e 2022, dezembro de 2023 e 2024 e dezembro de 2025, como diz a ficha. Os avisos do período e as frases da Evolução na interface também coincidem. **Resta U1**: a ficha da população, a matriz de fontes F02 e a ficha da taxa de ICSAP ainda têm frases que contradizem as marcas. O teste novo exige duas frases nas fichas reescritas e proíbe três nas demais; não pega esses resíduos (`dados_reavaliacao4_frases_contra_as_marcas.csv`) |
| **T2** procedência da população de 2023 | **Corrigido em parte** | O registro das 26 observações de 2023 diz "IBGE, Censo Demográfico 2022 (segunda apuração), Primeiros Resultados de População, tabela municipal de 22/12/2023 ..."; a nota diz que os valores são os dessa tabela, iguais ao SIDRA 4714 e à população de 2022, e que "a relação publicada no DOU em 31/08/2023 não foi obtida"; o nome da fonte no CSV estático também. Refiz contra o PDF do IBGE (ciclo 3): 26 de 26 iguais. **Resta U2**: rótulo "(relação de 2023)" na base, identificador `censo_relacao_dou_2023`, endereço da relação do DOU, ficha da população e documento |
| **T3** marca de base e de perímetro | **Corrigido em parte** | Os 20 `sau_*.csv` têm `quebra_perimetro`. Campo Grande 2021: `quebra_serie` nao e `quebra_perimetro` sim; 2022: sim e nao; as demais capitais têm perímetro nao em todas as linhas. Nos 6.573 pares de anos consecutivos dos 20 arquivos, marcas iguais nunca coincidem com bases diferentes e nenhuma mudança de base fica sem marca diferente (`dados_reavaliacao4_marcas_base_e_perimetro.csv`). Em despesa por habitante a regra vale nas 260 linhas (26 capitais × 5 anos × 2 componentes). A interface não liga 2021 a 2022 em Campo Grande (nem em despesa total: a linha começa em 2022 e a frase diz "de R$ 1,62 bilhão em 2022 para R$ 1,82 bilhão em 2025"). **Resta U3** |
| **T4** exemplo de ICSAP; links para a matriz | **Corrigido; link no estado em que está** | Exemplo de São Paulo 2024 refeito no `mgdi_ms_qu3.csv` original do RIPSA: 24 células (2 sexos × 12 faixas), numerador 83.391, denominador 11.895.578, taxa 701,0252; a coluna `celulas_sexo_faixa` do seed é 24. `MATRIZ_DE_AVALIACAO.md` **não existe** na hora da verificação; `README.md` (linha 12) e `CONTINUIDADE.md` (linha 9) apontam para ele, e `CORRECOES.md` diz "Matriz escrita". Registrado como está, a pedido: o arquivo será escrito depois desta reavaliação |
| **T5** histórico de revisões | **Corrigido em parte** | Tabela "Histórico de revisões (6 versões dos dados)" em Dados e métodos, recolhida. Contra o git (7 commits tocaram a gold; o de 14h43 repete o hash do de 14h34): hash e número de observações iguais em 6 de 6 (8.721, 8.751, 8.777 × 4), horas conferem com `gerado_em`. As contagens citadas conferem (30 e 26 observações novas; 78, 6 e 188 alteradas). **Resta U4**: duas descrições imprecisas (`dados_reavaliacao4_historico_de_revisoes_vs_git.csv`) |
| **T6** destino do link e CSV de referências nacionais | **Corrigido** | Em cada um dos 7 cartões do Panorama o link "Fonte e como reproduzir" leva a `/metodos#trilha-sau-...` da própria medida (7 de 7: âncora existe, a trilha abre e recebe foco, o título da trilha é o indicador do cartão). `saude_referencias_nacionais.csv`: 14 linhas (norma de 15%, 5 de cobertura do Brasil e 8 de ICSAP), valor igual à gold e ao meu recálculo do seed em 14 de 14 (cobertura contra os dezembros do Relatório APS do Brasil; ICSAP do Brasil e do Brasil sem as 26 capitais contra o MRB.4.02 nacional); fonte, registro e hash em todas, página oficial e data em 13 (a norma não tem); as 20 colunas estão no dicionário (94 linhas, todas as colunas dos 24 CSV cobertas). Link na página de Dados e métodos responde 200 |
| **T7** OCDE na linha de Educação | **Não alterado** (declarado) | Conferi a linha "Cobertura" da entrada de Educação contra a gold de Educação (só leitura): 26 entes, despesa e matrículas de 2021 a 2025, Ideb de 2005 a 2025 bienal: igual. Não verifiquei se a OCDE aparece nas páginas de Educação |
| **T8** CLS do Panorama; testes das mudanças | **Corrigido em parte** | Testes novos cobrem o histórico, o resumo do recorte, a cobertura da entrada, as trilhas, as marcas, as referências nacionais e as fichas (Python 62, vitest 79; suíte completa passa). O deslocamento de 46 px no Panorama a 1440 px **continua**: CLS 0,0037, o mesmo de antes (U5) |
| **T9** valor bruto na nota de Florianópolis | **Corrigido** | Refiz no MSC do seed: 24 linhas (2022) e 30 (2023) sem natureza; créditos R$ 24.464.371,33 e R$ 25.218.185,26, débitos iguais, saldo R$ 0,00; 5,2% e 4,8% da DCA (R$ 466.493.256,91 e R$ 524.465.670,09). A nota traz esses números e que a abertura segue não verificável |
| Entrada: linha "Cobertura" por tema | **Corrigido** | Saúde: "26 capitais, com o Distrito Federal fora e o motivo à vista; despesa e aplicação em ações e serviços públicos de saúde de 2021 a 2025; unidades, equipes e cobertura em dezembro de 2021 a 2025; internações por condições sensíveis à atenção primária de 2021 a 2024; 20 indicadores publicados com ressalvas": igual à gold (períodos financeiros e de dezembro 2021 a 2025, resultados 2021 a 2024, 20 indicadores publicáveis, 3 não). Educação: igual à gold de Educação |
| D9 parâmetros inválidos na URL | **Não alterado** (declarado) | Como antes: `med=foo` e `cap=distrito-federal` seguem na URL, a página mostra o padrão sem NaN |

### 11.3 Matriz de notas final

Avaliador: avaliador independente de dados e método (agente Claude, contexto limpo). Inspeção heurística de um agente, sem usuários nem especialistas externos; nenhuma nota passa de 9,2.

| Página | Critério | Nota anterior (Reavaliação 3) | Nota nova | Justificativa da mudança | Evidência |
| --- | --- | --- | --- | --- | --- |
| Panorama | E | 8,8 | 8,8 | Sem mudança | 11.1 |
| Panorama | F | 8,8 | 8,9 | As fichas das medidas do cartão (despesa por habitante, UBS, equipes, cobertura) agora coincidem com as marcas; falta a da taxa de ICSAP (U1) | T1 |
| Panorama | G | 8,8 | 9,0 | O link de cada cartão abre a trilha da própria medida (7 de 7); referências do Brasil exportáveis e conferidas (14 de 14); histórico de revisões; dicionário completo. Descontos: rótulo da população de 2023 e descrições do histórico (U2, U4) | `dados_reavaliacao4_panorama_trilhas.csv`; `dados_reavaliacao4_referencias_nacionais.csv` |
| Panorama | K | 8,9 | 9,0 | Testes novos para as mudanças dos ciclos 3 e 4 e suíte completa aprovada; o deslocamento de 46 px (CLS 0,0037) continua e impede nota maior | U5 |
| Gastos | E | 9,2 | 9,2 | Sem mudança | 11.1 |
| Gastos | F | 9,0 | 9,1 | Ficha de despesa por habitante coerente com as marcas; marca de perímetro separada e refeita do seed nos 130 pares; nota de Florianópolis com o bruto, conferida. Resta a ficha da população (U1) e as regras aceitas sem validação externa | `dados_reavaliacao4_conferencia_perimetro.csv` |
| Gastos | G | 9,0 | 9,1 | Procedência da população de 2023 corrigida no registro, na nota e na fonte do CSV; trilhas com âncora por medida; histórico; referências nacionais. Descontos pequenos: U2 e U4 | T2, T5, T6 |
| Gastos | K | 9,0 | 9,1 | Tudo o que conferi igual à gold e testes novos para as colunas e textos do ciclo | 11.1 |
| Rede e APS | E | 8,9 | 9,0 | Fichas de UBS, equipes e cobertura coerentes com as marcas; base do denominador por ano e marcas sem violação em 6.573 pares | `dados_reavaliacao4_marcas_base_e_perimetro.csv` |
| Rede e APS | F | 8,8 | 8,9 | T1 fechado nas três fichas da Rede. Faltam a causa de M03, a regra de 2021 (NT 2/2025) e a validação externa | T1 |
| Rede e APS | G | 8,9 | 9,0 | Histórico, referência do Brasil em CSV (cobertura 5 de 5 conferidas), âncora de trilha por medida | T5, T6 |
| Rede e APS | K | 9,0 | 9,1 | Testes novos; sem erro | 11.1 |
| Atendimento e resultados | E | 8,9 | 8,9 | Sem mudança; a participação de ICSAP segue sem referência nacional | 11.5 |
| Atendimento e resultados | F | 8,8 | 8,8 | Sem mudança; a ficha da taxa traz o intervalo de 2,6% a 10,1% que vale só para 2022 (U1) e o universo de COB.2.01 segue não confirmado | U1 |
| Atendimento e resultados | G | 8,9 | 9,0 | Exemplo de ICSAP com a soma das 24 células conferido no arquivo original; referências nacionais de ICSAP (8 de 8) em CSV com fonte e captura; trilha própria | T4, T6 |
| Atendimento e resultados | K | 9,0 | 9,1 | Testes novos; 104 de 104 valores do RIPSA; sem erro | 11.1 |
| Comparar capitais | E | 8,9 | 9,0 | O resíduo que eu apontava (T1 e T3) está fechado nas fichas e nas marcas; 1.300 e 260 células iguais à gold | T1, T3 |
| Comparar capitais | F | 8,9 | 9,0 | A evolução das capitais escolhidas usa as marcas de base e de perímetro corretas; fichas coerentes | T3 |
| Comparar capitais | G | 8,8 | 8,9 | Histórico e referências em CSV. Segue sem link de fonte e reprodução no corpo da página e sem fórmula na tabela | 11.5 |
| Comparar capitais | K | 9,0 | 9,1 | Testes novos; sem divergência | 11.1 |
| Dados e métodos | E | 8,8 | 8,9 | O dicionário agora explica as duas marcas (`quebra_serie` e `quebra_perimetro`) e a base por ano; falta o exemplo reprodutível de mediana e razão agregada | T3 |
| Dados e métodos | F | 8,7 | 8,8 | Quatro fichas corrigidas; ainda trazem frases em desacordo a ficha da população, a matriz F02 (na própria página) e a ficha de ICSAP (U1) | U1 |
| Dados e métodos | G | 8,9 | 9,0 | Histórico de revisões com hash e observações exatos; quadro, trilhas com âncora, dicionário de 94 linhas, CSV de referências nacionais. Descontos: U2, U4 e o link para a matriz, ainda sem arquivo | T4, T5 |
| Dados e métodos | K | 9,0 | 9,1 | Testes novos; 28 medições limpas; 67 links sem quebra | 11.1 |
| Entrada `/eficiencia-estatal` | E | 8,5 | 9,0 | A lacuna que eu apontava (universo, anos e número de indicadores) está fechada e conferida com as duas golds | `dados_reavaliacao4_verificacoes_novo_build.csv` |
| Entrada `/eficiencia-estatal` | F | 8,8 | 8,9 | T1 em grande parte fechado; a entrada resume pendências externas (COB.2.01, M03) | 11.6 |
| Entrada `/eficiencia-estatal` | G | 8,9 | 8,9 | Sem mudança líquida; a linha de Educação (T7) segue sem a OCDE e não conferida com o módulo de Educação | T7 |
| Entrada `/eficiencia-estatal` | K | 9,0 | 9,1 | Teste da linha de cobertura; estática, sem erro, LCP de 72 a 112 ms | 11.1 |

Médias: E 8,97 (Reavaliação 3: 8,86); F 8,91 (8,83); G 8,99 (8,89); K 9,09 (8,99). Média por página: Panorama 8,93 (8,83); Gastos 9,13 (9,05); Rede e APS 9,00 (8,90); Atendimento e resultados 8,95 (8,90); Comparar capitais 9,00 (8,90); Dados e métodos 8,95 (8,85); Entrada 8,98 (8,80). Menor nota por página: Panorama 8,8 (E); Gastos 9,1; Rede e APS 8,9 (F); Atendimento e resultados 8,8 (F); Comparar 8,9 (G); Métodos 8,8 (F); Entrada 8,9 (F e G). Combinações em 9,0 ou mais: 18 de 28.

### 11.4 Bloqueios remanescentes

**Nenhum.** Conferi de novo a lista da rubrica: valor incorreto (8.110 de 8.135 checagens iguais, as 25 diferenças explicadas e documentadas; nenhum valor mudou no ciclo); comparação materialmente incompatível (as três bases da população e da referência do Ministério estão marcadas e bloqueadas nas variações, na interface e nos CSV; U1 e U3 são imprecisões de texto e de marca, não comparação indevida); despesa do município como gasto total (não); razão despesa por atendimento ou usuário (não); ausência tratada como zero (não; células sem dado vazias nos 1.300 valores da tabela); exclusão no gráfico mas não no resumo ou CSV (15 recortes, 5 tabelas e 24 séries consistentes, e o Panorama mostra a exclusão com o motivo); ressalva essencial escondida (não); afirmação causal ou julgamento (nenhuma ocorrência nos textos novos); nota, ranking, semáforo, DEA, estimativa de desperdício ou recomendação de corte (nenhum); Distrito Federal misturado ou sem motivo (não); dado pessoal (nenhum); barreira a tarefa essencial (67 links e os downloads do Panorama respondem).

### 11.5 Problemas que permanecem ou são novos

Numeração própria desta reavaliação (U1 a U8). Gravidade máxima: baixa.

**U1. Baixa (resíduo de T1). Três trechos ainda contradizem as marcas de base.**
Onde: (a) ficha de `ctx.populacao.residente`, campo `comparacao` (`catalogo_indicadores.json`, linha 51), mostrada em Dados e métodos: "Variações entre 2021 e os anos seguintes, e as que envolvem 2023, misturam mudança de base populacional"; (b) matriz de fontes F02, campo `fundamento`: "A população de 2021 é estimativa pré Censo e a de 2023 é censitária; as variações que as envolvem são bloqueadas", presente em `matriz_fontes.py`, na gold, em `saude_matriz_de_fontes.csv`, em `CATALOGO_COBERTURA_FORMULAS.md` e na seção "Decisões sobre as fontes" da página; (c) ficha de `sau.icsap.taxa`: "A população do Ministério é 2,6% a 10,1% maior que a do Censo 2022 nas capitais".
Evidência: a variação de 2022 para 2023 envolve 2023, usa a mesma população do Censo (marcas iguais) e não é bloqueada, em (a) e (b); em (c) o intervalo vale só para 2022: em 2023 é de 3,5% a 11,1%, em 2021 vai de −10,7% a +5,9% contra a estimativa anterior ao Censo e em 2024 é 0%. O teste novo exige duas frases nas fichas reescritas e proíbe três nas demais ("2021 ou 2023", "2021 e 2023 têm base populacional distinta" e "muda a cada janeiro"), e não acha esses trechos. Reproduzir: abrir Dados e métodos, seção Indicadores e Decisões sobre as fontes, e comparar com a linha contínua de 2022 a 2023 em `/gastos?med=despesa_hab&vis=evolucao`.
Correção: (a) "Variações de 2021 para 2022 e de 2023 para 2024 misturam mudança de base populacional; de 2022 para 2023 e de 2024 para 2025 a base é a mesma"; (b) o mesmo texto; (c) dizer o ano do intervalo ou dar o de cada ano; estender o teste para varrer todas as fichas e a matriz contra as marcas.

**U2. Baixa (resíduo de T2). Procedência da população de 2023 ainda com marcas do rótulo antigo.**
Onde: `base_populacional` "Censo 2022, população de 31 de julho de 2022 (relação de 2023)" (182 observações da gold e 182 linhas dos CSV estáticos, e o texto das páginas de 2023); `tipo_populacao` `censo_relacao_dou_2023`; `fonte_url` das 26 linhas de 2023 do CSV da população, que aponta a página da relação do DOU (37734) e não o arquivo usado; ficha da população, `localizacao_registro`: "... e relação da população dos municípios de 2023 (Diário Oficial da União, 31/08/2023)" sem dizer que não foi obtida; `VALIDACOES_E_REPRODUCAO.md` linha 44: "a relação do DOU de 2023 repete a de 2022 nas 26 capitais", afirmação sobre arquivo não obtido (a referência do Ministério, de origem DOU, difere do módulo em Porto Alegre: 1.332.833 contra 1.332.845). A página de Dados e métodos de Educação, com o mesmo seed, ainda diz "relação do DOU de 31/08/2023" e bloqueia a variação de 2022 para 2023 (regra própria de Educação; o texto de Educação não foi alterado e está fora do meu escopo).
Correção: trocar o rótulo por "Censo 2022, resultado de 22/12/2023 (população de 2022 repetida em 2023)", renomear o tipo, apontar o endereço da página dos resultados do Censo, corrigir a ficha e a linha 44; registrar a diferença de Educação.

**U3. Baixa (resíduo de T3). A marca de perímetro não está em todos os lugares em que ela se aplica.**
Onde: (a) o CSV de série baixado pela interface tem "Marca de base" e "Base do denominador" mas não tem coluna de perímetro; para despesa total de Campo Grande todas as marcas são "nao" e só "Na comparação = não" e a nota em 2021 alertam; (b) `sau_despesa_subfuncao.csv` e `sau_despesa_natureza.csv` (valores em R$ da mesma DCA de Campo Grande 2021) têm `quebra_perimetro` nao e `elegivel_comparacao` nao, enquanto a despesa total e por habitante têm sim.
Evidência: a regra do dicionário ("marcas iguais e `quebra_perimetro` igual") não é suficiente nesses dois arquivos de subfunção e natureza nem no CSV da interface; a elegibilidade protege.
Correção: propagar a marca às linhas derivadas da DCA (subfunção, natureza) e acrescentar a coluna "Marca de perímetro" ao CSV de série.

**U4. Baixa (resíduo de T5). Descrições imprecisas no histórico de revisões.**
Onde: Dados e métodos, "Histórico de revisões", linhas 2, 3 e 6.
Evidência: a linha 2 (14h34) diz "campos revisados em 661 observações de UBS", mas o que mudou foram os **valores** de 661 observações (531 contagens de UBS por componente, 125 razões por 10 mil e 5 com estado e elegibilidade; variação relativa mediana de 106%, por exemplo São Paulo 2023, gestão municipal, de 29 para 491); a linha 3 (16h06) diz "campos revisados em 1.025 observações (marcas de base, notas e registros)", mas foram 1.044 observações alteradas, em base populacional (1.014), marca de quebra (390), nota (164), nota material (9) e conferência (4), sem alteração de registro; a linha 6 não traz a hora (a gold é de 17h57 UTC). O hash e o número de observações de todas as linhas conferem.
Correção: "valores corrigidos em 661 observações de UBS" na linha 2, contagem e campos certos na linha 3 e a hora na linha 6.

**U5. Baixa (resíduo de T8). Deslocamento de layout no Panorama e teste estreito.**
Onde: Panorama a 1440 px: o texto "Menor: ... Maior: ...", a linha de exclusão, os links de dados e o cartão seguinte sobem 46 px a cerca de 270 ms (altura do gráfico definida depois da montagem): CLS 0,0037, igual ao ciclo 3 (nas demais rotas, 0). O teste de fichas contra marcas é estreito (U1).
Correção: reservar a altura do gráfico; ampliar o teste.

**U6. Baixa (T7, não alterado). A linha "Fontes" de Educação não cita a OCDE.**
O manifesto de Educação traz a OCDE (Education at a Glance) e o código usa as referências; não verifiquei o módulo de Educação nem se aparecem nas páginas. Se aparecem, a linha deve citá-la; a linha "Cobertura" de Educação também não menciona Saeb nem aprovação.

**U7. Baixa (informativa). `MATRIZ_DE_AVALIACAO.md` ainda não existe.**
`README.md` (linha 12) e `CONTINUIDADE.md` (linha 9) apontam para ele. A pedido da coordenação, registro o estado como está na verificação; o arquivo será escrito depois desta reavaliação.

**U8. Baixa (cosmética). Linha da norma sem página oficial nem data no CSV de referências nacionais.**
A linha `norma.minimo_asps_municipal` de `saude_referencias_nacionais.csv` tem `paginas_oficiais` e `data_captura` vazias (o endereço do Planalto está dentro de `fonte` e o registro diz "texto lido em 09/10/2026"). Correção: preencher os dois campos.

#### O que falta para cada nota abaixo de 9,0

| Página | Critério | Nota | O que falta para 9,0 |
| --- | --- | --- | --- |
| Panorama | E | 8,8 | Razão agregada e evolução da mediana por medida, ou atalho para a visão Evolução do recorte, ou registro expresso de por que o resumo só traz mediana e faixa |
| Panorama | F | 8,9 | Corrigir a ficha da taxa de ICSAP e a matriz (U1); validação externa das regras aceitas e do universo de COB.2.01 |
| Rede e APS | F | 8,9 | Explicar com a fonte a diferença de contagem de M03 em cinco capitais; checar a regra de 2021 (NT 2/2025) com a área técnica do Ministério; fechar a ficha da população (U1) |
| Atendimento e resultados | E | 8,9 | Referência nacional para a participação de ICSAP (a fonte permite: 1.643.747 de 11.438.662 internações em 2021) |
| Atendimento e resultados | F | 8,8 | Corrigir a ficha da taxa (U1); confirmar com a ficha técnica do RIPSA que o universo de internações de COB.2.01 é o de MRB.4.02 (mesmo tipo de AIH); revisão externa |
| Comparar capitais | G | 8,9 | Link de fonte e reprodução no corpo da página, como no Panorama; fórmula e numerador e denominador no CSV da tabela ou aviso de onde estão |
| Dados e métodos | E | 8,9 | Exemplo reproduzível de mediana e razão agregada de um recorte, com n e capitais |
| Dados e métodos | F | 8,8 | Fechar U1 na ficha da população, na matriz F02 e na ficha de ICSAP; M03 e as regras aceitas com validação externa |
| Entrada `/eficiencia-estatal` | F | 8,9 | Fechar U1 e as pendências externas que a entrada resume (COB.2.01, M03) |
| Entrada `/eficiencia-estatal` | G | 8,9 | Conferir e completar a linha de Educação com o módulo de Educação (U6) |

### 11.6 Limitações

* Inspeção heurística de um agente, no build servido às 18h15 UTC do dia 09/10/2026 (HEAD `28f7c5ec9`); desempenho de laboratório, sem estrangulamento, no mesmo ambiente do servidor.
* A recomputação independente usa o mesmo seed do executor (682 de 682 hashes do manifesto conferiram na Reavaliação 3, o seed não mudou); a independência de fonte vem dos arquivos originais e das consultas ao vivo: DCA, grupos de referência, retrato do CNES, MRB.4.02, COB.2.01 e COB.5.01 do RIPSA, PDF do Censo 2022 do IBGE, Relatório APS (Brasil e São Paulo) e SIDRA. A consulta ao SIOPS falhou nesta rodada (500).
* **Não verificado, e que exige revisão externa** (nenhuma nota passa de 9,2 por isso): (1) que o universo de internações de COB.2.01 seja o de MRB.4.02 (conferi os números e a ordem de grandeza, não a ficha técnica; precisa do RIPSA ou do Ministério da Saúde); (2) a explicação de M03 para as cinco capitais com contagens diferentes do CNES (precisa do CNES); (3) as regras de negócio aceitas do documento do executor, contas da MSC e regra do último bimestre do Anexo 12 (precisa de especialista em contabilidade pública e do SIOPS); (4) a fórmula da NT 2/2025 e a regra de 2021 do Relatório APS (precisa da área técnica do Ministério); (5) a relação do DOU de 31/08/2023 e as duas páginas do IBGE citadas (403 com desafio anti robô; precisa do IBGE); (6) usabilidade com pessoas, que esta avaliação não cobre.
* Não verificado por limite de escopo: `next build`, `tsc` e a regressão visual de Educação; o módulo de Educação além da linha "Cobertura" da entrada; a leitura integral das 23 fichas (li as quatro reescritas, a da população e a da taxa de ICSAP, e varri por expressão todo o texto da gold, do código e dos documentos).
* Não avaliei A a D, H a J nem li o relatório do avaliador de experiência; observei as correções de aparência só quando afetam dados e método.
* Por engano, rodei três scripts na raiz do repositório e criei ali `agg.log`, `cc.log` e `razao2.log` (ignorados pelo git); removi os três, e nenhum arquivo versionado fora de `docs/obee/saude/avaliacao/rodada-1/` foi alterado por mim.
* Não houve usuários, especialistas nem revisão externa; as notas valem para o estado observado.
* Evidências: `evidencias/dados_reavaliacao4_*.csv` (recomputação, conferência de perímetro, marcas de base e perímetro, frases contra as marcas, histórico contra o git, referências nacionais, trilhas do Panorama, exportações e verificações do novo build).
