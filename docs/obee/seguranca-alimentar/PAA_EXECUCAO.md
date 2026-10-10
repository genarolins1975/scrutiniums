# PAA — suplemento de registros anuais de fornecedores e pagamentos

O arquivo adicional `public/eficiencia/seguranca-alimentar/paa.json` amplia a dimensão de aquisição e abastecimento com dados publicados no serviço oficial MI Social do MDS. Mantém intactas as sete bases anteriores, e não substitui a MUNIC: execução registrada e declaração de presença de ação são conceitos diferentes.

## Origem e reprodução

```sh
python3 -m pipeline.eficiencia_alimentar.paa
# Nova coleta das consultas e fichas oficiais:
python3 -m pipeline.eficiencia_alimentar.paa --coletar
```

O script usa as referências dezembro de 2023, 2024 e 2025. As três consultas exatas ficam nas fontes do snapshot. Cada resposta contém os 5.571 documentos municipais encontrados; a coleta rejeita truncamento e chaves municipais duplicadas. Os códigos MI Social de seis dígitos são reconciliados à relação oficial atual de municípios do IBGE, preservada pelo observatório.

As respostas JSON e as fichas conceituais oficiais são salvas em gzip determinístico, em `brutos/mds-paa-*`. Os SHA-256 referem-se aos bytes originais descomprimidos. As fichas IN002 e IN003 são documentação, não conjuntos adicionais de valores a somar.

- [IN002 — fornecedores do PAA no ano](https://wiki-sagi.mds.gov.br/home/DS/PAA/I/IN002): modalidades Compra com Doação Simultânea e PAA-Leite; fonte SISPAA, conforme ficha.
- [IN003 — valores pagos aos fornecedores no ano](https://wiki-sagi.mds.gov.br/home/DS/PAA/I/IN003): pagamentos anuais dessas modalidades; SISPAA e planilhas de execução Conab, conforme ficha.

O serviço público fornece os campos `agricultores_fornec_paa_i` e `recur_pagos_agricul_paa_f`. São registros publicados nesse extrato, não uma conciliação de toda a execução nacional do PAA com relatórios de orçamento ou projetos aprovados. As fichas de sintaxe SQL retornaram restrição de acesso; não foram contornadas nem utilizadas como evidência.

## Conteúdo e cobertura

São dois indicadores, 33.594 observações e três referências anuais, com municípios, UFs e Brasil:

| Ano | Soma municipal de fornecedores registrados | Pagamentos registrados, R$ nominal | Municípios com campo disponível / universo da extração |
|---|---:|---:|---:|
| 2023 | 44.033 | 356.555.108,22 | 2.143 / 5.571 |
| 2024 | 82.573 | 794.399.458,23 | 3.212 / 5.571 |
| 2025 | 64.805 | 530.784.736,59 | 2.895 / 5.571 |

Campos ausentes permanecem `null`: não significam zero, inexistência de programa ou falta de agricultores no município. A cobertura varia entre anos e deve acompanhar gráficos, comparações e exportações. Os totais representam somas dos registros disponíveis e não um total nacional reconciliado com todas as fontes executoras.

Contagens anuais de fornecedores não são beneficiários consumidores nem pessoas únicas quando somadas entre municípios ou anos. Não existe deduplicação individual neste extrato agregado. A unidade apresentada é **registros de fornecedores**.

Pagamentos são valores nominais do respectivo ano; o script soma parcelas conhecidas usando Decimal e converte para número apenas ao final. Não são dotação, valor de projetos aprovados, volume de alimentos, toneladas ou quantidade de refeições. As modalidades não documentadas nas fichas não são incorporadas por inferência.

Os recortes por sexo foram investigados e excluídos: em 2024, as somas dos campos femininos e masculinos diferem em 42 do total geral disponível. Não se ajustou ou distribuiu essa diferença e não se publicou uma composição não reconciliada.

## Verificação e uso

`npx vitest run src/tests/alimentar-paa.test.ts` verifica hashes, integridade das respostas, reprodução de cada valor municipal, ausência sem substituição por zero e somas/cobertura dos agregados. A revisão independente deve confirmar o perímetro e os números antes de acrescentar o suplemento ao pacote de publicação.

A interface de aquisição e abastecimento deve separar o capítulo de registros anuais do PAA das ações autodeclaradas da MUNIC, identificando fonte, ano, cobertura, nominalidade e universo. Não inferir que o programa reduziu insegurança alimentar ou que a variação dos registros significa mudança proporcional de cobertura populacional.
