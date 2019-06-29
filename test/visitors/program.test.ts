import * as pluginTester from 'babel-plugin-tester';
import plugin from '../../src';

pluginTester({
  plugin,
  tests: [
    {
      title: 'program flow comment single line',
      code: `// @flow\nconst a = 55;\nexport default a;`,
      output: `const a = 55;\nexport default a;`,
    },
    {
      title: 'program flow comment block statement',
      code: `/* @flow */\nconst a = 55;\nexport default a;`,
      output: `const a = 55;\nexport default a;`,
    },
    {
      title: 'program flow comment with license',
      code: `// @license MIT\n/* @flow */\nconst a = 55;\nexport default a;`,
      output: `// @license MIT\nconst a = 55;\nexport default a;`,
    },
  ],
});
