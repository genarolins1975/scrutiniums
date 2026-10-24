"""Datas da versão mantida no repositório; o manifesto não prova atualização de dados."""
import json
from pathlib import Path

ARQUIVOS = ('pld.json', 'hidrologia.json', 'carga.json', 'geracao.json', 'rede.json', 'cmo.json', 'sintese.json')


def descrever(pasta):
    linhas = ['Versões mantidas no repositório (geração de cada produto, não data do manifesto):']
    for nome in ARQUIVOS:
        try:
            d = json.loads((Path(pasta)/nome).read_text())
            data = d.get('gerado_em') or 'não informada'
        except (OSError, ValueError):
            data = 'arquivo ausente ou ilegível'
        linhas.append(f'- `{nome}`: {data}')
    linhas.append('A disponibilidade em produção exige conferir o deployment; este relatório não a presume.')
    return '\n'.join(linhas)


if __name__ == '__main__':
    print(descrever(Path(__file__).resolve().parents[1]/'public/energia/gold'))
