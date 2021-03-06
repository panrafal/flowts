import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';

import { convertDeclareTypeAlias } from '../converters/convertDeclareTypeAlias';
import { replaceWith } from '../utils/replaceWith';
import { PluginPass } from '../types';

export function DeclareTypeAlias(
  path: NodePath<t.DeclareTypeAlias>,
  state: PluginPass
) {
  const node = path.node;
  const replacement = convertDeclareTypeAlias(node);
  replacement.declare = !state.get('isModuleDeclaration');
  replaceWith(path, replacement);
}
