"""Confere integridade e recortes da captura; exporta CSV de contexto, sem pontuação."""
import csv
import hashlib
import itertools
import json
from .coletar_frequencia import DEST, CAPITALS

def main():
    manifest=json.loads((DEST/'frequencia-manifesto.json').read_text())
    for source in manifest['sources']:
        assert hashlib.sha256((DEST/source['file']).read_bytes()).hexdigest()==source['sha256'], 'Hash divergente'
    output=[]
    ages={'99749','47813','31615','2792'}
    for name,geo in [('capitais',set(CAPITALS.split(','))),('brasil',{'1'})]:
        data=json.loads((DEST/f'ibge-10056-{name}.json').read_text()); header=data[0]
        columns={v:k for k,v in header.items()}; territory='Município' if name=='capitais' else 'Brasil'
        def field(row,name): return row[columns[name]]
        keys=set()
        for row in data[1:]:
            code=field(row,territory+' (Código)');age=field(row,'Grupo de idade (Código)')
            assert (code,age) not in keys,'Duplicata';keys.add((code,age))
            assert field(row,'Ano')=='2022' and field(row,'Variável (Código)')=='3795'
            assert field(row,'Sexo (Código)')=='6794' and field(row,'Cor ou raça (Código)')=='95251'
            assert field(row,'Unidade de Medida')=='%'
            raw=field(row,'Valor');value=None if raw in ('...','..','-','X') else float(raw)
            assert value is None or 0<=value<=100
            output.append(dict(codigo=code,territorio=field(row,territory),ano=2022,
                grupo_idade=field(row,'Grupo de idade'),taxa_publicada=raw,
                estado='AUSENTE_OU_SIMBOLO_FONTE' if value is None else 'OBSERVADO',papel='CONTEXTO_NAO_ESCORE'))
        assert keys==set(itertools.product(geo,ages)), 'Cobertura inesperada'
    with (DEST/'frequencia-contexto.csv').open('w',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(output[0]));writer.writeheader();writer.writerows(output)
    print(json.dumps(dict(observacoes=len(output),numericas=sum(r['estado']=='OBSERVADO' for r in output),escores_liberados=0)))
    for r in output:
        if r['codigo'] in ('2611606','4106902','1'):print(json.dumps(r,ensure_ascii=False))

if __name__=='__main__':main()
