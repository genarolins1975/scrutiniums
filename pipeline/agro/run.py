"""Agregados Agro reproduzíveis: python3 -m pipeline.agro.run [--check]."""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / 'pipeline/agro/seed'
OUT = ROOT / 'public/agro/gold'
SIGLAS = {'11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO','21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF'}
CADEIAS = {'soja':'Soja','milho':'Milho','arroz':'Arroz','feijao':'Feijão','cafe':'Café','bovinos':'Bovinos','leite':'Leite'}


def numero(v):
    if v == '-': return 0.0  # Convenção SIDRA: zero absoluto, não ausência.
    if v in (None, '', '..', '...', 'X'): return None
    n = float(v)
    if not math.isfinite(n): raise ValueError('Número não finito na fonte')
    return n


def mes_anterior(mes, n=1):
    ano, m = map(int, mes.split('-')); total = ano * 12 + m - 1 - n
    return f'{total // 12:04d}-{total % 12 + 1:02d}'


def janela_meses(inicio, fim):
    rows=[]; current=fim
    while current >= inicio:
        rows.append(current); current=mes_anterior(current)
        if len(rows)>600: raise ValueError('Janela mensal excede o limite')
    return sorted(rows)


def carregar_fontes(seed=SEED):
    manifest=json.loads((seed/'fontes.json').read_text()); result={}
    for source in manifest['fontes']:
        raw=(seed/source['arquivo']).read_bytes()
        if hashlib.sha256(raw).hexdigest()!=source['sha256Arquivo']: raise ValueError('Arquivo fonte alterado: '+source['id'])
        original=gzip.decompress(raw)
        if hashlib.sha256(original).hexdigest()!=source['sha256Original']: raise ValueError('Original divergente: '+source['id'])
        result[source['id']]=json.loads(original)
    return manifest,result


def validar_unicos(rows, campos):
    keys=[tuple(r[c] for c in campos) for r in rows]
    if len(keys)!=len(set(keys)): raise ValueError('Chave duplicada: '+','.join(campos))


def normalizar(manifest, fontes):
    rural=fontes['credito']; uf_por_sigla={sigla:cod for cod,sigla in SIGLAS.items()}
    if len(rural['ufs'])!=27: raise ValueError('Crédito deve conter 27 UFs')
    validar_unicos(rural['ufs'],['uf'])
    if {r['uf'] for r in rural['ufs']}!=set(uf_por_sigla): raise ValueError('UF desconhecida')
    series=rural['serie_mensal']; validar_unicos(series,['mes'])
    janela=rural['janela']; months=janela_meses(janela['ini'],janela['fim'])
    selected=[r for r in series if r['mes'] in months]
    if len(months)!=12 or len(selected)!=12 or any(r['parcial'] for r in selected): raise ValueError('Janela de crédito não tem 12 meses completos')
    total=sum(r['valor'] for r in selected)
    if abs(total-rural['kpis']['valor_12m'])>.02: raise ValueError('Série e total do crédito divergem')
    for rows in [rural['ufs'],rural['programas']['itens']]:
        if abs(sum(r['valor'] for r in rows)-total)>.02: raise ValueError('Agregado de crédito não reconcilia')
    finalidades=['custeio','investimento','comercializacao','industrializacao']
    ufs=[{'id':uf_por_sigla[r['uf']],'sigla':r['uf'],'regiao':r['regiao'],'valor':r['valor'],'contratos':r['qtd'],**{k:r[k] for k in finalidades}} for r in rural['ufs']]
    for r in ufs:
        if abs(sum(r[k] for k in finalidades)-r['valor'])>.02: raise ValueError('Finalidades estaduais não reconciliam')
    # Não importar a variação da gold: a janela anterior do arquivo não é adjacente.
    previous_months=janela_meses(mes_anterior(janela['ini'],12),mes_anterior(janela['ini']))
    previous=[r for r in series if r['mes'] in previous_months and not r['parcial']]
    previous_total=sum(r['valor'] for r in previous) if len(previous)==12 else None
    produtos=[]
    for tipo in ['custeio','investimento']:
        for r in rural['produtos'][tipo]:
            nome=r['produto'].strip('"')
            cadeia=next((k for k,v in CADEIAS.items() if v.casefold()==nome.casefold()),None)
            produtos.append({'nome':nome,'cadeia':cadeia,'finalidade':tipo,'valor':r['valor'],'contratos':r['qtd']})
    credito={'janela':janela,'capturaOriginal':rural['gerado_em'],'nacional':{'valor':total,'contratos':sum(r['qtd'] for r in selected),**{k:sum(r[k] for r in selected) for k in finalidades}},'anteriorAdjacente':{'inicio':previous_months[0],'fim':previous_months[-1],'valor':previous_total,'mesesComDado':len(previous),'variacaoPct':100*(total/previous_total-1) if previous_total and previous_total>0 else None},'serie':[{'mes':r['mes'],'valor':r['valor'],'contratos':r['qtd'],'parcial':r['parcial'],**{k:r[k] for k in finalidades}} for r in series],'ufs':sorted(ufs,key=lambda r:r['id']),'programas':[{'id':r['cd'],'nome':r['nome'],'valor':r['valor'],'contratos':r['qtd']} for r in rural['programas']['itens']],'produtos':produtos,'coberturaProdutos':'Somente os 15 maiores itens de cada finalidade preservados na origem. Ausência do item não é zero. Não somar como total do crédito rural. Bovinos não separa corte de leite.','fonte':'credito'}
    emprego=fontes['formal']; agricultura=next(r for r in emprego['setores'] if r['cnae']=='A')
    # Preserva saldos como variações do estoque, sem inventar admissões por setor.
    formal={'periodo':agricultura['mes'],'preliminar':emprego['mes_preliminar'],'cnae':'A','nome':'Agricultura, pecuária, produção florestal, pesca e aquicultura','estoque':agricultura['estoque'],'saldoMes':agricultura['saldo_mes'],'saldo12Meses':agricultura['saldo_12m'],'serieSaldos':agricultura['serie_saldo'],'serieVariacaoAnual':agricultura['serie_yoy'],'limite':'Vínculos celetistas, não trabalhadores únicos, renda nem toda a cadeia do agronegócio. Saldos são diferenças de estoque. Sem abertura UF × CNAE ou remuneração formal nesta extração.','fonte':'formal'}
    ocupacoes=[]
    raw=fontes['ocupacoes']; groups={'12635','100971'}
    selected=[r for r in raw[1:] if r.get('D1C') in {'1',*SIGLAS} and r.get('D4C')=='6794' and r.get('D5C')=='95251' and r.get('D6C') in groups]
    validar_unicos(selected,['D1C','D2C','D3C','D6C'])
    for cod in ['1',*SIGLAS]:
        rows=[r for r in selected if r['D1C']==cod]
        def get(var,group='12635'):
            match=[r for r in rows if r['D2C']==str(var) and r['D6C']==group]
            return numero(match[0]['V']) if match else None
        ocupacoes.append({'id':'BR' if cod=='1' else cod,'nome':next(r['D1N'] for r in rows),'ano':2022,'pessoas':get(13535),'totalOcupadosComRenda':get(13535,'100971'),'rendaMedia':get(13536),'rendaMediana':get(13537)})
    if len(ocupacoes)!=28: raise ValueError('Cobertura do grupo de ocupação incompleta')
    perfis=[]
    for cod in ['1',*SIGLAS]:
        for sexo,nome_sexo in [('6794','Total'),('4','Homens'),('5','Mulheres')]:
            records=[r for r in raw[1:] if r.get('D1C')==cod and r.get('D4C')==sexo and r.get('D5C')=='95251' and r.get('D6C')=='12635']
            validar_unicos(records,['D2C'])
            if len(records)!=3: raise ValueError('Perfil ocupacional sem três medidas')
            values={r['D2C']:numero(r['V']) for r in records}
            perfis.append({'id':'BR' if cod=='1' else cod,'nome':records[0]['D1N'],'sexo':nome_sexo,'ano':2022,'pessoas':values['13535'],'rendaMedia':values['13536'],'rendaMediana':values['13537']})
    food=fontes['alimentacao']; alimentos={'observacoes':food['needs'],'fonte':'alimentacao','manifestoOriginal':food['manifest'],'universo':'Domicílios particulares permanentes, PNAD Contínua: Brasil e cinco Grandes Regiões. Não são estimativas municipais nem percentuais de produtores.'}
    ipca=fontes['inflacao']; indices=ipca[0]['resultados'][0]['series'][0]['serie']
    inflacao={'indices':[{'mes':k[:4]+'-'+k[4:],'indice':numero(v)} for k,v in sorted(indices.items())],'baseOriginal':'dezembro de 1993 = 100','fonte':'inflacao','limite':'IPCA geral nacional, não inflação de alimentos nem deflator específico de insumos agrícolas.'}
    if any(r['indice'] is None or r['indice']<=0 for r in inflacao['indices']): raise ValueError('Índice de preços inválido')
    return {'versao':'agro-1','geradoEm':manifest['preservadoEm'],'fontes':manifest['fontes'],'credito':credito,'trabalho':{'formal':formal,'ocupacoes':ocupacoes,'perfisOcupacao':perfis,'grupoOcupacional':'Trabalhadores qualificados da agropecuária, florestais, da caça e da pesca','universoOcupacao':'Censo Demográfico 2022, pessoas de 14 anos ou mais ocupadas com rendimento. Grupo de ocupação não é CNAE, não cobre toda ocupação agro e não distingue formalidade.','fonteOcupacoes':'ocupacoes'},'alimentos':alimentos,'inflacao':inflacao,'producao':[],'bloqueios':[{'id':id,'estado':'BLOQUEADO_REDE','motivo':motivo} for id,motivo in [('producao','IBGE PAM/PPM/Abate: CONNECT 403; sem área, produção, rendimento, leite, rebanho ou abate integrados.'),('custos','Conab: CONNECT 403; sem referência observada validada de custo/preço de uma lavoura.'),('alimentos-precos','IBGE/Conab: sem subitens de alimentos e preços por produto integrados. IPCA geral não os substitui.'),('seguro','MAPA/BCB: sem base de seguro subvencionado/Proagro validada.'),('comercio','Comex Stat: CONNECT 403; NCM, destinos, quantidades e FOB ainda não capturados.'),('ambiente','INPE e fontes meteorológicas: sem camadas produção/clima/uso do solo compatíveis integradas.'),('familiar','Censo Agro e programas: sem identificação observada válida de agricultura familiar por cadeia/território.'),('internacional','Sem base FAOSTAT harmonizada validada nesta sessão.')]]}


def serializar(snapshot):
    encode=lambda d:(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n').encode()
    from .dicionario import indicadores
    files={'snapshot.json':encode(snapshot),'dicionario.json':encode({'versao':1,'indicadores':indicadores(snapshot)})}
    out=io.StringIO(newline='');writer=csv.writer(out,delimiter=';',quoting=csv.QUOTE_ALL,lineterminator='\r\n')
    writer.writerow(['Território','Código IBGE','Período inicial','Período final','Indicador','Valor','Unidade','Universo','Fonte','Limite'])
    c=snapshot['credito']
    for r in c['ufs']:
        for k in ['valor','contratos','custeio','investimento','comercializacao','industrializacao']:
            writer.writerow([r['sigla'],r['id'],c['janela']['ini'],c['janela']['fim'],k,r[k],'contratos' if k=='contratos' else 'R$ correntes','Crédito rural contratado, todas as cadeias',snapshot['fontes'][0]['url'],'Contratos não são beneficiários; crédito não é custo fiscal.'])
    files['credito-ufs.csv']=('\ufeff'+out.getvalue()).encode()
    out=io.StringIO(newline='');writer=csv.writer(out,delimiter=';',quoting=csv.QUOTE_ALL,lineterminator='\r\n');writer.writerow(['Território','Código','Ano','Grupo','Pessoas','Renda média','Renda mediana','Unidade renda','Universo','Fonte'])
    for r in snapshot['trabalho']['ocupacoes']: writer.writerow([r['nome'],r['id'],r['ano'],snapshot['trabalho']['grupoOcupacional'],r['pessoas'],r['rendaMedia'],r['rendaMediana'],'R$ correntes mensais',snapshot['trabalho']['universoOcupacao'],'https://sidra.ibge.gov.br/tabela/10282'])
    files['ocupacoes-2022.csv']=('\ufeff'+out.getvalue()).encode()
    files['manifesto.json']=encode({'versao':snapshot['versao'],'geradoEm':snapshot['geradoEm'],'fontes':snapshot['fontes'],'arquivos':{k:hashlib.sha256(v).hexdigest() for k,v in files.items()},'bloqueios':snapshot['bloqueios'],'regra':'Falha de coleta não promove arquivo, não altera último snapshot e não vira zero. Cenários ficam fora das estatísticas observadas.'})
    return files


def gerar():
    manifest,fontes=carregar_fontes();return serializar(normalizar(manifest,fontes))


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args();files=gerar()
    if args.check:
        for name,data in files.items():
            if not (OUT/name).exists() or (OUT/name).read_bytes()!=data: raise SystemExit('Saída Agro divergente: '+name)
    else:
        OUT.mkdir(parents=True,exist_ok=True)
        # Todas as fontes e saídas são calculadas/validadas antes da primeira gravação.
        for name,data in files.items():
            temp=OUT/(name+'.tmp');temp.write_bytes(data);temp.replace(OUT/name)
    print(json.dumps({'arquivos':len(files),'check':args.check,'bytes':sum(map(len,files.values()))}))

if __name__=='__main__': main()
