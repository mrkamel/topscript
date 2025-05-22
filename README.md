# Topscript

Topscript allows to safely eval a subset of javascript. It is written using
the [acorn](https://github.com/acornjs/acorn) javascript parser.

## Installation

```sh
npm install topscript
```

## Usage

To execute a script, simply do (note that `topscript` is an async function and must be awaited):

```js
import { topscript } from 'topscript';

await topscript('1 + 2') // => 3;
await topscript('log("hello, world!")', { log: console.log }) // => undefined

await topscript(`
  function add(a, b) {
    return a + b;
  }

  add(1, 2)
`) // => 3

await topscript('[1, 2, 3].slice(1)') // => [2, 3]
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

- **Abort Signal Support**: You can abort long-running scripts using an AbortSignal
  ```js
  const controller = new AbortController();
  const scriptPromise = await topscript('while(true) {}', {}, { signal: controller.signal });

  controller.abort(); // Will stop the execution
  ```

- **Execution Yield**: Long-running scripts periodically yield control back to the event loop to prevent blocking

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