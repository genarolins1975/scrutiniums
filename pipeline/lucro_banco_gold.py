"""Gold reproduzível da DRE prudencial; nenhuma coleta durante build/testes."""
import argparse
from decimal import Decimal
import json
import re
from pathlib import Path
from pipeline.lucro_banco import catalogar_rubricas, numero, periodo, reconciliar, ratear_pdd
from pipeline.sources.ifdata_dre import ler_seed, ROOT
from pipeline.sources.ifdata_carteiras import _category_lids, _slug

DESTINO=ROOT/'public/obs/data/gold/lucro_banco.json'
# Símbolos são os rótulos contábeis no template; os lids são resolvidos por data.
NOVO=[('receitas','Rendas dos ativos financeiros','Income from financial assets',['a','b','c','d','e']),
 ('captacao','Custo de captação','Funding cost',['g']),
 ('outros_financeiros','Outros resultados financeiros','Other financial results',['h','i','j']),
 ('pdd','Perdas esperadas','Expected credit losses',['f']),
 ('servicos','Tarifas e serviços','Fees and services',['l1','m','n']),
 ('pagamentos','Outros resultados de pagamentos','Other payment results',['l2','l3']),
 ('estrutura','Pessoal e administração','Staff and administration',['o','p']),
 ('outras','Outras receitas e despesas','Other income and expenses',['q','r','s','t','u']),
 ('tributos','IR e CSLL','Income taxes',['x']),
 ('participacoes','Participações no lucro','Profit sharing',['y'])]
ANTIGO=[('receitas','Receitas de intermediação','Financial income',['a']),
 ('captacao','Custo de captação','Funding cost',['b1']),
 ('outros_financeiros','Outras despesas financeiras','Other financial expenses',['b2','b3','b4']),
 ('pdd','Provisão para perdas','Loan loss provisions',['b5']),
 ('servicos','Tarifas e serviços','Fees and services',['d1','d2']),
 ('estrutura','Pessoal e administração','Staff and administration',['d3','d4']),
 ('outras','Outros resultados','Other results',['d5','d6','d7','d8','f']),
 ('tributos','IR e CSLL','Income taxes',['h']),('participacoes','Participações','Profit sharing',['i'])]


def mapa_rubricas(t,info):
    out={}
    for r in catalogar_rubricas(t,info,t['id']):
        m=re.search(r'\(([a-z]+\d*)\)',r['nome'])
        if m:
            chave=m[1]
            if chave in out:raise ValueError(f'Símbolo contábil ambíguo: {chave}')
            out[chave]=r
    return out


def soma(values):
    return None if not values or None in values else sum(values,Decimal(0))


def montar_periodo(d,p):
    novo=int(d)>=202501; mapa=mapa_rubricas(p['dre'],p['info'])
    receita=NOVO if novo else ANTIGO; registros=[]
    rows={str(r['e']):{x['i']:numero(x['v']) for x in r['v']} for r in p['dados']['1']}
    carteiras={str(r['e']):{x['i']:numero(x['v']) for x in r['v']} for r in p['dados']['3']}
    by={x['id']:x for x in p['info']}
    for c in p['cadastro']:
        vals=rows.get(c['c0'],{})
        # Mantém conglomerados com lucro ausente: aparecem com tabela e lacunas.
        raw={k:{**{a:meta[a] for a in ('relatorio','lid','nome','en','caminho')},'valor':vals.get(meta['lid'])} for k,meta in mapa.items()}
        def v(k):return raw.get(k,{}).get('valor')
        passos=[{'id':k,'nome':pt,'en':en,'valor':soma([v(s) for s in ss]),
                 'rubricas':ss,'lids':[mapa[s]['lid'] for s in ss if s in mapa]}
                for k,pt,en,ss in receita]
        lucro=v('z' if novo else 'j')
        recon=reconciliar({s['id']:s['valor'] for s in passos},lucro)
        modelos=[]
        for rid,t in p['carteiras'].items():
            lm=_category_lids(t,by,True); grupos={}
            english={str(by.get(col.get('ifd'),{}).get('n','')).replace('\n',' ').strip():by.get(col.get('ifd'),{}).get('ni') for col in t.get('c',[])}
            for lid,(tipo,nome) in lm.items():
                if nome.startswith('Total da Carteira'):continue  # subtotal, nunca modalidade
                chave=('PF' if rid=='123' else 'PJ')+':'+_slug(nome)
                g=grupos.setdefault(chave,{'id':chave,'nome':nome,'segmento':'PF' if rid=='123' else 'PJ','fonte':f'IF.data, BCB, relatório {rid}','lids':{}})
                campo='saldo' if tipo=='total' else 'vencido15'
                g['en']=english.get(nome) or nome
                g[campo]=carteiras.get(c['c0'],{}).get(lid);g['lids'][campo]=lid
            modelos.extend(grupos.values())
        estoque=vals.get(140202) if novo else None
        if estoque is not None:estoque=abs(estoque)
        rateio=ratear_pdd(modelos,estoque,v('f3') if novo else None)
        for r,m in zip(rateio['linhas'],modelos):r.update({k:m[k] for k in ('nome','en','segmento','fonte','lids')})
        serv=soma([v(k) for k in (['l1','m','n'] if novo else ['d1','d2'])])
        margem=v('k' if novo else 'c');perda=v('f' if novo else 'b5')
        bruto=margem-perda if margem is not None and perda is not None else None
        estrutura=soma([v(k) for k in (['o','p'] if novo else ['d3','d4'])])
        denom=soma([margem,serv])
        registros.append({'id':f"C{int(c['c0'])-1_000_000_000:07d}",'nome':c['c2'],'grupo':c['c3'],'segmento':c['c12'],
            'logo':None,'logo_ausencia':'Sem arquivo oficial e vínculo de marca verificado para este conglomerado prudencial.',
            'data_base':d,'meses':periodo(d)['meses'],'plano':periodo(d)['plano'],
            'componentes':[d], 'relatorio':p['dre']['id'],'rubricas':raw,'passos':passos,
            'lucro':lucro,'reconciliacao':recon,'rateio':rateio,
            'margem_bruta':bruto,'margem_liquida':margem,
            'servicos':serv,'estrutura':estrutura,
            'servicos_receita_pct':serv/denom*100 if serv is not None and denom is not None and denom>0 else None,
            'servicos_estrutura_pct':serv/abs(estrutura)*100 if serv is not None and estrutura is not None and estrutura<0 else None})
    return registros


def combinar(atual,anterior):
    # Só datas contíguas, mesmo perímetro/código e mesmo plano. Estoque e pesos da ponta atual.
    if not anterior or atual['plano']!=anterior['plano'] or atual['id']!=anterior['id']:return None
    ano=int(atual['data_base'][:4]);prev=f'{ano-1}12' if atual['data_base'].endswith('06') else f'{ano}06'
    if anterior['data_base']!=prev or atual['meses']!=6 or anterior['meses']!=6:return None
    from copy import deepcopy
    r=deepcopy(atual);r['meses']=12;r['componentes']=anterior['componentes']+atual['componentes']
    for key in ('lucro','margem_bruta','margem_liquida','servicos','estrutura'):
        r[key]=soma([atual[key],anterior[key]])
    for s in r['passos']:
        prev=next((p for p in anterior['passos'] if p['id']==s['id']),None)
        s['valor']=soma([s['valor'],prev['valor'] if prev else None])
    for k in r['rubricas']:
        r['rubricas'][k]['valor']=soma([atual['rubricas'][k]['valor'],anterior['rubricas'].get(k,{}).get('valor')])
    r['reconciliacao']=reconciliar({s['id']:s['valor'] for s in r['passos']},r['lucro'])
    linhas=atual['rateio']['linhas']
    fluxo=soma([atual['rateio']['total_despesa'],anterior['rateio']['total_despesa']])
    r['rateio']=ratear_pdd(linhas,atual['rateio']['total_provisao'],fluxo)
    for l,m in zip(r['rateio']['linhas'],linhas):l.update({k:m[k] for k in ('nome','en','segmento','fonte','lids')})
    denom=soma([r['margem_liquida'],r['servicos']])
    r['servicos_receita_pct']=r['servicos']/denom*100 if denom is not None and denom>0 and r['servicos'] is not None else None
    r['servicos_estrutura_pct']=r['servicos']/abs(r['estrutura'])*100 if r['servicos'] is not None and r['estrutura'] is not None and r['estrutura']<0 else None
    return r


def construir():
    seed=ler_seed();datas=sorted(seed['periodos']);historico={d:montar_periodo(d,seed['periodos'][d]) for d in datas}
    atual=datas[-1];ano=int(atual[:4]);prev=f'{ano-1}12' if atual.endswith('06') else f'{ano}06'
    anteriores={r['id']:r for r in historico.get(prev,[])}
    lista=[]
    for r in historico[atual]:
        r['doze_meses']=combinar(r,anteriores.get(r['id']))
        r['historico']=[{'data_base':d,**{k:linha[k] for k in ('plano','meses','lucro','margem_bruta','margem_liquida')}} for d in datas for linha in historico[d] if linha['id']==r['id']]
        lista.append(r)
    # Agregado é o universo prudencial coberto, não o SFN (independentes excluídas).
    def agregar(meses):
        candidatos=[r['doze_meses'] if meses==12 else r for r in lista]
        elegiveis=[r for r in candidatos if r and r['reconciliacao']['reconciliado']]
        agregado={'nome':'Conglomerados prudenciais cobertos','n':len(elegiveis),'universo':len(lista),'data_base':atual,'meses':meses,'componentes':[prev,atual] if meses==12 else [atual]}
        agregado['passos']=[{**p,'valor':sum((r['passos'][i]['valor'] for r in elegiveis),Decimal(0))} for i,p in enumerate(elegiveis[0]['passos'])] if elegiveis else []
        agregado['lucro']=sum((r['lucro'] for r in elegiveis),Decimal(0)) if elegiveis else None
        agregado['reconciliacao']=reconciliar({p['id']:p['valor'] for p in agregado['passos']},agregado['lucro'])
        return agregado
    sistema=agregar(12);sistema_semestral=agregar(6)
    validacao=[]
    for d in datas[-2:]:
        for r in historico[d]:
            if r['id'] in ('C0080099','C0080738','C0084693'):
                validacao.append({k:r[k] for k in ('id','nome','data_base','lucro','reconciliacao','relatorio')})
    return {'versao':1,'data_base':atual,'coletado_em':seed['coletado_em'],'fonte':'IF.data, Banco Central do Brasil',
        'unidade':'BRL','instituicoes':lista,'sistema':sistema,'sistema_semestral':sistema_semestral,'validacao_empirica':validacao,
        'fontes':seed['fontes'],'clientes':{'disponivel_para_tarifa':False,'motivo':'Os lids 23380 e 113786 contam clientes identificados com crédito ativo no SCR, não todos os clientes pagantes de tarifas.'},
        'metodo':{'tolerancia_brl':1,'quebra':'2025: Resolução CMN 4.966; não ligar os planos contábeis.',
         'receita':'Rendas dos ativos financeiros: inclui ajustes cambiais e de valor justo. Não é apenas juros nem receita operacional bruta.',
         'servicos_receita':'(pagamentos + tarifas + outras rendas de serviços) / (resultado de intermediação + serviços), proxy; omitida se denominador não positivo.',
         'rateio':'Estoque lid 140202 e fluxo de crédito f3 rateados por vencido ≥15d e por saldo nas mesmas modalidades elegíveis. A faixa é sensibilidade entre métodos, não intervalo de confiança. Pesos da data-base também no fluxo de 12 meses. Valores por linha são estimativas de modelo.',
         'universo':'Somente conglomerados prudenciais do cadastro 1009 (TD=C). O agregado exclui independentes e DREs incompletas/divergentes. Não é o total do SFN.',
         'simulacao':'Despesa de crédito/vencido constante; outras linhas e tributos fixos. Não prevê lucro nem inadimplência.',
         'margem':'Margem financeira em R$, antes/depois de perdas esperadas. Não é NIM: não dividimos por ativos rentáveis.'}}


def serializar(g):
    return json.dumps(g,ensure_ascii=False,separators=(',',':'),allow_nan=False,
                      default=lambda v:float(v) if isinstance(v,Decimal) else str(v))+'\n'

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');a=p.parse_args()
    body=serializar(construir())
    if a.check:
        if json.loads(DESTINO.read_text())!=json.loads(body):raise SystemExit('Gold diverge do seed')
        print('Gold de lucro bancário confere com seed')
    else:
        DESTINO.write_text(body);print(DESTINO)
