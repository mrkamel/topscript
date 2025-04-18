import { describe, it, expect } from 'vitest';
import { topscript } from './index';

describe('topscript', () => {
  it('evaluates literals', () => {
    expect(topscript('42')).toBe(42);
    expect(topscript('"hello"')).toBe('hello');
    expect(topscript('true')).toBe(true);
    expect(topscript('false')).toBe(false);
    expect(topscript('null')).toBe(null);
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

  it('evaluates arrays', () => {
    expect(topscript('[1, 2, 3]')).toEqual([1, 2, 3]);

    expect(topscript(`
      const x = [1, 2];
      const y = [...x, 3];
      y
    `)).toEqual([1, 2, 3]);
  });

  it('allows array access', () => {
    expect(topscript('[1, 2, 3][0]')).toBe(1);
    expect(topscript('[1, 2, 3][1]')).toBe(2);
  });

  it('evaluates string concatenation', () => {
    expect(topscript('"hello" + " " + "world"')).toBe('hello world');
  });

  it('evaluates built-in member functions', () => {
    expect(topscript('"hello".length')).toBe(5);
    expect(topscript('"hello".toUpperCase()')).toBe('HELLO');
    expect(topscript('"hello".indexOf("e")')).toBe(1);
    expect(topscript('"hello".slice(1, 4)')).toBe('ell');
  });

  it('evaluates objects', () => {
    expect(topscript('({ a: 1, b: 2 })')).toEqual({ a: 1, b: 2 });

    expect(topscript(`
      const x = { a: 1 };
      const y = { ...x, b: 2 };
      y
    `)).toEqual({ a: 1, b: 2 });
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

    expect(topscript(`if (true) { 1 } else { 2 }`)).toBeUndefined()
    expect(topscript(`if (true) 1`)).toBeUndefined()
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
    expect(() => topscript('unknownVar')).toThrow();
  });

  it('throws on unsupported features', () => {
    expect(() => topscript('async function f() {}')).toThrow();
    expect(() => topscript('const f = async () => {}')).toThrow();
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
});