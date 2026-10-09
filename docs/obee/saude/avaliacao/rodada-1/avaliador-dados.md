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
