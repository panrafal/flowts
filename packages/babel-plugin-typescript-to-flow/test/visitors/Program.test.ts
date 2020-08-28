import { testTransform } from '../transform';

test('helper types', () => {
  const result = testTransform(`
import type {A,B} from 'somewhere'
let a: ReturnType<A>;
let b: Pick<A, B>;
let c: Omit<A, B>;
let d: Omit<A, 'a'>;
let e: Omit<A, 'a'|'b'>;
`);
  expect(result.babel).toMatchInlineSnapshot(`
    "import type { A, B } from 'somewhere';
    type Omit<T: {}, K: $Keys<T>> = $ObjMapi<T, (<KK: K>(KK) => any) & (<KK: mixed>(KK) => $ElementType<T, KK>)>;
    type Pick<T: {}, K: $Keys<T>> = $ObjMapi<{
      [K]: any
    }, <KK>(KK) => $ElementType<T, KK>>;
    let a: $Call<<R>((...args: any[]) => R) => R, A>;
    let b: Pick<A, B>;
    let c: Omit<A, B>;
    let d: $Rest<A, {
      a: any
    }>;
    let e: $Rest<A, {
      a: any,
      b: any,
    }>;"
  `);
  // expect(result.recast).toMatchInlineSnapshot();
});

xtest('call helper type', () => {
  const result = testTransform(`type A = string | {
  new (...args: any): React.Component<any, any>;
} | any;
type B = {
  new (...args: any): {
    readonly scope: (a: TagsType) => void;
  };
};
type C = {
  new (...args: any): A;
};`);
  const flow = `
type A = string | Class<React.Component<*, *>> | any;
type B = Class<{
  +scope: TagsType => void,
}>;
type C = Class<A>;
`;
  // expect(result.babel).toMatchInlineSnapshot();
  // expect(result.recast).toMatchInlineSnapshot();
});
