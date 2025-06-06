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
  });

  describe('topscript', () => {
    it('evaluates literals', async () => {
      expect(await topscript('42')).toBe(42);
      expect(await topscript('"hello"')).toBe('hello');
      expect(await topscript('true')).toBe(true);
      expect(await topscript('false')).toBe(false);
      expect(await topscript('null')).toBe(null);
    });

    it('evaluates binary expressions', async () => {
      expect(await topscript('2 + 3')).toBe(5);
      expect(await topscript('5 - 2')).toBe(3);
      expect(await topscript('2 * 3')).toBe(6);
      expect(await topscript('6 / 2')).toBe(3);
      expect(await topscript('7 % 3')).toBe(1);
      expect(await topscript('2 ** 3')).toBe(8);
      expect(await topscript('5 > 3')).toBe(true);
      expect(await topscript('5 < 3')).toBe(false);
      expect(await topscript('5 >= 5')).toBe(true);
      expect(await topscript('5 <= 5')).toBe(true);
      expect(await topscript('5 == 5')).toBe(true);
      expect(await topscript('5 === 5')).toBe(true);
      expect(await topscript('5 != 3')).toBe(true);
      expect(await topscript('5 !== 3')).toBe(true);
    });

    it('evaluates logical expressions', async () => {
      expect(await topscript('true && true')).toBe(true);
      expect(await topscript('true && false')).toBe(false);
      expect(await topscript('false || true')).toBe(true);
      expect(await topscript('false || false')).toBe(false);
    });

    it('evaluates unary expressions', async() => {
      expect(await topscript('!true')).toBe(false);
      expect(await topscript('!false')).toBe(true);
      expect(await topscript('-5')).toBe(-5);
      expect(await topscript('+5')).toBe(5);
    });

    it('evaluates variable declarations', async() => {
      expect(await topscript('const x = 5; x')).toBe(5);
      expect(await topscript('let x = 5; x')).toBe(5);
    });

    it('evaluates object assignments', async() => {
      expect(await topscript(`
        const obj = {};
        obj.a = 1;
        obj
      `)).toEqual({ a: 1 });

      expect(await topscript(`
        const obj = { a: 1 };
        obj.a = 2;
        obj
      `)).toEqual({ a: 2 });

      expect(await topscript(`
        const obj = { a: { b: 1 } };
        obj.a.b = 2;
        obj
      `)).toEqual({ a: { b: 2 } });

      expect(await topscript(`
        const obj = { a: { bc: 1 } };
        obj.a['b' + 'c'] = 2;
        obj
      `)).toEqual({ a: { bc: 2 } });
    });

    it('evaluates iifs', async() => {
      expect(await topscript('(() => 42)()')).toBe(42);
      expect(await topscript('((x) => { return x; })(42)')).toBe(42);
      expect(await topscript('(function(x) { return x; })(42)')).toBe(42);
    });

    it('evaluates array assignments', async () => {
      expect(await topscript(`
        const arr = [1, 2, 3];
        arr[0] = 4;
        arr
      `)).toEqual([4, 2, 3]);

      expect(await topscript(`
        const arr = [[1, 2, 3]];
        arr[0][1] = 4;
        arr
      `)).toEqual([[1, 4, 3]]);

      expect(await topscript(`
        const arr = [];
        arr[0] = 1;
        arr[1] = 2;
        arr[2] = 3;
        arr
      `)).toEqual([1, 2, 3]);
    });

    it('evaluates arrays', async () => {
      expect(await topscript('[1, 2, 3]')).toEqual([1, 2, 3]);

      expect(await topscript(`
        const x = [1, 2];
        const y = [...x, 3];
        y
      `)).toEqual([1, 2, 3]);
    });

    it('evaluates array access', async() => {
      expect(await topscript('[1, 2, 3][0]')).toBe(1);
      expect(await topscript('[1, 2, 3][1]')).toBe(2);
    });

    it('evaluates string concatenation', async () => {
      expect(await topscript('"hello" + " " + "world"')).toBe('hello world');
    });

    it('evaluates string interpolation', async () => {
      expect(await topscript('`${"hello"}, ${"world"}`')).toBe('hello, world');
      expect(await topscript('`hello ${1 + 2}`')).toBe('hello 3');
      expect(await topscript('(() => `hello, ${"world"}`)()')).toBe('hello, world');
    });
    
    it('evaluates complex template literals correctly', async () => {
      expect(await topscript('``')).toBe('');
      expect(await topscript('`just text`')).toBe('just text');
      expect(await topscript('`${1}${2}${3}`')).toBe('123');
      expect(await topscript('`${1}${2}${3}suffix`')).toBe('123suffix');
      expect(await topscript('`prefix${1}${2}${3}`')).toBe('prefix123');
      expect(await topscript('`${`nested ${1 + 2}`}`')).toBe('nested 3');

      expect(await topscript(`
        function getWord() { return "dynamic"; }
        \`This is a \${getWord()} template literal\`
      `)).toBe('This is a dynamic template literal');

      expect(await topscript(`
        const obj = { name: "World" };
        const arr = ["Hello"];
        \`\${arr[0]}, \${obj.name}!\`
      `)).toBe('Hello, World!');
    });

    it('evaluates built-in member functions', async () => {
      expect(await topscript('"hello".length')).toBe(5);
      expect(await topscript('"hello".toUpperCase()')).toBe('HELLO');
      expect(await topscript('"hello".indexOf("e")')).toBe(1);
      expect(await topscript('"hello".slice(1, 4)')).toBe('ell');
    });

    it('evaluates objects', async () => {
      expect(await topscript('({ a: 1, b: 2 })')).toEqual({ a: 1, b: 2 });
      expect(await topscript('({ "a": 1, ["b"]: 2, [3]: 4, [`${"c"}`]: 5 })')).toEqual({ a: 1, b: 2, 3: 4, c: 5 });

      expect(await topscript(`
        const x = { a: 1 };
        const y = { ...x, b: 2 };
        y
      `)).toEqual({ a: 1, b: 2 });

      expect(await topscript('const obj = { a: { b() { return 1; } } }; obj.a.b()')).toBe(1);
    });

    it('does not support optional chaining', async () => {
      await expect(() => topscript('({ a: 1 }).b?.c')).rejects.toThrow(/Unexpected token/);
    });

    it('does not support destructuring', async () => {
      await expect(() => topscript('const { a } = { a: 1 }; a')).rejects.toThrow('Unknown variable declaration ObjectPattern');
    });

    it('allows object property access', async () => {
      expect(await topscript('({ a: 1, b: 2 }).a')).toBe(1);
      expect(await topscript('({ a: 1, b: 2 })["a"]')).toBe(1);
      expect(await topscript('({ a: 1, b: 2 }).b')).toBe(2);
      expect(await topscript('({ a: 1, b: 2 })["b"]')).toBe(2);
    });

    it('evaluates function declarations', async () => {
      expect(await topscript(`
        function add(a, b) {
          return a + b;
        }

        add(2, 3)
      `)).toBe(5);
    });

    it('evaluates arrow functions', async () => {
      expect(await topscript(`
        const add = (a, b) => a + b;
        add(2, 3)
      `)).toBe(5);
    });

    it('evaluates if statements', async () => {
      expect(await topscript(`
        let x = 0;

        if (true) {
          x = 1;
        }

        x
      `)).toBe(1);

      expect(await topscript(`
        let x = 0;

        if (false) {
          x = 1;
        } else {
        x = 2;
        }

        x
      `)).toBe(2);

      expect(await topscript(`
        let x = 0;

        if (false) {
          x = 1;
        } else if (true) {
        x = 2;
        }

        x
      `)).toBe(2);

      expect(await topscript(`
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

      expect(await topscript('if (true) { 1 } else { 2 }')).toBeUndefined();
      expect(await topscript('if (true) 1')).toBeUndefined();
    });

    it('evaluates with context', async () => {
      expect(await topscript('x + 5', { x: 10 })).toBe(15);
      expect(await topscript('greet(name)', { greet: (name: string) => `hello ${name}`, name: 'user' })).toBe('hello user');
    });

    it('handles rest parameters', async () => {
      expect(await topscript(`
        function sum(...nums) {
          return nums.reduce((acc, num) => acc + num, 0);
        }

        sum(1, 2, 3)
      `)).toBe(6);
    });

    it('throws on unknown variables', async () => {
      await expect(() => topscript('unknownVar')).rejects.toThrow('Unknown variable unknownVar');
    });

    it('throws on unsupported features', async () => {
      await expect(() => topscript('async function f() {}')).rejects.toThrow('Async functions are not supported');
      await expect(() => topscript('const f = async () => {}')).rejects.toThrow('Async functions are not supported');
    });
    
    it('aborts execution when abort signal is triggered', async () => {
      const controller = new AbortController();
      const scriptPromise = topscript('while(true) {}', {}, { signal: controller.signal });
      
      setTimeout(() => controller.abort(), 100);
      
      await expect(scriptPromise).rejects.toThrow('Execution aborted');
    });
    
    it('evaluates while loops', async () => {
      expect(await topscript(`
        let i = 0;
        let sum = 0;
        
        while (i < 5) {
          sum += i;
          i += 1;
        }
        
        sum
      `)).toBe(10);
      
      expect(await topscript(`
        let i = 10;
        
        while (i > 0) {
          i -= 1;
        }
        
        i
      `)).toBe(0);
      
      expect(await topscript(`
        const arr = [];
        let i = 0;
        
        while (i < 3) {
          arr.push(i);
          i += 1;
        }
        
        arr
      `)).toEqual([0, 1, 2]);
    });
    
    it('evaluates compound assignment operators', async () => {
      expect(await topscript('let x = 5; x += 3; x')).toBe(8);
      expect(await topscript('let x = 5; x -= 3; x')).toBe(2);
      expect(await topscript('let x = 5; x *= 3; x')).toBe(15);
      expect(await topscript('let x = 6; x /= 3; x')).toBe(2);
      expect(await topscript('let x = 7; x %= 3; x')).toBe(1);
      expect(await topscript('let x = 2; x **= 3; x')).toBe(8);
      
      expect(await topscript('let x = 5; x &= 3; x')).toBe(1);
      expect(await topscript('let x = 5; x |= 3; x')).toBe(7);
      expect(await topscript('let x = 5; x ^= 3; x')).toBe(6);
      expect(await topscript('let x = 5; x <<= 1; x')).toBe(10);
      expect(await topscript('let x = 5; x >>= 1; x')).toBe(2);
      
      expect(await topscript(`
        const obj = { a: 5 };
        obj.a += 3;
        obj
      `)).toEqual({ a: 8 });
      
      expect(await topscript(`
        const arr = [1, 2, 3];
        arr[1] *= 3;
        arr
      `)).toEqual([1, 6, 3]);
      
      expect(await topscript(`
        const obj = { value: 5 };
        obj['value'] += 3;
        obj
      `)).toEqual({ value: 8 });
    });

    describe('scope', () => {
      it('creates a new scope for block statements', async () => {
        expect(await topscript(`
          let x = 1;
          { let x = 2; }
          x
        `)).toBe(1);
      });

      it('supports variable shadowing', async () => {
        expect(await topscript(`
          let x = 1;
          { let x = 2; x; }
        `)).toBe(2);
      });

      it('creates new scope for functions', async () => {
        expect(await topscript(`
          let x = 1;

          function f() {
            let x = 2;
            return x;
          }

          f()
        `)).toBe(2);
      });

      it('supports accessing parent scope variables', async () => {
        expect(await topscript(`
          let x = 1;

          function f() {
            return x;
          }

          f()
        `)).toBe(1);
      });

      it('keeps parent scope variables intact', async () => {
        expect(await topscript(`
          let x = 1;

          function f() {
            let x = 2;
          }

          f();
          x
        `)).toBe(1);
      });

      it('updates parent scope variables when no local declaration exists', async () => {
        expect(await topscript(`
          let x = 1;

          function f() {
            x = 2;
          }

          f();
          x`
        )).toBe(2);
      });

      it('creates proper closures', async () => {
        expect(await topscript(`
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

      it('supports nested function scopes', async () => {
        expect(await topscript(`
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

      it('maintains separate scopes for multiple closures', async () => {
        expect(await topscript(`
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

      it('correctly handles the arguments object', async () => {
        expect(await topscript(`
          function sum() {
            let total = 0;

            total = total + arguments.length;

            return total;
          }

          sum(1, 2, 3, 4);
        `)).toBe(4);
      });

      it('correctly handles the delete operator', async () => {
        expect(await topscript(`
          const obj = { a: 1, b: 2 };
          delete obj.a;
          obj
        `)).toEqual({ b: 2 });

        expect(await topscript(`
          const obj = { a: { b: 1, c: 2 } };
          delete obj.a.b;
          obj
        `)).toEqual({ a: { c: 2 } });

        expect(await topscript(`
          const arr = [1, 2, 3];
          delete arr[1];
          arr
        `)).toEqual([1, undefined, 3]);
      });
    });
  });
});