import { describe, it, expect } from 'vitest';
import { validate, topscript } from './index';

describe('topscript', () => {
  describe('validate', () => {
    it('throws on syntax errors', () => {
      expect(() => validate('const x = 1; x +')).toThrow(/Unexpected token/);
      expect(() => validate('const x = 1; x + 2; }')).toThrow(/Unexpected token/);
    });

    it('does not throw on valid code', () => {
      expect(() => validate('const x = 1; x + 2;')).not.toThrow();
      expect(() => validate('const x = 1; x + 2; const y = 3;')).not.toThrow();
      expect(() => validate('const x = 1; x + 2; const y = { a: 1 };')).not.toThrow();
    });

    it('allows return outside function when specified', () => {
      expect(() => validate('return 42', { allowReturnOutsideFunction: true })).not.toThrow();
      expect(() => validate('return 42')).toThrow();
      expect(() => validate('if (true) return 42', { allowReturnOutsideFunction: true })).not.toThrow();
      expect(() => validate('if (true) return 42')).toThrow();
      expect(() => validate('return "hello"', { allowReturnOutsideFunction: true })).not.toThrow();
      expect(() => validate('return "hello"')).toThrow();
      expect(() => validate('return true', { allowReturnOutsideFunction: true })).not.toThrow();
      expect(() => validate('return true')).toThrow();
      expect(() => validate('return null', { allowReturnOutsideFunction: true })).not.toThrow();
      expect(() => validate('return null')).toThrow();
      expect(() => validate('return undefined', { allowReturnOutsideFunction: true })).not.toThrow();
      expect(() => validate('return undefined')).toThrow();
    });
  });

  describe('topscript', () => {
    it('throws when the stack size exceeds the limit', () => {
      expect(() => topscript('function f() { f(); } f();', {}, { maxStackSize: 10 })).toThrow('Maximum stack size exceeded');

      expect(() => topscript(`
        const fn1 = () => fn2();
        const fn2 = () => fn3();
        const fn3 = () => fn4();
        const fn4 = () => 'result';
        fn1();
      `, {}, { maxStackSize: 3 })).toThrow('Maximum stack size exceeded');

      expect(() => topscript(`
        function fn1() { fn2(); }
        function fn2() { fn3(); }
        function fn3() { fn4(); }
        function fn4() { return 'result'; }
        fn1();
      `, {}, { maxStackSize: 3 })).toThrow('Maximum stack size exceeded');

      expect(topscript(`
        const fn1 = () => fn2();
        const fn2 = () => fn3();
        const fn3 = () => fn4();
        const fn4 = () => 'result';
        fn1();
      `, {}, { maxStackSize: 4 })).toEqual('result');
    });

    it('evaluates literals', () => {
      expect(topscript('42')).toBe(42);
      expect(topscript('"hello"')).toBe('hello');
      expect(topscript('true')).toBe(true);
      expect(topscript('false')).toBe(false);
      expect(topscript('null')).toBe(null);
    });

    it('supports basic spread operators', () => {
      expect(topscript('const arr = [1, 2, 3]; const newArr = [...arr, 4]; newArr')).toEqual([1, 2, 3, 4]);
      expect(topscript('const obj = { a: 1, b: 2 }; const newObj = { ...obj, c: 3 }; newObj')).toEqual({ a: 1, b: 2, c: 3 });
      expect(topscript('const arr1 = [1, 2]; const arr2 = [3, 4]; const newArr = [...arr1, ...arr2]; newArr')).toEqual([1, 2, 3, 4]);
      expect(topscript('const obj1 = { a: 1 }; const obj2 = { b: 2 }; const newObj = { ...obj1, ...obj2 }; newObj')).toEqual({ a: 1, b: 2 });
      expect(topscript('function f(...args) { return args; } f(1, 2, 3)')).toEqual([1, 2, 3]);
      expect(topscript('const fn = (...args) => args; fn(1, 2, 3)')).toEqual([1, 2, 3]);

      expect(() => topscript('const [a, b, ...rest] = [1, 2, 3, 4]; rest')).toThrow('Unknown variable declaration ArrayPattern');
      expect(() => topscript('const { a, b, ...rest } = { a: 1, b: 2, c: 3 }; rest')).toThrow('Unknown variable declaration ObjectPattern');
    });

    it('evaluates binary expressions', () => {
      expect(topscript('2 + 3')).toBe(5);
      expect(topscript('5 - 2')).toBe(3);
      expect(topscript('2 * 3')).toBe(6);
      expect(topscript('6 / 2')).toBe(3);
      expect(topscript('7 % 3')).toBe(1);
      expect(topscript('2 ** 3')).toBe(8);
      expect(topscript('5 > 3')).toBe(true);
      expect(topscript('5 < 3')).toBe(false);
      expect(topscript('5 >= 5')).toBe(true);
      expect(topscript('5 <= 5')).toBe(true);
      expect(topscript('5 == 5')).toBe(true);
      expect(topscript('5 === 5')).toBe(true);
      expect(topscript('5 != 3')).toBe(true);
      expect(topscript('5 !== 3')).toBe(true);
    });

    it('evaluates logical expressions', () => {
      expect(topscript('true && true')).toBe(true);
      expect(topscript('true && false')).toBe(false);
      expect(topscript('false || true')).toBe(true);
      expect(topscript('false || false')).toBe(false);
    });

    it('evaluates unary expressions', () => {
      expect(topscript('!true')).toBe(false);
      expect(topscript('!false')).toBe(true);
      expect(topscript('-5')).toBe(-5);
      expect(topscript('+5')).toBe(5);
    });

    it('evaluates variable declarations', () => {
      expect(topscript('const x = 5; x')).toBe(5);
      expect(topscript('let x = 5; x')).toBe(5);
    });

    it('evaluates object assignments', () => {
      expect(topscript(`
        const obj = {};
        obj.a = 1;
        obj
      `)).toEqual({ a: 1 });

      expect(topscript(`
        const obj = { a: 1 };
        obj.a = 2;
        obj
      `)).toEqual({ a: 2 });

      expect(topscript(`
        const obj = { a: { b: 1 } };
        obj.a.b = 2;
        obj
      `)).toEqual({ a: { b: 2 } });

      expect(topscript(`
        const obj = { a: { bc: 1 } };
        obj.a['b' + 'c'] = 2;
        obj
      `)).toEqual({ a: { bc: 2 } });

      expect(topscript(`
        const obj = {};
        const key1 = 'key';
        const key2 = 0;
        obj[key1] = 'value';
        obj[key2] = 'zero';
        obj
      `)).toEqual({ key: 'value', '0': 'zero' });
    });

    it('evaluates iifs', () => {
      expect(topscript('(() => 42)()')).toBe(42);
      expect(topscript('((x) => { return x; })(42)')).toBe(42);
      expect(topscript('(function(x) { return x; })(42)')).toBe(42);
    });

    it('evaluates update expressions', () => {
      expect(topscript('let x = 5; x++; x')).toBe(6);
      expect(topscript('let x = 5; x--; x')).toBe(4);
      expect(topscript('let x = 5; ++x; x')).toBe(6);
      expect(topscript('let x = 5; --x; x')).toBe(4);
      expect(topscript('let x = 5; x++')).toBe(5);
      expect(topscript('let x = 5; x--')).toBe(5);
      expect(topscript('let x = 5; ++x')).toBe(6);
      expect(topscript('let x = 5; --x')).toBe(4);
      expect(topscript('let arr = [1, 2, 3]; arr[0]++; arr')).toEqual([2, 2, 3]);
      expect(topscript('let arr = [1, 2, 3]; arr[1]--; arr')).toEqual([1, 1, 3]);
      expect(topscript('let arr = [1, 2, 3]; ++arr[0]; arr')).toEqual([2, 2, 3]);
      expect(topscript('let arr = [1, 2, 3]; --arr[1]; arr')).toEqual([1, 1, 3]);
      expect(topscript('let arr = [1, 2, 3]; const i = 0; arr[i]++; arr')).toEqual([2, 2, 3]);
      expect(topscript('let arr = [1, 2, 3]; const i = 1; arr[i]--; arr')).toEqual([1, 1, 3]);
      expect(topscript('let obj = { a: 1 }; obj.a++; obj')).toEqual({ a: 2 });
      expect(topscript('let obj = { a: 1 }; obj.a--; obj')).toEqual({ a: 0 });
      expect(topscript('let obj = { a: 1 }; ++obj.a; obj')).toEqual({ a: 2 });
      expect(topscript('let obj = { a: 1 }; --obj.a; obj')).toEqual({ a: 0 });
      expect(topscript('let obj = { a: 1 }; const key = "a"; obj[key]++; obj')).toEqual({ a: 2 });
      expect(topscript('let obj = { a: 1 }; const key = "a"; obj[key]--; obj')).toEqual({ a: 0 });
      expect(() => topscript('const x = 5; x++')).toThrow('Cannot redefine property: x');
    });

    it('evaluates array assignments', () => {
      expect(topscript(`
        const arr = [1, 2, 3];
        arr[0] = 4;
        arr
      `)).toEqual([4, 2, 3]);

      expect(topscript(`
        const arr = [[1, 2, 3]];
        arr[0][1] = 4;
        arr
      `)).toEqual([[1, 4, 3]]);

      expect(topscript(`
        const arr = [];
        arr[0] = 1;
        arr[1] = 2;
        arr[2] = 3;
        arr
      `)).toEqual([1, 2, 3]);

      expect(topscript(`
        const arr = [];
        const i = 0;
        arr[i] = 1;
        arr['1'] = 2;
        arr[2] = 3;
        arr
      `)).toEqual([1, 2, 3]);
    });

    it('evaluates arrays', () => {
      expect(topscript('[1, 2, 3]')).toEqual([1, 2, 3]);

      expect(topscript(`
        const x = [1, 2];
        const y = [...x, 3];
        y
      `)).toEqual([1, 2, 3]);
    });

    it('evaluates array access', () => {
      expect(topscript('[1, 2, 3][0]')).toBe(1);
      expect(topscript('[1, 2, 3][1]')).toBe(2);
    });

    it('evaluates array methods', () => {
      expect(topscript('[1, 2, 3].map((x) => x + 1)')).toEqual([2, 3, 4]);
      expect(topscript('[1, 2, 3, 4].filter((x) => x % 2 === 0)')).toEqual([2, 4]);
      expect(topscript('[1, 2, 3, 4].some((x) => x === 2)')).toEqual(true);
      expect(topscript('[1, 2, 3, 4].every((x) => x === 2)')).toEqual(false);
    });

    it('evaluates string concatenation', () => {
      expect(topscript('"hello" + " " + "world"')).toBe('hello world');
    });

    it('evaluates string interpolation', () => {
      expect(topscript('`${"hello"}, ${"world"}`')).toBe('hello, world');
      expect(topscript('`hello ${1 + 2}`')).toBe('hello 3');
      expect(topscript('(() => `hello, ${"world"}`)()')).toBe('hello, world');
    });
    
    it('evaluates complex template literals correctly', () => {
      expect(topscript('``')).toBe('');
      expect(topscript('`just text`')).toBe('just text');
      expect(topscript('`${1}${2}${3}`')).toBe('123');
      expect(topscript('`${1}${2}${3}suffix`')).toBe('123suffix');
      expect(topscript('`prefix${1}${2}${3}`')).toBe('prefix123');
      expect(topscript('`${`nested ${1 + 2}`}`')).toBe('nested 3');

      expect(topscript(`
        function getWord() { return "dynamic"; }
        \`This is a \${getWord()} template literal\`
      `)).toBe('This is a dynamic template literal');

      expect(topscript(`
        const obj = { name: "World" };
        const arr = ["Hello"];
        \`\${arr[0]}, \${obj.name}!\`
      `)).toBe('Hello, World!');
    });

    it('evaluates built-in member functions', () => {
      expect(topscript('"hello".length')).toBe(5);
      expect(topscript('"hello".toUpperCase()')).toBe('HELLO');
      expect(topscript('"hello".indexOf("e")')).toBe(1);
      expect(topscript('"hello".slice(1, 4)')).toBe('ell');
    });

    it('evaluates the ternary operator', () => {
      expect(topscript('true ? 1 : 2')).toBe(1);
      expect(topscript('false ? 1 : 2 * 2')).toBe(4);
      expect(topscript('1 > 2 ? "greater" : "lesser"')).toBe('lesser');
      expect(topscript('1 < 2 ? "lesser" : "greater"')).toBe('lesser');
      expect(topscript('true ? (true ? "yes" : "no") : "no"')).toBe('yes');
    });

    it('evaluates objects', () => {
      expect(topscript('({ a: 1, b: 2 })')).toEqual({ a: 1, b: 2 });
      expect(topscript('({ "a": 1, ["b"]: 2, [3]: 4, [`${"c"}`]: 5 })')).toEqual({ a: 1, b: 2, 3: 4, c: 5 });

      expect(topscript(`
        const x = { a: 1 };
        const y = { ...x, b: 2 };
        y
      `)).toEqual({ a: 1, b: 2 });

      expect(topscript('const obj = { a: { b() { return 1; } } }; obj.a.b()')).toBe(1);
    });

    it('does not support destructuring', () => {
      expect(() => topscript('const { a } = { a: 1 }; a')).toThrow('Unknown variable declaration ObjectPattern');
    });

    it('allows object property access', () => {
      expect(topscript('({ a: 1, b: 2 }).a')).toBe(1);
      expect(topscript('({ a: 1, b: 2 })["a"]')).toBe(1);
      expect(topscript('({ a: 1, b: 2 }).b')).toBe(2);
      expect(topscript('({ a: 1, b: 2 })["b"]')).toBe(2);
    });

    it('evaluates function declarations', () => {
      expect(topscript(`
        function add(a, b) {
          return a + b;
        }

        add(2, 3)
      `)).toBe(5);
    });

    it('evaluates arrow functions', () => {
      expect(topscript(`
        const add = (a, b) => a + b;
        add(2, 3)
      `)).toBe(5);
    });

    it('evaluates if statements', () => {
      expect(topscript(`
        let x = 0;

        if (true) {
          x = 1;
        }

        x
      `)).toBe(1);

      expect(topscript(`
        let x = 0;

        if (false) {
          x = 1;
        } else {
        x = 2;
        }

        x
      `)).toBe(2);

      expect(topscript(`
        let x = 0;

        if (false) {
          x = 1;
        } else if (true) {
          x = 2;
        }

        x
      `)).toBe(2);

      expect(topscript(`
        let x = 0;

        if (false) {
          x = 1;
        } else if (false) {
        x = 2;
        } else {
        x = 3;
        }

        x
      `)).toBe(3);

      expect(topscript('if (true) { 1 } else { 2 }')).toBeUndefined();
      expect(topscript('if (true) 1')).toBeUndefined();
    });

    it('evaluates with context', () => {
      expect(topscript('x + 5', { x: 10 })).toBe(15);
      expect(topscript('greet(name)', { greet: (name: string) => `hello ${name}`, name: 'user' })).toBe('hello user');
    });

    it('handles rest parameters', () => {
      expect(topscript(`
        function sum(...nums) {
          return nums.reduce((acc, num) => acc + num, 0);
        }

        sum(1, 2, 3)
      `)).toBe(6);
    });

    it('throws on unknown variables', () => {
      expect(() => topscript('unknownVar')).toThrow('Unknown variable unknownVar');
    });

    it('throws on unsupported features', () => {
      expect(() => topscript('async function f() {}')).toThrow('Async functions are not supported');
      expect(() => topscript('const f = async () => {}')).toThrow('Async functions are not supported');
    });

    it('aborts execution after timeout', () => {
      expect(() => topscript('while(true) {}', {}, { timeout: 100 })).toThrow('Execution timed out');
    });

    it('evaluates while loops', () => {
      expect(topscript(`
        let i = 0;
        let sum = 0;
        
        while (i < 5) {
          sum += i;
          i += 1;
        }
        
        sum
      `)).toBe(10);
      
      expect(topscript(`
        let i = 10;
        
        while (i > 0) {
          i -= 1;
        }
        
        i
      `)).toBe(0);
      
      expect(topscript(`
        const arr = [];
        let i = 0;
        
        while (i < 3) {
          arr.push(i);
          i += 1;
        }
        
        arr
      `)).toEqual([0, 1, 2]);
    });

    it('throws on unsupported while loops', () => {
      expect(() => topscript('while (true) { break; }', {}, { disableWhileStatements: true }))
        .toThrow('While statements are not available');
    });

    it('supports null and undefined', () => {
      expect(topscript('null')).toBeNull();
      expect(topscript('undefined')).toBeUndefined();
      expect(topscript('const x = null; x')).toBeNull();
      expect(topscript('const y = undefined; y')).toBeUndefined();
      expect(topscript('(() => { return null; })()')).toBeNull();
      expect(topscript('(() => { return undefined; })()')).toBeUndefined();
    });

    it('supports safe navigation', () => {
      expect(topscript('const obj = { a: { b: 1 } }; obj.a.c')).toBe(undefined);
      expect(topscript('const obj = null; obj?.a.b.c')).toBeUndefined();
      expect(topscript('const obj = null; obj?.a?.b')).toBeUndefined();
      expect(topscript('const obj = { a: { b: 1 } }; obj?.a?.b')).toBe(1);
      expect(topscript('const obj = { a: null }; obj?.a?.b?.c')).toBeUndefined();
      expect(topscript('const obj = { a: null }; obj?.a?.["" + "b"]?.c')).toBeUndefined();

      expect(topscript('const arr = [1, 2, 3]; arr?.[0]')).toBe(1);
      expect(topscript('const arr = [1, 2, 3]; arr?.[3]?.x')).toBeUndefined();
      expect(topscript('const arr = null; arr?.[0]')).toBeUndefined();
      expect(topscript('const arr = [1, 2, 3]; arr?.length')).toBe(3);
      expect(topscript('const arr = null; arr?.length')).toBeUndefined();

      expect(topscript('const obj = { a: { b: () => "result" } }; obj?.a?.b()')).toEqual('result');
      expect(() => topscript('const obj = { a: { b: "result" } }; obj?.a?.b()')).toThrow('b is not a function');
      expect(topscript('const obj = { a: undefined }; obj?.a?.c()')).toBeUndefined();
      expect(topscript('const obj = { a: {} }; obj?.a?.b?.()')).toBeUndefined();
      expect(() => topscript('const obj = { a: undefined }; obj?.a.c()')).toThrow('Cannot read properties of undefined (reading \'c\')');
      expect(topscript('const obj = null; obj?.a.b()')).toBeUndefined();
      expect(topscript('const obj = null; obj?.["a"].b()')).toBeUndefined();
      expect(topscript('const obj = null; const key = "a"; obj?.[key].b()')).toBeUndefined();
      expect(topscript('const obj = null; const key = () => "a"; obj?.[key()].b()')).toBeUndefined();
      expect(topscript('const obj = {}; obj["a"]?.()')).toBeUndefined();
      expect(topscript('const obj = {}; const key = "a"; obj[key]?.()')).toBeUndefined();
      expect(topscript('const arr = []; arr[0]?.()')).toBeUndefined();
      expect(topscript('const arr = null; arr?.[0]()')).toBeUndefined();
      expect(topscript('const arr = null; const i = 0; arr?.[i]()')).toBeUndefined();
      expect(topscript('const arr = null; const index = () =>  0; arr?.[index()]()')).toBeUndefined();
      expect(topscript('const arr = []; const i = 0; arr[i]?.()')).toBeUndefined();
      expect(topscript('const arr = []; const index = () => 0; arr[index()]?.()')).toBeUndefined();

      expect(topscript('const obj = { a: "b", c: "d" }; delete obj?.a; obj')).toEqual({ c: 'd' });
      expect(topscript('const obj = {}; delete obj.a?.b')).toEqual(true);
      expect(topscript('const obj = null; delete obj?.a')).toEqual(true);
    });

    it('supports top level return', () => {
      expect(topscript('return 42', {}, { allowReturnOutsideFunction: true })).toBe(42);
      expect(topscript('42', {}, { allowReturnOutsideFunction: true })).toBe(42);
      expect(topscript('if(true) return 42', {}, { allowReturnOutsideFunction: true })).toBe(42);
      expect(topscript('return "hello"', {}, { allowReturnOutsideFunction: true })).toBe('hello');
      expect(topscript('"hello"', {}, { allowReturnOutsideFunction: true })).toBe('hello');
      expect(topscript('return true', {}, { allowReturnOutsideFunction: true })).toBe(true);
      expect(topscript('true', {}, { allowReturnOutsideFunction: true })).toBe(true);
      expect(topscript('return null', {}, { allowReturnOutsideFunction: true })).toBeNull();
      expect(topscript('null', {}, { allowReturnOutsideFunction: true })).toBeNull();
      expect(topscript('return undefined', {}, { allowReturnOutsideFunction: true })).toBeUndefined();
      expect(topscript('undefined', {}, { allowReturnOutsideFunction: true })).toBeUndefined();
      expect(() => topscript('return 42')).toThrow('\'return\' outside of function (1:0)');
    });
    
    it('evaluates compound assignment operators', () => {
      expect(topscript('let x = 5; x += 3; x')).toBe(8);
      expect(topscript('let x = 5; x -= 3; x')).toBe(2);
      expect(topscript('let x = 5; x *= 3; x')).toBe(15);
      expect(topscript('let x = 6; x /= 3; x')).toBe(2);
      expect(topscript('let x = 7; x %= 3; x')).toBe(1);
      expect(topscript('let x = 2; x **= 3; x')).toBe(8);
      
      expect(topscript('let x = 5; x &= 3; x')).toBe(1);
      expect(topscript('let x = 5; x |= 3; x')).toBe(7);
      expect(topscript('let x = 5; x ^= 3; x')).toBe(6);
      expect(topscript('let x = 5; x <<= 1; x')).toBe(10);
      expect(topscript('let x = 5; x >>= 1; x')).toBe(2);
      
      expect(topscript(`
        const obj = { a: 5 };
        obj.a += 3;
        obj
      `)).toEqual({ a: 8 });
      
      expect(topscript(`
        const arr = [1, 2, 3];
        arr[1] *= 3;
        arr
      `)).toEqual([1, 6, 3]);
      
      expect(topscript(`
        const obj = { value: 5 };
        obj['value'] += 3;
        obj
      `)).toEqual({ value: 8 });
    });

    describe('scope', () => {
      it('creates a new scope for block statements', () => {
        expect(topscript(`
          let x = 1;
          { let x = 2; }
          x
        `)).toBe(1);
      });

      it('supports variable shadowing', () => {
        expect(topscript(`
          let x = 1;
          { let x = 2; x; }
        `)).toBe(2);
      });

      it('creates new scope for functions', () => {
        expect(topscript(`
          let x = 1;

          function f() {
            let x = 2;
            return x;
          }

          f()
        `)).toBe(2);
      });

      it('supports accessing parent scope variables', () => {
        expect(topscript(`
          let x = 1;

          function f() {
            return x;
          }

          f()
        `)).toBe(1);
      });

      it('keeps parent scope variables intact', () => {
        expect(topscript(`
          let x = 1;

          function f() {
            let x = 2;
          }

          f();
          x
        `)).toBe(1);
      });

      it('updates parent scope variables when no local declaration exists', () => {
        expect(topscript(`
          let x = 1;

          function f() {
            x = 2;
          }

          f();
          x`
        )).toBe(2);
      });

      it('creates proper closures', () => {
        expect(topscript(`
          function createCounter() {
            let count = 0;

            return function() {
              count = count + 1;

              return count;
            };
          }

          const counter = createCounter();

          counter();
          counter();
        `)).toBe(2);
      });

      it('supports nested function scopes', () => {
        expect(topscript(`
          function outer() {
            let x = 1;

            function inner() {
              let y = 2;

              return x + y;
            }

            return inner();
          }

          outer();
        `)).toBe(3);
      });

      it('maintains separate scopes for multiple closures', () => {
        expect(topscript(`
          function createCounter(initial) {
            let count = initial;

            return function() {
              count = count + 1;

              return count;
            };
          }

          const counter1 = createCounter(0);
          const counter2 = createCounter(10);

          counter1();
          counter2();
          [counter1(), counter2()]
        `)).toEqual([2, 12]);
      });

      it('correctly handles the arguments object', () => {
        expect(topscript(`
          function sum() {
            let total = 0;

            total = total + arguments.length;

            return total;
          }

          sum(1, 2, 3, 4);
        `)).toBe(4);
      });
    });

    it('correctly handles the delete operator', () => {
      expect(topscript(`
          const obj = { a: 1, b: 2 };
          delete obj.a;
          obj
        `)).toEqual({ b: 2 });

      expect(topscript(`
          const obj = { a: { b: 1, c: 2 } };
          delete obj.a.b;
          obj
        `)).toEqual({ a: { c: 2 } });

      expect(topscript(`
          const arr = [1, 2, 3];
          delete arr[1];
          arr
        `)).toEqual([1, undefined, 3]);

      expect(topscript(`
          const arr = [1, 2, 3];
          const i = 1;
          delete arr[i];
          arr
        `)).toEqual([1, undefined, 3]);

      expect(topscript(`
          const obj = { a1: 1, a2: 2 };
          const key = 'a';
          delete obj[key + '1'];
          obj
        `)).toEqual({ a2: 2 });
    });

    it('correctly evaluates call expressions', () => {
      expect(topscript(`
        function greet(name) {
          return 'Hello, ' + name;
        }

        greet('World')
      `)).toBe('Hello, World');

      expect(topscript('const add = (a, b) => a + b; add(2, 3)')).toBe(5);
      expect(topscript('const obj = { method: () => "called" }; obj.method()')).toBe('called');

      expect(topscript(`
        const obj = {
          method: function() {
            return 'method called';
          }
        };

        obj['method']()
      `)).toBe('method called');

      expect(topscript(`
        const obj = { method: () => 'method called' };
        const key = 'method';
        obj[key]()
      `)).toBe('method called');

      expect(topscript('const arr = [1, 2, 3]; arr.map(x => x * 2)')).toEqual([2, 4, 6]);
      expect(topscript('const arr = [() => "called"]; arr[0]()')).toBe('called');
      expect(topscript('const arr = [() => "called"]; const i = 0; arr[i]()')).toBe('called');

      expect(topscript(`
        const arr = [() => 'method called'];
        const index = () => 0;
        arr[index()]()
      `)).toBe('method called');
    });
  });
});