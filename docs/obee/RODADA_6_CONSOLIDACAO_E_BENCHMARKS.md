# Rodada 6: consolidação das comparações e dos benchmarks

Painel: Educação municipal nas capitais (`/eficiencia-estatal/educacao-municipal-capitais`). Pipeline `obee-0.2.0`, catálogo `2026-10-08.4`, metodologia 1.3, política de conferência 1.2. Data de referência das coletas e dos cálculos: 08/10/2026. Valores em R$ correntes, salvo indicação. Base de comparação ("antes"): `main` em `ac2eaf835`, que é também o que a produção serve.

Este documento separa **evidência** (o que foi lido, medido ou calculado, com fonte e data), **inferência** (o que se conclui da evidência) e **decisão** (o que o OBEE adotou). O que não foi acessado está declarado na seção 11.

## 1. Perguntas do cidadão que passaram a ter resposta mais completa

| Pergunta | Antes | Agora |
| --- | --- | --- |
| O que significa "despesa por matrícula"? | Rótulo de "rede própria", que a fonte não sustenta | Razão da despesa liquidada de aplicação direta por matrícula, com o que a modalidade 90 diz e não diz, e a parcela cujo beneficiário a MSC não identifica, medida em cada par |
| Por que a minha capital não tem valor por matrícula? | 28 pares sem valor | 7 pares sem valor, cada um com a causa documentada; 21 pares recuperados por correção de defeito do pipeline |
| Quanto o município gastou por habitante em 2023? | Sem valor, com a afirmação de que o IBGE não publicou população | Valor para as 26 capitais, com a população oficial do Censo 2022 rotulada como censitária e a limitação temporal à vista |
| Como a minha capital se situa frente ao país? | Sem referência nacional para a despesa por habitante | Mediana, média simples e razão agregada de 5.060 municípios com dados elegíveis (93,2% da população), calculadas pelo OBEE, com cobertura e exclusões |
| O que a OCDE diz sobre despesa por estudante e tamanho de turma? | Média publicada, mas membros inferidos por exclusão e despesa em recorte misto | Membros pela lista oficial de 38 países, despesa em instituições públicas, nível ISCED com a fonte do mapeamento do Brasil, média publicada preservada e conferida |
| De onde vem este número e quem o calculou? | Código identificado por commit e sufixo `+alterado` | Código gerador identificado pelo conteúdo, hashes das entradas e das saídas, classe da referência (oficial publicado, calculado pelo OBEE, contextual, incompatível) |

## 2. Decisões e antes/depois

| Item | Antes (rodada 5) | Depois (rodada 6) |
| --- | --- | --- |
| Identificador por matrícula | `edu.despesa.por_matricula_rede_propria` | `edu.despesa.aplicacao_direta_por_matricula`; o identificador antigo não foi reaproveitado, a ficha nova declara `substitui` |
| Pares capital × exercício com valor por matrícula | 102 de 130 | 123 de 130 |
| Valores por matrícula que mudaram em pares já publicados | não se aplica | 3 de 102, por saldo líquido da MSC: Rio Branco 2025 (R$ 15.887,04 para R$ 15.884,53), Belém 2024 (R$ 14.289,21 para R$ 14.279,05) e Curitiba 2023 (R$ 14.095,49 para R$ 14.095,49, diferença de centavos) |
| Despesa por habitante, 2023 | 0 de 26 | 26 de 26 |
| Referência nacional da despesa por habitante | nenhuma | 2025, 5.060 de 5.570 municípios |
| Membros da OCDE | inferidos por lista de exclusão | lista oficial de 38 países |
| Observações na gold | 8.487 | 9.137 |
| Alvo mínimo de toque dos botões | 32 px em parte dos controles | 44 px em todos |
| Identificação do código | `cd9cc563094b+alterado` | `gerador-` mais 12 caracteres do sha256 do conteúdo do código gerador |

## 3. Despesa por matrícula: o que a norma permite afirmar

### 3.1 Evidência

* A modalidade de aplicação (MA) é a etapa da natureza da despesa que indica se os recursos são aplicados diretamente pela unidade ou mediante transferência a outro ente ou entidade. A lista oficial tem 31 códigos e é idêntica, texto a texto, no Manual Técnico de Orçamento (MTO) de 2021, 2022, 2024 e 2025 e no Manual de Contabilidade Aplicada ao Setor Público (MCASP) da 8ª à 11ª edição. Não houve mudança de definição entre 2021 e 2025. Os códigos 43, 97 e 98 não são modalidades (são elementos).
* A modalidade 90 (aplicação direta) diz que a despesa é executada pela própria unidade. **Não diz quem recebe o serviço**: a aplicação direta inclui pessoal, material e contratação de serviços de terceiros (por exemplo, elemento 39), que podem atender a rede própria ou outra finalidade. A norma define a classificação para eliminar dupla contagem entre entes, não para atribuir despesa a beneficiários.
* 91 é intraorçamentária; 92 recursos recebidos por delegação (ações do ente delegante); 93 e 94 são compras de consórcio, desdobramento da 90; 67 parcerias público-privadas; 95 e 96 existem só para a saúde; 99 é "a definir".
* Fontes lidas: MTO 2021, 2022, 2024 e 2025 (6ª e 8ª edições), MCASP 8ª a 11ª edição, Anexo I da Portaria STN 642/2019 e leiautes da MSC de 2021 a 2026, Manual de Demonstrativos Fiscais 13ª edição, Fundeb Perguntas e Respostas (FNDE, outubro de 2021), Leis 14.113/2020, 9.394/1996, 4.320/1964 e CF art. 213. Prática de entes (Catalão, Porto Alegre, Rio de Janeiro) foi lida como prática, sem valor de norma.

### 3.2 Decisão

* O indicador passa a se chamar **razão da despesa liquidada de aplicação direta por matrícula da rede municipal**. "Por matrícula" e não "por aluno" (um aluno pode ter mais de uma matrícula).
* **Numerador**: função 12, contas de despesa liquidada da MSC de dezembro (6.2.2.1.3.03, .04 e .07), em saldo líquido, modalidades 90, 93 e 94, exceto subfunção 364 (ensino superior) e elementos 01, 03 e 05 do grupo 3.1 (inativos). **Fora**: 91, 92, 67, 95, 96, 99, transferências a instituições privadas (50, 60), a outros entes e consórcios (20 a 46, 70 a 76, 80).
* **Parcela de beneficiário indeterminado**: elementos 18, 39, 41, 45 e 48 (fora do grupo 3.1) e as compras de consórcio (93 e 94). Está dentro do numerador, medida em cada par e publicada. **Não há limite de aceitabilidade**: o OBEE não afirma que uma parcela de 10% ou de 30% torna o valor aceitável ou inaceitável. A escolha dos elementos é decisão do OBEE, fundamentada na descrição de cada elemento nos manuais; a MSC não permite verificá-la linha a linha.
* Modalidade fora da lista oficial ou linha sem natureza acima de R$ 1,00 por par impede a razão do par (nada é rateado).

### 3.3 Parcela indeterminada em 2025 (26 capitais, MSC de dezembro, função 12)

| Medida | Valor |
| --- | --- |
| Mínimo | 2,3% (Goiânia) |
| Mediana | 11,9% |
| Máximo | 27,9% (Aracaju) |

Inferência: o rótulo "rede própria" anterior atribuía à rede um numerador que, em 2025, contém entre 2% e 28% de despesa que a MSC não permite atribuir ao atendimento da rede. A razão continua útil como comparação de volume de aplicação direta por matrícula; não é custo por aluno.

## 4. Diagnóstico dos 28 pares MSC × DCA sem valor

Reprodutível com `python3 -m pipeline.eficiencia.diagnostico_pares` e publicado na gold (`diagnostico_pares_msc`) e em `edu_diagnostico_pares_msc.csv`. Cada par traz a DCA, a MSC em módulo, a MSC em saldo líquido, as diferenças pelas políticas 1.1 e 1.2, as linhas de natureza D, a razão MSC/DCA por função, o sha256 da resposta completa da MSC e sete hipóteses testadas (H1 a H7).

### 4.1 Evidência

* **21 pares: defeito do pipeline.** A MSC informa o valor em módulo e a natureza do valor (D débito, C crédito). As contas 6.2.2.1.3.xx são credoras: linha C soma, linha D subtrai. A política 1.1 somava todas as linhas em módulo e contava duas vezes a liquidação transferida de uma conta para outra no encerramento. Em saldo líquido a MSC fecha com a DCA nos 21 pares (Aracaju, Belém, Goiânia, Natal e Palmas em 2025 entre eles). A política 1.2 corrige isso sem ampliar tolerância, sem ratear e sem alterar dado oficial.
* **7 pares seguem sem reconciliação**, cada um com causa:

| Par | Causa registrada | Diferença da MSC contra a DCA |
| --- | --- | --- |
| São Luís 2022 e 2023 | MSC sem linhas da função 12 | 100% |
| Rio de Janeiro 2022 | Nenhuma linha da resposta traz função | 100% |
| Natal 2022 e 2023 | MSC abaixo da DCA em todas as funções | 23,8% e 83,7% |
| Rio de Janeiro 2021 | Em aberto: diferença sem causa identificada pelas hipóteses | 3,7% |
| Campo Grande 2021 | Perímetro: inclui intraorçamentárias; preservado como estava | 12,0% |

* Campo Grande 2021 permanece fora das comparações derivadas e Boa Vista 2024 mantém a ressalva da conferência com o RREO.

### 4.2 Decisão

Nenhum caso foi forçado. Para os 7 restantes, o dado que resolveria é a MSC retificada pelo ente ou a abertura da DCA por modalidade (hoje a DCA só abre por função e subfunção). Rio de Janeiro 2021 fica "em aberto": o diagnóstico exclui as hipóteses testadas, mas não identifica a causa.

## 5. População de 2023

### 5.1 Evidência

* A afirmação anterior, "o IBGE não publicou população municipal em 2023", estava incorreta como formulada. O IBGE não publicou **estimativa** para 2023; publicou, no DOU de 31/08/2023, a relação das populações dos municípios com base no Censo 2022 (segunda apuração, referência em 31 de julho de 2022, malha territorial de 30 de abril de 2023), adotada em substituição às estimativas de 2023 (Nota Metodológica do IBGE; relação do DOU lida a partir do arquivo de resultados do IBGE).
* Para as 26 capitais, a relação é igual à tabela 4714 do SIDRA (Censo 2022). Total do Brasil na segunda apuração: 203.080.756. Porto Velho traz nota de rodapé de população judicial (494.013), registrada.

### 5.2 Decisão

* 2023 usa a população da relação do DOU, com `tipo_populacao = censo_relacao_dou_2023`, rotulada como **censitária**, nunca como "população de julho de 2023".
* A despesa por habitante de 2023 existe para as 26 capitais, com `quebra_serie = verdadeiro`: o denominador é o mesmo de 2022, de modo que a variação 2022 para 2023 reflete só a despesa e não a população. A variação entre 2023 e 2021 ou 2024 também é bloqueada (outra base).
* A limitação temporal aparece na tela, no passaporte e em todos os downloads (campo `nota` e `tipo_populacao`).

## 6. Referência nacional calculada pelo OBEE

### 6.1 Evidência

* Não existe indicador oficial de despesa municipal em Educação por habitante (IBGE, INEP, STN e FNDE examinados na rodada 5). O OBEE passou a calcular a referência.
* Conceito idêntico ao das capitais: despesa liquidada na função 12 (DCA, Anexo I-E, exceto intraorçamentárias) ÷ população residente estimada do IBGE (SIDRA 6579) de 2025, com a mesma conferência (DCA × RREO do 6º bimestre, tolerância de R$ 1,00 ou 0,1% da DCA).
* Coleta: DCA e RREO de 5.570 municípios, município a município (a API do Tesouro não oferece a DCA em lote), 0 erros de coleta, com sha256 da resposta completa de cada ente.
* **Defeito encontrado e corrigido na própria rodada**: a primeira coleta consultava só o demonstrativo "RREO" e deixou 2.357 municípios sem conferência (cobertura inicial de 52,5% dos municípios). Municípios que optam pela publicação semestral entregam o "RREO Simplificado" (Anexo 02 idêntico). Foram lidos nele 2.311 municípios. A cobertura final é a abaixo; a primeira não foi publicada.

### 6.2 Resultado (exercício 2025)

| Grupo | Municípios | Mediana | Média simples | Razão agregada |
| --- | --- | --- | --- | --- |
| Municípios com dados elegíveis | 5.060 | R$ 2.125 | R$ 2.281 | R$ 1.720 |
| Elegíveis com 500 mil habitantes ou mais | 46 | R$ 1.188 | R$ 1.206 | R$ 1.323 |
| Elegíveis, exceto capitais | 5.034 | R$ 2.129 | R$ 2.286 | R$ 1.829 |
| Para comparação: 26 capitais | 26 | R$ 1.160 | R$ 1.243 | R$ 1.361 |

* Razão agregada: soma da despesa dividida pela soma da população **dos mesmos municípios elegíveis** (não pela população do Brasil).
* **Cobertura**: 5.060 de 5.570 municípios (90,8%), 93,2% da população e 94,1% da despesa declarada. **Exclusões** (510 municípios): 420 com DCA divergente do RREO acima da tolerância (sem reconciliação pela MSC em escala), 73 sem DCA, 16 sem RREO, 1 sem a linha da Educação. Nada é imputado.
* As 26 capitais entram no conjunto e reproduzem o indicador das capitais (validação V19).

### 6.3 Inferência e limites

* A mediana nacional está acima da mediana das capitais (R$ 2.125 contra R$ 1.160). Isso descreve a distribuição; não indica quem gasta mais ou melhor. Municípios pequenos têm despesa por habitante estruturalmente maior (rede e estrutura mínima divididas por poucos habitantes) e responsabilidades educacionais distintas. Por isso o painel mostra também o recorte de 46 municípios com 500 mil habitantes ou mais, definido antes de ver os valores, sem declará-lo grupo de pares.
* Rótulo público: "Cálculo do OBEE com dados do Siconfi/STN e do IBGE". Não é indicador do IBGE nem da STN. Entra na matriz de referências como **calculado pelo OBEE, comparabilidade direta**.
* Exercício único (2025). O mesmo cálculo para outros exercícios exige nova coleta de cerca de 45 minutos por exercício.
* Despesa por matrícula **não tem referência nacional calculada**: exigiria a MSC dos 5.570 municípios.

## 7. Benchmarks internacionais

### 7.1 Evidência (OCDE, Education at a Glance 2025, API SDMX; UNESCO UIS)

* ISCED do Brasil: 1º ao 5º ano é nível 1 (início aos 6 anos, duração de 5) e 6º ao 9º ano é nível 2 (início aos 11, duração de 4), conforme a planilha "ISCED 2011 Mapping Brazil" da UNESCO UIS (ano letivo de 2012 a 2013) e o diagrama do sistema educacional do Brasil da OCDE; creche e pré-escola são nível 0. O mapeamento é da UNESCO, não do INEP (o INEP não tem mapeamento próprio para a educação básica; a "Cine Brasil" cobre cursos de graduação).
* Membros da OCDE: 38, sem mudança desde a adesão da Costa Rica em 25/05/2021. Brasil, Argentina, Bulgária, Croácia, Peru e Romênia (candidatos) e China, Índia, Indonésia e África do Sul (parceiros-chave) não são membros. A lista foi lida em cópias do Internet Archive das páginas oficiais, porque oecd.org responde 403 a acessos automatizados.
* Média da OCDE: média simples (não ponderada) dos membros com dado. Recomputada pelo OBEE, confere com a publicada nas quatro séries exibidas.
* O valor do Brasil no recorte anterior (US$ 4.064, "despesa governamental em instituições públicas ÷ matrícula pública e privada") não era coerente com uma rede pública. O recorte coerente é INST_EDU_PUB.

### 7.2 Valores exibidos (2023, definitivos)

| Conjunto | Nível | Brasil | Média da OCDE (publicada) | Membros com dado |
| --- | --- | --- | --- | --- |
| Despesa por estudante, USD PPC, instituições públicas | ISCED 1 | 4.998,66 | 13.333,97 | 35 |
| Despesa por estudante, USD PPC, instituições públicas | ISCED 2 | 5.191,36 | 14.756,36 | 34 |
| Alunos por turma, instituições públicas | ISCED 1 | 20,91 | 20,80 | 34 |
| Alunos por turma, instituições públicas | ISCED 2 | 25,69 | 22,98 | 32 |

### 7.3 Decisão

* Permanece **contexto**: país e município são escalas diferentes, e o conceito de despesa e de turma da OCDE é outro. O painel não calcula diferença entre uma capital e esses valores.
* A média publicada é preservada; a recomputada serve de conferência. O texto do investimento por estudante do INEP passou a dizer "educação básica".
* O agregado ISCED 1 a 8 (inclui o ensino superior) e as instituições "públicas e privadas" saem da exibição; permanecem na gold.
* 2024 de tamanho de turma é preliminar na fonte; o painel prefere o dado definitivo mais recente (2023) e marca preliminar quando for o único.

## 8. Interface

* Referências ao lado do indicador: no cartão da despesa por habitante, a referência nacional calculada aparece junto do valor (mediana, razão agregada, cobertura, diferença descritiva em reais); na seção de referências, bloco completo com os três grupos, cobertura e exclusões por motivo.
* Classe de cada referência exibida: Oficial publicado, Calculado pelo OBEE com fontes oficiais, Contextual, Incompatível.
* Definição corrigida visível antes da interpretação: aviso de mudança de definição na seção de despesa por matrícula, texto de leitura do gráfico e do cartão com a parcela indeterminada.
* "Ponte" com 13 parcelas mutuamente exclusivas, entre elas a de beneficiário indeterminado, dentro do numerador.
* Alvos de toque: todos os controles com mínimo de 44 por 44 px (Passaporte, "Ver tabela", "Copiar link", resumos e botões de fechar). O Passaporte deixou de ter versão compacta.
* Payload do cliente: limite elevado de 650 kB para 700 kB (ponte com 13 parcelas e população de 2023), com justificativa no teste.

## 9. Proveniência e tolerâncias

* `meta.versao_codigo` = `gerador-` + 12 primeiros caracteres do sha256 dos `.py` de `pipeline/eficiencia` (sem seed e sem testes) e do catálogo, em ordem de caminho. Não depende do estado do git. O commit que incorpora a gold é posterior à geração e não pode constar nela; consta apenas o commit de partida e se havia código não commitado (`meta.proveniencia.git`).
* `meta.proveniencia` traz o hash do código gerador (e o número de arquivos), o hash do manifesto do seed (que registra o sha256 de cada captura), o hash dos dados de saída e o número de observações.
* **Tolerâncias**: a regra efetiva é uma só, definida em `pipeline/eficiencia/conferencia.py`: R$ 1,00 de arredondamento e 0,1% da DCA para diferença menor com nota. `derivados.py`, `diagnostico_pares.py`, `referencia_nacional.py`, a gold (`politica_conferencia`) e os documentos leem a mesma fonte. Nenhuma tolerância foi ampliada nesta rodada.

## 10. Produção, CI e prévia

* **Produção (verificada em 08/10/2026, https://scrutiniums.com/eficiencia-estatal/educacao-municipal-capitais, HTTP 200)**: serve o conteúdo da `main` em `ac2eaf835`. Gold com hash dos dados `68a5c8bcd6fa52f7`, código `cd9cc563094b+alterado`, catálogo 2026-10-08.3, gerada em 08/10/2026 18:30:54 UTC. Capital: todas as 26 aparecem no seletor. O texto de produção ainda diz que o IBGE não publicou população de 2023 e rotula o indicador por matrícula como "aplicação direta na rede própria". Nada desta rodada está em produção.
* O commit `cd9cc5630` citado no código de produção existe no histórico (pipeline e gold da rodada 5). O sufixo `+alterado` indicava mudança não commitada no momento da geração.
* **PR #117**: integrado (merge `62089e4a3`, 08/10/2026 18:43:43 UTC). CI do SHA `c3b311d98` concluído com sucesso (job `testes`, 18:37:14 a 18:42:46 UTC). A descrição foi atualizada de forma documental, sem reabrir o PR.
* **PR #118** (OBEE na home, seletor e rodapé): integrado (`ac2eaf835`).
* A autorização de merge da rodada 5 **não se estende** a esta rodada: nenhum merge nem publicação em produção foi feito.
* CI e prévia desta rodada: ver a descrição do novo PR (resultados vinculados ao SHA publicado).

## 11. Pendências, separadas por natureza

**Dependem de fonte externa ou de dado que não existe**
* MSC retificada ou DCA retificada pelos entes de São Luís (2022, 2023), Rio de Janeiro (2021, 2022), Natal (2022, 2023) e Campo Grande (2021); ou DCA aberta por modalidade de aplicação.
* Referência nacional de despesa por matrícula: exigiria a MSC de dezembro dos 5.570 municípios.
* Notas por país da OCDE (volume "Sources, Methodologies and Technical Notes", 403) e texto do Education at a Glance 2026.

**Dependem de acesso que não tive**
* oecd.org, doi.org e oecd-ilibrary (403 para acesso automatizado; usadas cópias do Internet Archive e a API SDMX).
* ibge.gov.br pelo WebFetch (403; o FTP e a biblioteca do IBGE responderam por `curl` com User-Agent). O arquivo da relação do DOU não foi baixado do Diário Oficial; foi lida a relação publicada pelo IBGE.
* Portaria Interministerial STN/SOF 163/2001 (texto original) e Portaria Conjunta 103/2021: a transcrição das modalidades é de segunda mão, dos manuais que a reproduzem. MDF 14ª e 15ª edições (visualizador em laço de redirecionamento) e decisões de TCEs (certificado, 403, 404).
* Servidor do INEP com erro de certificado no proxy (nota-país do EAG).

**Não executado**
* Revisão metodológica por terceiro independente. A recomputação independente é do mesmo autor do pipeline.
* Teste com leitor de tela real.
* Referência nacional para outros exercícios além de 2025.
* Limite de aceitabilidade da parcela indeterminada: **não definido por desenho**.

**Observação sobre a suíte de testes**: uma execução do Vitest numa sessão anterior teve uma falha não identificada, não reproduzida em cinco execuções seguintes.

## 12. Verificação desta rodada

Executada em 08/10/2026 sobre o build de produção local (`next build` e `next start`), com a gold regenerada e os arquivos de dados da branch.

| Verificação | Resultado |
| --- | --- |
| Pipeline (`python3 -m pipeline.eficiencia.run`) | 9.137 observações; nenhuma validação reprovada; V16 em "regra aplicada com pendências" (7 pares), V04, V14 em "aprovada com divergências documentadas"; V17, V18 e V19 aprovadas |
| Testes Python (`unittest discover`, `test_eficiencia*.py`) | 97 aprovados, incluindo os novos (baldes por modalidade, saldo líquido, diagnóstico dos pares, população 2023, referência nacional com municípios sintéticos e conteúdo publicado) |
| Vitest completo com `EXIGIR_BUILD_HTML=1` | 137 arquivos, 2.581 testes aprovados, 1 ignorado |
| `tsc --noEmit` e `npm run lint` | sem erros |
| Gate de HTML do CI | barrou a grafia "2012/13" em prosa (padrão legado de data); corrigida para "2012 a 2013" |
| Larguras 320, 390, 768 e 1440 px em 8 recortes (`larguras-axe.mjs`) | 32 de 32 sem estouro horizontal e com 0 violação axe (WCAG 2.2 AA). Uma regressão de 320 px (identificador novo, 351 de 320 px) foi encontrada e corrigida com quebra de palavra na ficha |
| Controles abaixo de 44 por 44 px | 372 controles medidos (botões, `summary`, seletores e campos) em 320, 390 e 1440 px: 0 abaixo de 44 por 44 px. Encontrados e corrigidos na rodada: resumos de validação e de trilhas (42 px de altura) e cabeçalhos ordenáveis da tabela (30 e 34 px de largura). Os campos de rádio ocultos são operados pelos rótulos, que passam na medição. Links no corpo do texto ficam fora da medição (exceção de alvo em linha da WCAG 2.2) |
| Interações reais (`interacoes.mjs`) | 39 de 39 |
| Recomputação independente (8 capitais, 2025) | sem divergências na despesa, população, despesa por habitante, matrículas e razão por matrícula. O código é do mesmo autor do pipeline: não é revisão externa |
| Capturas | `docs/obee/capturas/rodada-6/`: `antes-` (estado da `main`, capturado na rodada 5) e `depois-` |

Não executado: leitor de tela real; revisão externa; medição de desempenho (TBT) desta rodada.
