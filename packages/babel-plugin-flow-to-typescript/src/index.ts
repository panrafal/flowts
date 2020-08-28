import { PluginObj, Visitor } from '@babel/core';
import { ImportDeclaration } from './visitors/ImportDeclaration';
import { OpaqueType } from './visitors/OpaqueType';
import { TypeAnnotation } from './visitors/TypeAnnotation';
import { TypeCastExpression } from './visitors/TypeCastExpression';
import { TypeParameterDeclaration } from './visitors/TypeParameterDeclaration';
import { ClassDeclaration } from './visitors/ClassDeclaration';
import { DeclareClass } from './visitors/DeclareClass';
import { InterfaceDeclaration } from './visitors/InterfaceDeclaration';
import { DeclareFunction } from './visitors/DeclareFunction';
import { Program } from './visitors/Program';
import { TypeAlias } from './visitors/TypeAlias';
import { FunctionDeclaration } from './visitors/FunctionDeclaration';
import { CallExpression } from './visitors/CallExpression';
import { DeclareVariable } from './visitors/DeclareVariable';
import { DeclareTypeAlias } from './visitors/DeclareTypeAlias';
import { DeclareInterface } from './visitors/DeclareInterface';
import { DeclareOpaqueType } from './visitors/DeclareOpaqueType';
import { DeclareModuleExports } from './visitors/DeclareModuleExports';
import { DeclareModule } from './visitors/DeclareModule';
import { DeclareExportDeclaration } from './visitors/DeclareExportDeclaration';
import { NewExpression } from './visitors/NewExpression';
import { ArrowFunctionExpression } from './visitors/ArrowFunctionExpression';
import { PluginOptions, PluginPass } from './types';
import { TSModuleDeclaration } from './visitors/TSModuleDeclaration';
import { ExportAllDeclaration } from './visitors/ExportAllDeclaration';

const visitor: Visitor<PluginPass> = {
  Program,
  TypeAnnotation,
  TypeAlias,
  TypeParameterDeclaration,
  ImportDeclaration,
  TypeCastExpression,
  OpaqueType,
  DeclareClass,
  // @ts-expect-error todo: separate visitors
  ClassDeclaration,
  // @ts-expect-error todo: separate visitors
  ClassExpression: ClassDeclaration,
  ExportAllDeclaration,
  InterfaceDeclaration,
  DeclareFunction,
  FunctionDeclaration,
  CallExpression,
  DeclareVariable,
  DeclareTypeAlias,
  DeclareInterface,
  DeclareOpaqueType,
  DeclareModuleExports,
  DeclareModule,
  DeclareExportDeclaration,
  NewExpression,
  ArrowFunctionExpression,
  TSModuleDeclaration,
};

// tslint:disable-next-line:no-any
export default (_babel: any, opts: PluginOptions = {} as PluginOptions) => {
  if (typeof opts.isJSX === 'undefined') {
    opts.isJSX = true;
  }
  return {
    name: 'babel-plugin-flow-to-typescript',
    visitor,

    // tslint:disable-next-line:no-any
    manipulateOptions(_babel: any, parserOpts) {
      parserOpts.plugins.push('flow');
      if (opts.isJSX) {
        parserOpts.plugins.push('jsx');
      }
      parserOpts.plugins.push('classProperties');
      parserOpts.plugins.push('objectRestSpread');
      parserOpts.plugins.push('optionalChaining');
      parserOpts.plugins.push('nullishCoalescingOperator');
      parserOpts.plugins.push('dynamicImport');
    },
  } as PluginObj<PluginPass>;
};
