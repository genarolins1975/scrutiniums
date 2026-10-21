"""Promove somente após validação; Node stdlib materializa os mesmos arquivos no build."""
import subprocess
from pathlib import Path
from .padroniza import le
from .validacoes import valida
ROOT=Path(__file__).resolve().parents[2]
def promove():
 data,manifest=le();result=valida(data,manifest)
 subprocess.run(['node','scripts/materializar-assistencia.mjs'],cwd=ROOT,check=True)
 return result
if __name__=='__main__':print(promove())
