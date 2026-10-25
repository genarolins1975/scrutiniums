# Como o banco ganha ou perde dinheiro

Painel `/observatorio/bank-profit`, protegido por conta; aperitivo agregado em `/observatorio-do-credito`. A conexão oficial foi restabelecida em 25/10/2026. A coleta usa o proxy e TLS do ambiente, sem Olinda ou credenciais do Banco Central.

## Fonte, perímetro e reprodução

`pipeline/sources/ifdata_dre.py` descobre a DRE no catálogo oficial por nome e cadastro prudencial 1009: relatório 113 até 2024, 116 desde 2025. Filtra somente TD=C, sem somar membros individuais, conglomerados financeiros ou totais do SFN. A chave é C + (entidade − 1.000.000.000) com sete dígitos, conforme a tradução de entidades já usada pelo conector. O campo c33 mudou de formato em junho/2026 e não serve de chave histórica.

O snapshot `pipeline/seed/lucro_banco/originais.json.gz` conserva os registros oficiais dos conglomerados, catálogo, templates e info de quatro semestres (202412–202606). `manifesto.json` registra SHA-256 do snapshot e das respostas originais, URL e instante de coleta. O catálogo dinâmico conserva subtotais e filhos, mas a receita aditiva usa somente as rubricas contábeis declaradas, sem dupla contagem.

```sh
python3 -m pipeline.sources.ifdata_dre
python3 -m pipeline.lucro_banco_gold
python3 -m pipeline.lucro_banco_gold --check
```

A coleta é mensal ou manual em `atualizar-lucro-banco.yml`; snapshot e gold são publicados juntos somente após os testes. O pipeline diário também constrói a gold offline a partir do snapshot versionado. O grupo `lucro-banco` está no contrato de publicação seletiva. O build do site nunca consulta o BCB.

## Validação empírica

Os brutos estão em **reais**, embora a página do BCB divida por mil ao exibir. Zero numérico é preservado; valor ausente/null é não publicado. O fechamento tem tolerância absoluta de R$ 1, sem residual inventado. DRE incompleta ou divergente aparece em tabela, sem cascata.

| Conglomerado | Data-base | Lucro publicado, R$ (separadores internacionais) | Soma − lucro, R$ |
|---|---|---:|---:|
| ITAU - PRUDENCIAL (C0080099) | 202512 | 24,088,717,801.93 | -0.000101 |
| CAIXA ECONÔMICA FEDERAL - PRUDENCIAL (C0080738) | 202512 | 5,862,059,536.85 | 0.000020 |
| NU PAGAMENTOS - PRUDENCIAL (C0084693) | 202512 | 6,732,055,407.38 | -0.000000 |
| ITAU - PRUDENCIAL (C0080099) | 202606 | 24,670,305,939.70 | -0.000021 |
| CAIXA ECONÔMICA FEDERAL - PRUDENCIAL (C0080738) | 202606 | 6,585,794,275.93 | 0.000020 |
| NU PAGAMENTOS - PRUDENCIAL (C0084693) | 202606 | 4,093,040,225.39 | 0.000000 |

Conferência realizada diretamente nos arquivos oficiais em 25/10/2026, cobrindo banco grande de varejo, banco público e banco digital. As mesmas seis conferências viajam na gold e são testadas offline.

Rubricas desde 2025: rendas financeiras a–e (141825, 141830, 141835, 141836, 141837); captação g (141847); outros financeiros h–j (141848–141850); perdas esperadas f (141842); serviços l1/m/n (141852/141856/141857); demais pagamentos l2/l3 (141853/141854); pessoal/administração o/p (141858/141859); outras q/r/s/t/u (141860/141862/141863/141864/141865); IR/CSLL x (141868); participações y (141869); lucro z (141870). Os lids são resolvidos do info/template de cada data, não usados para procurar rubricas por tentativa.

O fluxo específico de perdas em operações de crédito é f3/lid141840; não confundir com o total de perdas esperadas f, que inclui outros ativos. A margem líquida financeira é k/141851 e a bruta é k−f. Ambas são níveis em R$, **não NIM** nem margem percentual sobre ativos rentáveis.

## Período e comparação

Março/setembro acumulam três meses; junho/dezembro, seis. O padrão de 12 meses soma dois semestres consecutivos do mesmo código prudencial e plano contábil. Uma lacuna não é preenchida; não há multiplicação por quatro. Estoques não são somados no TTM. A história semestral marca a mudança da Resolução CMN4.966 em 2025, sem linha ligando os planos.

O agregado TTM atual inclui 141 de 167 conglomerados cadastrados, apenas DREs conciliadas; o semestre tem seu próprio universo. Não é todo o SFN. Pares têm o mesmo TCB e segmento prudencial da instituição, mesma janela e DRE conciliada, excluindo o próprio banco. Medianas incluem somente valores publicados comparáveis.

## PDD estimada e simulador

O estoque absoluto de provisão lid140202 e o fluxo de crédito lid141840 são rateados sobre as modalidades PF/PJ dos relatórios123/128. Método primário: peso do vencido≥15 dias. Alternativo: peso do saldo total, no **mesmo universo elegível**. Modalidades sem vencido publicado ficam sem base; não recebem zero estimado. Subtotais são excluídos.

Quando há linhas sem base, a alocação integral é condicional ao universo elegível; não prova provisão nula fora dele. Sem denominador positivo, o valor permanece não alocado. A participação na carteira só é calculada se todos os saldos necessários forem publicados.

Cada método preserva o total em centavos (ou na precisão original maior): a diferença de truncamento vai à maior base, nunca a uma linha de peso zero. A faixa é sensibilidade entre dois modelos, **não intervalo de confiança**. Os mínimos/máximos de linhas diferentes não são aditivos. A soma deve ser conferida dentro de cada método.

Pesos da data-base atual também são usados no fluxo de 12 meses, hipótese explicitada na tela. Cobertura = provisão estimada/vencido. Estoque, fluxo, cobertura e participação estão separados na exportação, com fontes e períodos próprios.

O simulador mantém despesa/vencido constante em cada método, muda uma linha e mantém todas as demais rubricas e tributos fixos. O saldo vencido simulado fica entre zero e a carteira da linha. Não opera sem base ou sobre reversão positiva; não altera números publicados. Não representa migração de estágios, garantias, recuperações, crescimento, reação do banco ou efeitos fiscais. Atraso≥15 dias não é inadimplência>90 dias.

## Tarifas, lacunas e interface

Serviços = pagamentos + tarifas + outras rendas de serviços. A proxy serviços/receita operacional usa intermediação+serviços como denominador (mesmo conceito do modelo de negócio existente); denominador não positivo fica indisponível. A segunda razão usa pessoal+administração em magnitude.

O IF.data publica número de clientes de crédito ativo identificado no SCR (lids23380/113786). Esse universo não representa os pagantes de tarifas: **não se calcula tarifa por cliente com esse denominador**. Não há logos sem arquivo oficial e vínculo de marca comprovado.

A cascata oferece valores em reais e por R$100 de rendas, detalhe por teclado/clique e fontes nos títulos, detalhe e CSV. O denominador inclui câmbio e valor justo; a narrativa não chama tudo de juros. Modelos têm selo permanente e contorno tracejado. O simulador apresenta a faixa entre métodos. Português e inglês estão disponíveis nos controles do painel; nomes das rubricas em inglês vêm do catálogo oficial. A casca e a entrada do Crédito conservam o estado de tradução declarado pelo projeto.

A navegação continua com oito grupos; Instituições passa a ter oito páginas para incluir a DRE no lugar temático correto, com a mesma navegação responsiva da coleção. O limite específico foi atualizado no teste; outros grupos mantêm o orçamento anterior.

## Verificação

Os testes específicos incluem parser, semestralidade, ausência, reconciliação, conservação em carteiras sintéticas e reais, unidade da fonte, perímetro, TTM, simulação, seleção, teclado, exportação e acesso. Evidências e parecer visual ficam em `docs/ux-2026-10-25/lucro-do-banco/`. Os resultados finais dos comandos e do CI são registrados no PR.
