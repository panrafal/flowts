import * as commander from 'commander';
import * as fs from 'fs';
import * as path from 'path';

import { convert } from './convert';

export interface Options {
  readonly recast: boolean;
  readonly prettier: boolean;
  readonly allowJs: boolean;
  readonly forceJsx: boolean;
  readonly requireComment: boolean;
  readonly include: string[];
  readonly exclude: string[];
  readonly afterRename: string;
  readonly interactiveRename: boolean;
  readonly validate: boolean;
}

const program = new commander.Command();

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
);

const defaultInclude = ['**/*.{js,mjs,jsx,js.flow}'];

program
  .name('flowts')
  .version(pkg.version)
  .description('Flow to TypeScript migration tool')
  .option('-R, --no-recast', 'use babel generator instead of recast', false)
  .option('-P, --no-prettier', 'do not run prettier on converted code', false)
  .option('--no-validate', 'store files even if code differs', false)
  .usage('[options] ./path/to/project')
  .option(
    '--no-allow-js',
    'convert all JS files to TypeScript(including without Flow)',
    false
  )
  .option('--require-comment', 'require Flow comment to convert a file', false)
  .option('--force-jsx', 'treat all files as JSX', false)
  .option('--after-rename <shellCommand>', 'run shell after renaming', '')
  .option(
    '--interactive-rename',
    'Wait for interactive confirmation after renaming, before writing converted code (allowing to have separate commit to better preserve file history)',
    false
  )
  .option<string[]>(
    '-i, --include <includeGlob>',
    'Glob expression of files to include, default: "**/*.{js,mjs,jsx,js.flow}"',
    (a, b) => [...(b !== defaultInclude ? b : []), a],
    defaultInclude
  )
  .option<string[]>(
    '-x, --exclude <excludeGlob>',
    'Additional excludes glob expression (by default node_modules and files from .gitignore is excluded)',
    (a, b) => [...b, a],
    []
  )
  .parse(process.argv);

const args = program.args;
const opts = program.opts() as Options;

if (args.length === 0) {
  console.error('Please specify project root');
  process.exit(1);
}
if (args.length > 1) {
  console.error('Only one project root can be specified');
  process.exit(1);
}

convert(args[0], opts).then(
  () => {
    console.log('done');
    process.exit(0);
  },
  e => {
    console.error(e);
    process.exit(1);
  }
);
