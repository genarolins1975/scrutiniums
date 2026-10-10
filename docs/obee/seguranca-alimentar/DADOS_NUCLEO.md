# Segurança Alimentar — dados do núcleo e reprodução

Os universos permanecem separados: EBIA é experiência de acesso aos alimentos apurada em domicílios da PNAD; CadINSAN é risco modelado em famílias selecionadas do Cadastro Único; MUNIC registra declarações municipais sobre instituições, equipamentos e ações. Não existe conversão automática entre esses conceitos.

## Arquivos e comandos

| Arquivo público | Conteúdo | Reprodução a partir da raiz |
|---|---|---|
| `snapshot.json` | EBIA, 2023 e 2024 | `python3 -m pipeline.eficiencia_alimentar.ebia` |
| `cadinsan.json` | Anexo municipal CadINSAN, janeiro de 2025 | `python3 -m pipeline.eficiencia_alimentar.cadinsan` |
| `sisan.json` | Instituições e equipamentos declarados na MUNIC 2024 | `python3 -m pipeline.eficiencia_alimentar.munic` |
| `aquisicao.json` | Aquisição e promoção do acesso em 2023, declaradas na MUNIC 2024 | Mesmo comando MUNIC |

Os arquivos estão em `public/eficiencia/seguranca-alimentar/`. Os scripts CadINSAN e MUNIC reutilizam os arquivos oficiais comprimidos já salvos; `--coletar` atualiza as respostas. O EBIA consulta a API SIDRA e preserva cada resposta e seus metadados. A extração municipal requer `openpyxl`; o CadINSAN requer também o utilitário `pdftotext` para extração textual reproduzível. Nenhum script produz dados demonstrativos em caso de falha.

Arquivos separados evitam transferir todas as observações municipais nas telas iniciais de EBIA. O consumidor deve selecionar apenas os dados pertinentes à rota e ao território.

## Contrato e rastreabilidade

Cada arquivo usa `{versao,capturadoEm,fontes,territorios,indicadores,observacoes,notas}`. As fontes identificam consulta, universo, referências, transformações, limitações e SHA-256. Os originais ficam em `brutos/`, comprimidos com gzip determinístico (`mtime=0`). O hash refere-se aos bytes **descomprimidos** da resposta ou arquivo original, não aos bytes gzip.

As observações distinguem `observado`, `calculado` e `ausente`; `null` não é zero. O rótulo observado significa valor transcrito da fonte, sem tornar uma estimativa modelada em aferição direta. A natureza modelada do CadINSAN acompanha nomes, universos e notas.

A chave inclui indicador, território, período, dimensão e grupo. Brasil usa código `1`; UFs usam códigos IBGE de dois dígitos; municípios usam sete dígitos. Grandes Regiões usam `regiao-1` a `regiao-5`, evitando colisão entre o código regional Norte e o código Brasil. Não combinar linhas de dimensões diferentes apenas porque ambas têm grupo Total.

## EBIA — PNAD Contínua

Foram capturadas as tabelas SIDRA 9552–9560 e 9562. O resultado contém 2.884 observações, 13 indicadores e dez fontes. A tabela 9552 alcança Brasil, cinco Grandes Regiões e 27 UFs, por área total, urbana e rural. Os recortes de sexo, cor ou raça, escolaridade e ocupação da pessoa responsável, renda e composição domiciliar são **nacionais**, segundo os níveis efetivamente disponíveis nas tabelas.

A unidade absoluta é mil domicílios particulares permanentes. Não equivale a moradores ou famílias. A classificação EBIA considera experiências de acesso aos alimentos nos três meses anteriores à entrevista e distingue segurança alimentar, insegurança leve, moderada e grave. Insegurança total não deve ser somada às suas parcelas.

A variável SIDRA 9784 representa composição dentro da categoria EBIA em várias tabelas. Por exemplo, a participação de responsáveis mulheres entre domicílios com insegurança grave não é a prevalência de insegurança grave entre domicílios chefiados por mulheres. Para evitar essa troca de denominador, este núcleo utiliza a contagem 162 e calcula:

`proporção = 100 × domicílios da classe / total de domicílios do mesmo território, ano e recorte`.

Numerador, denominador e fórmula acompanham cada razão. A apresentação usa uma casa decimal, com o arredondamento padrão Python (empates para o par). Contagens oficiais já arredondadas podem produzir pequenas diferenças de fechamento. O coeficiente de variação da contagem 5123 é preservado nas quantidades; não é reaproveitado como coeficiente da proporção calculada e não se inventam intervalos de confiança. Diferenças pequenas não demonstram significância estatística.

No SIDRA, hífen indica zero absoluto; `X`, `..` e `...` permanecem indisponíveis. Não há estimativa EBIA municipal neste conjunto. Um filtro estadual não pode exibir um recorte social nacional como se fosse local.

## CadINSAN — risco modelado

Fonte: [relatório oficial CadINSAN 2025, publicado em 2026](https://www.gov.br/mds/pt-br/Sisan/vigilancia-do-sisan/CADINSAN2025.pdf). O modelo desta edição usa a PNAD 2024 e a base do Cadastro Único de janeiro de 2025, selecionando famílias com atualização nos últimos 12 meses. O relatório municipal foi extraído por código IBGE e cinco campos numéricos; foram identificados 5.570 códigos únicos, sem linhas não interpretadas. A página do PDF é preservada no arquivo de extração.

São 27.990 observações em cinco indicadores: contagem e proporção de famílias em risco estimado considerando PBF, quantidade analisada e os dois valores do cenário sem PBF. Os municípios mantêm os números publicados. Brasil e UF são agregações calculadas do **anexo municipal**, com proporção dada pela razão entre contagens agregadas, sem média simples dos percentuais.

Existe uma diferença não reconciliada: o corpo do relatório informa 21.460.006 famílias selecionadas; os denominadores do anexo municipal somam 21.236.683. A diferença de 223.323 não foi imputada ou distribuída entre municípios. Os totais desta interface representam somente o anexo, não uma reprodução do total informado no corpo do relatório.

O cenário sem PBF desconsidera benefícios na modelagem; não é efeito causal observado nem contagem de famílias que efetivamente perderam benefícios. Em 270 municípios o valor desse cenário é menor que o cenário considerando PBF, como publicado. Não se corrigem esses casos nem se pressupõe monotonicidade causal. Alterações metodológicas entre edições impedem tratar 2024 e 2025 como série homogênea sem análise adicional.

CadINSAN não é aplicação municipal da EBIA, prevalência populacional ou diagnóstico individual. O modelo não representa todas as famílias inscritas nem todos os moradores.

## MUNIC — presença, equipamentos e ações

Fonte: [base oficial do Suplemento de Segurança Alimentar MUNIC 2024](https://ftp.ibge.gov.br/Perfil_Municipios/Seguranca_Alimentar_2024/Base_de_dados_Seguranca_Alimentar_MUNIC.xlsx). O arquivo integral e o dicionário são preservados. As 5.570 municipalidades prestam informações à pesquisa; recusa, desconhecimento e falta de resposta permanecem distintos de ausência declarada.

`sisan.json` contém 14 indicadores e 78.442 observações: órgão gestor, lei, plano, conselho, câmara intersetorial, fundo e presença/quantidade de restaurantes populares, cozinhas comunitárias, bancos de alimentos e centrais de recebimento da agricultura familiar sob responsabilidade municipal. A referência desses indicadores é a pesquisa MUNIC 2024. Presença de estrutura **não demonstra adesão ao SISAN**, funcionamento adequado, cobertura de beneficiários ou qualidade.

Presença no município é codificada como 1 para Sim e 0 para Não. Lei em trâmite não é lei existente; a resposta original permanece disponível. Quantidade recebe zero calculado quando a pergunta anterior declara explicitamente que o equipamento não existe e o item quantitativo é não aplicável. Quantidade desconhecida com existência declarada permanece `null`.

Nas agregações Brasil, UF e Região, a soma das respostas conhecidas é acompanhada de `municipiosComDado` e `municipiosUniverso`. Por exemplo, foram declarados conselhos em 2.851 municípios e planos em 394; a cobertura de respostas varia por indicador. Não dividir automaticamente a contagem pelo universo inteiro ignorando respostas ausentes.

`aquisicao.json` contém sete indicadores e 39.221 observações: aquisição pela agricultura familiar via PAA e PNAE, ações de acesso a alimentos, cestas, refeições prontas, ticket/vale e benefício monetário. A referência é **2023**, declarada na MUNIC 2024. São presenças de ações, não execução financeira, toneladas adquiridas, alimentação entregue ou eficácia. Um traço em subitem somente vira zero quando a pergunta anterior declara Não; se a resposta anterior é desconhecida, permanece ausência.

## Verificação e limites

`npx vitest run src/tests/alimentar-dados.test.ts` verifica hashes dos originais, chaves e referências, códigos regionais, denominadores EBIA, ausência de recortes estaduais fictícios, agregação CadINSAN, cenário publicado e somas/cobertura da MUNIC. A revisão independente reextraiu os 5.570 registros CadINSAN e confirmou as diferenças documentadas. A inspeção visual e funcional das telas é uma etapa adicional.

Este documento descreve o núcleo EBIA, CadINSAN e MUNIC. Bases de alimentação escolar, recursos, preços e acompanhamento de saúde adicionadas por outros módulos possuem proveniência e universos próprios; não devem ser agregadas como se medíssem a mesma entrega ou população.
