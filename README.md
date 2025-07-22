# Topscript

Topscript allows to safely eval a subset of javascript. It is written using
the [acorn](https://github.com/acornjs/acorn) javascript parser.

## Installation

```sh
npm install topscript
```

## Usage

To execute a script, simply do:

```js
import { topscript } from 'topscript';

topscript('1 + 2') // => 3;
topscript('log("hello, world!")', { log: console.log }) // => undefined

topscript(`
  function add(a, b) {
    return a + b;
  }

  add(1, 2)
`) // => 3

topscript('[1, 2, 3].slice(1)') // => [2, 3]
```

Topscript also allows to validate a supplied script for parsing errors:

```js
import { validate } from 'topscript';

validate('1 + 2') // => undefined
validate('1 +') // throws an error
```

## Supported Features

Topscript supports a wide range of JavaScript features:

- Variables (const, let)
- Literals (strings, numbers, booleans, objects, arrays)
- Functions (declarations, expressions, arrow functions)
- Control flow (if, else, while)
- Template literals and string interpolation
- Closures and nested scopes
- Compound assignment operators (+=, -=, etc)
- Basic array and object operations
- Rest parameters

## Execution Safety Features

Topscript includes several safety mechanisms:

- **Timeout**: You can specify a execution timeout (ms)
  ```js
  topscript('while(true) {}', {}, { timeout: 1_000 });
  ```

- **Disable while loops**: You can also disable while statements alltogether
  ```js
  topscript('while(true) {}', {}, { disableWhileStatements: true }) // throws
  ```

- **Max stack size**: You can specify a max stack size
  ```js
  topscript('const fn = () => fn(); fn();', {}, { maxStackSize: 10 }) // throws
  topscript('const fn1 = () => fn2(); const fn2 = () => 0; fn1()', {}, { maxStackSize: 1 }); // throws
  ```

## Unsupported Features

Some JavaScript features are not supported:

- Async/await functions
- Optional chaining
- Destructuring assignments
- Classes
- Try/catch blocks

## Semantic Versioning

Topscript is using Semantic Versioning: [SemVer](http://semver.org/)

## Contributing

Bug reports and pull requests are welcome on GitHub at
https://github.com/mrkamel/topscript

## License

The library is available as open source under the terms of the 
[MIT License](https://opensource.org/licenses/MIT).
