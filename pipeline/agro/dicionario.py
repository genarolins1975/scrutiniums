"""Dicionário de indicadores e condições: sem inventar medições bloqueadas."""
from .run import carregar_fontes

def indicadores(snapshot=None):
    if snapshot is None:
        from .run import normalizar
        manifest,fontes=carregar_fontes();snapshot=normalizar(manifest,fontes)
    sources={s['id']:s for s in snapshot['fontes']}
    specs=[
      ('credito.valor','Quanto crédito foi contratado?','R$ correntes','Soma do valor de contratos na janela completa','Valor de contratos','Não aplicável','credito','FonteRecursos nacional; municipal agregado para UF','BCB/MDCR, conforme finalidade e programa','2013-01 a 2026-08 (último parcial); janela 2025-08 a 2026-07','Brasil/mês e UF/janela','Não é desembolso, saldo ou custo fiscal.'),
      ('credito.contratos','Quantos contratos foram registrados?','contratos','Soma de cédulas registradas','Contratos','Não aplicável','credito','qtd','BCB/MDCR','Mesma janela do valor','Brasil/mês e UF/janela','Contratos não são beneficiários únicos.'),
      ('credito.finalidade','Para que foram contratados?','R$ correntes','Soma por finalidade no mesmo período','Valor por finalidade','Não aplicável','credito','custeio, investimento, comercializacao, industrializacao','Finalidades MDCR','2025-08 a 2026-07','UF/janela','Finalidade não mede resultado, custo da produção ou despesa fiscal.'),
      ('credito.ticket','Qual o valor médio por contrato?','R$/contrato','Valor contratado / quantidade de contratos > 0','Valor contratado','Contratos do mesmo recorte','credito','valor, qtd','MDCR','2025-08 a 2026-07','UF/janela','Não é renda do produtor ou média por beneficiário.'),
      ('credito.programa','Como o valor se distribui entre programas?','R$ correntes e contratos','Valores/contratos originais por programa; parcela = valor / total nacional','Valor do programa','Total no mesmo universo, quando percentual','credito','programas.itens; códigos de programa preservados','MDCR','2025-08 a 2026-07','Brasil/programa','Sem UF × programa × produto conjunto; Pronaf não identifica todo o universo familiar.'),
      ('credito.produto','Que item financiado aparece no recorte?','R$ correntes e contratos','Valores originais do item, sem somar os maiores como total','Valor do item','Não aplicável','credito','produtos.custeio e investimento; 15 maiores por finalidade','Nomes e finalidade na MDCR','2025-08 a 2026-07','Brasil/item financiado','Ausência no topo não é zero. Bovinos não separa corte e leite. Item financiado não é NCM de exportação.'),
      ('formal.estoque','Quantos vínculos da seção A aparecem no registro?','vínculos','Estoque publicado pela fonte','Vínculos','Não aplicável','formal','setores.cnae = A, estoque','CNAE 2.0, seção A','2026-07 (preliminar)','Brasil/mês','Inclui produção florestal, pesca e aquicultura. Não cobre todo o agronegócio, informais, estatutários ou MEI.'),
      ('formal.variacao','Como o estoque varia?','vínculos','Estoque no mês menos estoque no mês anterior ou há 12 meses','Diferença de estoques','Não aplicável','formal','saldo_mes, saldo_12m, serie_saldo','CNAE 2.0, seção A','Série de variações 2023-08 a 2026-07','Brasil/mês','Não inferir admissões e desligamentos setoriais; sem UF × CNAE integrado.'),
      ('ocupacao.pessoas','Quem aparece no grupo ocupacional qualificado?','pessoas','Valor original do Censo, variável 13535','Pessoas ocupadas com rendimento','Não aplicável','ocupacoes','SIDRA 10282; grupo 12635; sexos 6794, 4, 5; cor/raça total 95251','Grandes grupos de ocupação no trabalho principal','2022','Brasil/UF × sexo','Pessoas de 14 anos ou mais ocupadas com rendimento; não toda ocupação agro nem emprego formal.'),
      ('ocupacao.parcela','Que parcela dos ocupados com renda pertence ao grupo?','%','Pessoas do grupo / total de ocupados com rendimento × 100','Pessoas do grupo 12635','Total da variável 13535 e grupo 100971 na mesma UF','ocupacoes','SIDRA 10282; variáveis e grupos declarados','Grupo de ocupação, não CNAE','2022','UF','Não identifica agricultura familiar ou proporção de emprego formal.'),
      ('ocupacao.rendimento','Quais rendimentos a pesquisa registra?','R$ correntes mensais','Média/mediana publicadas, sem calcular média de medianas','Variáveis 13536 e 13537','Pessoas do universo da pesquisa, não estimado aqui','ocupacoes','SIDRA 10282; grupo 12635','Grupo ocupacional e sexo na fonte','2022','Brasil/UF × sexo','Todos os trabalhos; não salário de um vínculo. Diferenças não explicam causas.'),
      ('alimentos.ebia','Qual a condição alimentar dos domicílios?','% de domicílios','Valores originais da PNAD Contínua, recorte conferido no PDF','Domicílios segundo condição alimentar','Domicílios do universo da pesquisa','alimentacao','need: secure, insecure, mild, moderate, severe; p.6 do original','EBIA, segundo a fonte','2023 e 2024','Brasil e cinco Grandes Regiões','Sem estimativa EBIA municipal; sem causa atribuída à produção ou ao preço.'),
      ('ipca.geral','Como converter a base de preços?','número-índice; R$ na base escolhida','Valor informado × índice de destino / índice de origem','Valor informado e número-índice de destino','Número-índice de origem positivo','inflacao','SIDRA 1737, variável 2266','IPCA geral nacional, dezembro/1993 = 100','2023-01 a 2026-07','Brasil/mês','Não é índice específico de alimentos ou insumos. Valor convertido é cenário, não preço de produto observado.'),
    ]
    rows=[]
    for id,q,unit,formula,num,den,source,fields,classification,period,grain,limits in specs:
        s=sources[source]
        rows.append({'id':id,'pergunta':q,'definicao':q,'unidade':unit,'formula':formula,'numerador':num,'denominador':den,'produto':'Todos os itens do universo declarado; sem filtro conjunto de cadeia' if source in ('credito','formal') else 'Não aplicável à identificação de cultura','classificacao':classification,'territorio':grain,'calendario':period,'granularidade':grain,'fonte':s['nome'],'url':s['url'],'tabelaCampos':fields,'referencia':period,'captura':'Ver data original preservada e commit no manifesto; reuso não é nova captura oficial','revisao':'Snapshot preservado; última revisão do portal não confirmada','cobertura':grain,'exclusoes':limits,'licenca':s['licenca'],'limitesComparacao':limits,'estado':'OBSERVADO' if not id.startswith('ipca') else 'INDICE OBSERVADO / VALOR CONVERTIDO EM CENARIO'})
    return rows


def main():
    import argparse,json
    from .run import ROOT
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    text=json.dumps({'versao':1,'indicadores':indicadores()},ensure_ascii=False,indent=2)+'\n';path=ROOT/'docs/agro/dicionario-indicadores.json'
    if args.check:
        if path.read_text()!=text:raise SystemExit('Dicionário Agro desatualizado')
    else:path.write_text(text)
    print('Dicionário Agro: 13 contratos de indicadores conferidos.')

if __name__=='__main__':main()
