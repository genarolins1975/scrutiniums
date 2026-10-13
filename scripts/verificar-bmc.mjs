/** Gate offline: nenhuma coleta ou alteração dos arquivos congelados durante o build. */
import {execFileSync} from 'node:child_process';
execFileSync('python3', ['-m', 'pipeline.eficiencia_comparavel.run', '--check'], {stdio: 'inherit'});
