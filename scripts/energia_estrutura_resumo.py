import json,sys,statistics as st
j=json.load(open(sys.argv[1]))
ms=j['medicoes']
def q(v,p):
    v=sorted(v); 
    return v[min(len(v)-1,int(p*len(v)))] if v else None
for w in (390,1440):
    X=[m for m in ms if m['largura']==w]
    comresp=[m for m in X if m.get('resposta')]
    print(f"== {w}px: {len(X)} páginas; {len(comresp)} com [data-resposta] visível")
    if comresp:
        vh=comresp[0]['vh']
        ini=[m for m in comresp if m['resposta']['top']<vh]
        fim=[m for m in comresp if m['resposta']['bottom']<=vh]
        print(f"   resposta começa na 1a tela: {len(ini)}; termina na 1a tela: {len(fim)}; topo da resposta: mediana {st.median(m['resposta']['top'] for m in comresp)} px, p90 {q([m['resposta']['top'] for m in comresp],0.9)} px (dobra em {vh})")
    cab=[m['cabecalho']['bottom'] for m in X if m.get('cabecalho')]
    print(f"   fim do cabeçalho: mediana {st.median(cab)} px, p90 {q(cab,0.9)}")
    print(f"   altura da página: mediana {st.median(m['altura'] for m in X)} px, p90 {q([m['altura'] for m in X],0.9)}, máx {max(m['altura'] for m in X)}")
    comleg=[m for m in X if m['legenda']]
    print(f"   páginas com legenda Siglas: {len(comleg)}; com siglas do texto sem legenda: {sum(1 for m in X if m['faltam'])}; com sigla na legenda que o texto não usa: {sum(1 for m in X if m['sobram'])}")
    print(f"   total siglas faltando: {sum(len(m['faltam']) for m in X)}; sobrando: {sum(len(m['sobram']) for m in X)}")
    print(f"   páginas com tabela >6 colunas visível: {sum(1 for m in X if m['largas'])} ({sum(m['largas'] for m in X)} tabelas)")
