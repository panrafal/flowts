import * as babel from '@babel/core';
import traverse from '@babel/traverse';
import { sharedParserPlugins } from './sharedParserPlugins';

export interface SourceOptions {
  isJSX: boolean;
  isFlow: boolean;
  declaredAsFlow: boolean;
}

export function detectOptions(source: string, filename: string): SourceOptions {
  const flowAst = babel.parseSync(source, {
    babelrc: false,
    configFile: false,
    ast: true,
    parserOpts: {
      plugins: ['flow', 'jsx', ...sharedParserPlugins],
    },
    filename,
  });

  let isJSX = /\.jsx$/i.test(filename);
  const declaredAsFlow =
    /^\/[/*] +@flow/m.test(source) || /\.js\.flow$/i.test(filename);
  let isFlow = declaredAsFlow;

  if (flowAst === null) {
    throw new Error(
      'babel.parseSync returned null - probably there is some configuration error'
    );
  }

  traverse(flowAst, {
    Program({ node: { body } }) {
      if (body.length === 0) {
        // this file is empty!
        isJSX = false;
        isFlow = false;
      }
    },
    JSX() {
      isJSX = true;
    },
    Flow() {
      isFlow = true;
    },
  });
  return { isJSX, isFlow, declaredAsFlow };
}
