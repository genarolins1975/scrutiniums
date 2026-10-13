import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {validarBaseComparavel, type BaseComparavel} from './base_comparavel';

export function baseComparavel2022(): BaseComparavel {
  return validarBaseComparavel(JSON.parse(readFileSync(join(process.cwd(), 'public/eficiencia/base_comparavel_2022/base.json'), 'utf8')) as BaseComparavel);
}
