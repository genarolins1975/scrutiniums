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
