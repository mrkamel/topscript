# Topscript

Topscript allows to safely eval a subset of javascript. It is written using
the [acorn](https://github.com/acornjs/acorn) javascript parser.

## Installation

```sh
npm install topscript
```

## Usage

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

## Semantic Versioning

Topscript is using Semantic Versioning: [SemVer](http://semver.org/)

## Contributing

Bug reports and pull requests are welcome on GitHub at
https://github.com/mrkamel/topscript

## License

The library is available as open source under the terms of the 
[MIT License](https://opensource.org/licenses/MIT).