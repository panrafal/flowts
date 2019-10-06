import template, { TemplateBuilderOptions } from '@babel/template';
import {
  stringLiteral,
  CallExpression,
  BlockStatement,
  Expression,
  Statement,
  File,
  ExpressionStatement,
} from '@babel/types';
import traverse, { NodePath } from '@babel/traverse';
import * as recast from 'recast';
import * as prettier from 'prettier';

const templateOpts: TemplateBuilderOptions = {
  plugins: ['typescript'],
  sourceType: 'module',
};

const buildTestTemplate = template.program(
  `
import plugin from '../../tsTypesPlugin';
import { createTransform } from '../../createTransform';

const transform = createTransform([plugin]);

describe(%%moduleName%%, () => {
  describe('globals', () => {
    test('has no globals', () => {});
  });
  describe('modules', () => {
    test('has no modules', () => {});
  });
});
`,
  templateOpts
);

function print(
  generatedAst: recast.types.ASTNode,
  prettierConfig: prettier.Options | undefined
) {
  const code = recast.print(generatedAst);
  return prettier.format(code.code, prettierConfig);
}

function ifJestCall(
  functionName: string,
  path: NodePath,
  fn: (name: string, body: NodePath<BlockStatement>) => void
) {
  if (path.isCallExpression()) {
    const callee = path.get('callee');
    if (callee.isIdentifier()) {
      if (callee.node.name === functionName) {
        const args = path.get('arguments');
        if (args.length === 2) {
          const testNameArg = args[0];
          const testFnArg = args[1];
          if (
            testNameArg.isStringLiteral() &&
            (testFnArg.isArrowFunctionExpression() ||
              testFnArg.isFunctionExpression())
          ) {
            const name = testNameArg.node.value;

            const body = testFnArg.get('body') as NodePath<
              BlockStatement | Expression
            >;
            if (!body || !body.isBlockStatement()) {
              throw body.buildCodeFrameError(
                'test body expected to be block statement'
              );
            }
            fn(name, body);
          }
        }
      }
    }
  }
}

function findJestCalls(
  functionName: string,
  globalsDescribeBody: NodePath<BlockStatement>
): Map<string, NodePath<BlockStatement>> {
  const tests = new Map();
  for (const path of globalsDescribeBody.get('body') as NodePath[]) {
    if (path.isExpressionStatement()) {
      ifJestCall(functionName, path.get('expression'), (name, body) => {
        tests.set(name, body);
      });
    }
  }
  return tests;
}

interface RuleDescribe {
  path: NodePath<BlockStatement>;
  tests: Map<string, NodePath<BlockStatement>>;
}

interface RulesDescribe {
  path: NodePath<BlockStatement>;
  describes: Map<string, RuleDescribe>;
  tests: Map<string, NodePath<BlockStatement>>;
}

interface ModulesRulesDescribe {
  path: NodePath<BlockStatement>;
  describes: Map<string, RulesDescribe>;
  tests: Map<string, NodePath<BlockStatement>>;
}

const HAS_NO_MODULES_TEST_NAME = 'has no modules';
const HAS_NO_GLOBALS_TEST_NAME = 'has no globals';
const HAS_NO_TEST = 'has no test';
function getModuleRulesDescribe(
  target: ModulesRulesDescribe,
  moduleName: string,
  noDescribesTest: string,
  newDescribePlaceholderTest: string
): RulesDescribe {
  let moduleDescribe = target.describes.get(moduleName);
  if (!moduleDescribe) {
    const ruleDescribeNode = template.statement(templateOpts)(
      `describe(%%moduleName%%, () => {
          test(%%newDescribePlaceholderTest%%, () => {});
       });`
    )({
      moduleName: stringLiteral(moduleName),
      newDescribePlaceholderTest: stringLiteral(newDescribePlaceholderTest),
    });

    target.path.node.body.push(ruleDescribeNode);
    const body = target.path.get('body');
    const path = (body[body.length - 1] as NodePath<ExpressionStatement>).get(
      'expression.arguments.1.body'
    ) as NodePath<BlockStatement>;

    moduleDescribe = {
      path: path,
      describes: new Map(
        [...findJestCalls('describe', path)].map(([ruleName, path]) => [
          ruleName,
          {
            path,
            tests: findJestCalls('test', path),
          },
        ])
      ),
      tests: findJestCalls('test', path),
    };
    target.describes.set(moduleName, moduleDescribe);
  }

  const placeholderTest = target.tests.get(noDescribesTest);
  if (placeholderTest) {
    // arrow expression - expression statement
    placeholderTest.parentPath.parentPath.remove();
    target.tests.delete(noDescribesTest);
  }
  return moduleDescribe;
}

function getRulesDescribe(
  target: RulesDescribe,
  declarationName: string,
  noDescribesTest: string,
  newDescribePlaceholderTest: string
): RuleDescribe {
  let ruleTests = target.describes.get(declarationName);
  if (!ruleTests) {
    const ruleDescribeNode = template.statement(templateOpts)(
      `describe(%%declarationName%%, () => {
          test(%%newDescribePlaceholderTest%%, () => {});
       });`
    )({
      declarationName: stringLiteral(declarationName),
      newDescribePlaceholderTest: stringLiteral(newDescribePlaceholderTest),
    });

    target.path.node.body.push(ruleDescribeNode);
    const body = target.path.get('body');
    const path = (body[body.length - 1] as NodePath<ExpressionStatement>).get(
      'expression.arguments.1.body'
    ) as NodePath<BlockStatement>;

    ruleTests = {
      path,
      tests: findJestCalls('test', path),
    };
    target.describes.set(declarationName, ruleTests);
  }

  const placeholderTest = target.tests.get(noDescribesTest);
  if (placeholderTest) {
    // arrow expression - expression statement
    placeholderTest.parentPath.parentPath.remove();
    target.tests.delete(noDescribesTest);
  }
  return ruleTests;
}

function refreshTests(rulesDescribe: RuleDescribe) {
  rulesDescribe.tests = findJestCalls('test', rulesDescribe.path);
  const noTest = rulesDescribe.tests.get(HAS_NO_TEST);
  if (rulesDescribe.tests.size > 1 && noTest) {
    noTest.parentPath.parentPath.remove();
    rulesDescribe.tests.delete(HAS_NO_TEST);
  }
}

export class RuleTest {
  private testAst: File;

  private moduleName: string;
  private globalRuleTests: RulesDescribe;
  private moduleRuleTests: ModulesRulesDescribe;

  constructor(moduleName: string, testAst: File) {
    this.moduleName = moduleName;
    this.testAst = testAst;

    let testDescribeBody: NodePath<BlockStatement> | undefined;
    traverse(testAst, {
      CallExpression: (path: NodePath<CallExpression>) => {
        ifJestCall('describe', path, (name, body) => {
          if (name === this.moduleName) {
            testDescribeBody = body;
          }
        });
        path.skip();
      },
    });

    if (!testDescribeBody) {
      throw new Error(
        `can not find "describe('${this.moduleName}', () => { … })" in test file`
      );
    }
    const testRootDescribes = findJestCalls('describe', testDescribeBody);

    const globalsDescribeBody = testRootDescribes.get('globals');
    const modulesDescribeBody = testRootDescribes.get('modules');

    if (!globalsDescribeBody) {
      throw testDescribeBody.buildCodeFrameError(
        `can not find "describe('globals', () => { … })" in test file`
      );
    }
    if (!modulesDescribeBody) {
      throw testDescribeBody.buildCodeFrameError(
        `can not find "describe('modules', () => { … })" in test file`
      );
    }
    const globalRuleTests: RulesDescribe = {
      describes: new Map(
        [...findJestCalls('describe', globalsDescribeBody)].map(
          ([ruleName, path]) => [
            ruleName,
            {
              path,
              tests: findJestCalls('test', path),
            },
          ]
        )
      ),
      path: globalsDescribeBody,
      tests: findJestCalls('test', globalsDescribeBody),
    };

    const moduleRuleTests: ModulesRulesDescribe = {
      describes: new Map<string, RulesDescribe>(
        [...findJestCalls('describe', modulesDescribeBody)].map(
          ([moduleName, moduleTestBody]) => [
            moduleName,
            {
              describes: new Map(
                [...findJestCalls('describe', moduleTestBody)].map(
                  ([ruleName, path]) => [
                    ruleName,
                    {
                      path,
                      tests: findJestCalls('test', path),
                    },
                  ]
                )
              ),
              tests: findJestCalls('test', moduleTestBody),
              path: moduleTestBody,
            },
          ]
        )
      ),
      path: modulesDescribeBody,
      tests: findJestCalls('test', modulesDescribeBody),
    };

    this.globalRuleTests = globalRuleTests;
    this.moduleRuleTests = moduleRuleTests;
  }

  static create(moduleName: string) {
    const testAst = {
      type: 'File',
      program: buildTestTemplate({
        moduleName: stringLiteral(moduleName),
      }),
    } as File;

    return new RuleTest(moduleName, testAst);
  }
  static parse(testSource: string): RuleTest {
    throw new Error('todo:');
  }

  print(prettierConfig: prettier.Options | undefined): string {
    return print(this.testAst, prettierConfig);
  }

  setGlobalRuleTests(declarationName: string, tests: Statement[]) {
    const rulesDescribe = getRulesDescribe(
      this.globalRuleTests,
      declarationName,
      HAS_NO_GLOBALS_TEST_NAME,
      'has no test'
    );

    rulesDescribe.path.node.body.push(...tests);
    refreshTests(rulesDescribe);
  }
  setModuleRuleTests(
    moduleName: string,
    declarationName: string,
    tests: Statement[]
  ) {
    const moduleRulesDescribe = getModuleRulesDescribe(
      this.moduleRuleTests,
      moduleName,
      HAS_NO_MODULES_TEST_NAME,
      'has no test'
    );

    const rulesDescribe = getRulesDescribe(
      moduleRulesDescribe,
      declarationName,
      'has no test',
      'has no test'
    );
    rulesDescribe.path.node.body.push(...tests);
    refreshTests(rulesDescribe);
  }
}
