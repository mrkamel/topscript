import {
  parse, AnyNode, ArrayExpression, ObjectExpression, ExpressionStatement, IfStatement,
  BinaryExpression, LogicalExpression, UnaryExpression, AssignmentExpression, CallExpression,
  VariableDeclaration, Literal, BlockStatement, ArrowFunctionExpression, FunctionDeclaration,
  FunctionExpression, ReturnStatement, Pattern, AnonymousFunctionDeclaration, MemberExpression,
} from 'acorn';

type ObjectLiteral = { [key: string]: any };

function createScope(parent?: object) {
  const res: ObjectLiteral = {};

  if (parent) {
    Object.setPrototypeOf(res, parent);
  }

  return res;
}

// Redefines a property on an object, even if it doesn't exist on the
// object itself, but on a parent, i.e. a prototype.

function redefineProperty(obj: object, key: PropertyKey, properties: Parameters<typeof Object.defineProperty>[2]) {
  if (obj.hasOwnProperty(key)){
    Object.defineProperty(obj, key, properties);
    return;
  }

  redefineProperty(Object.getPrototypeOf(obj), key, properties);
}

function hasProperty(obj: object, key: PropertyKey): boolean {
  if (obj.hasOwnProperty(key)) return true;
  if (Object.getPrototypeOf(obj) === null) return false;

  return hasProperty(Object.getPrototypeOf(obj), key);
}

class ReturnException {
  value: object;

  constructor(value: object) {
    this.value = value;
  }
}

export function topscript(script: string, context: ObjectLiteral = {}): any {
  function visitExpressionStatement({ node, scope }: { node: ExpressionStatement, scope: object }): object {
    return visitNode({ node: node.expression, scope });
  }

  function visitArrayExpression({ expression, scope }: { expression: ArrayExpression, scope: object }): any[] {
    let res: any[] = [];

    expression.elements.forEach((element) => {
      if (element === null) {
        res.push(null);
        return;
      }

      switch (element.type) {
        case 'SpreadElement':
          res = [...res, ...visitNode({ node: element.argument, scope })];
          return;
        default:
          res.push(visitNode({ node: element, scope }));
          return;
      }
    });

    return res;
  }

  function visitObjectExpression({ expression, scope }: { expression: ObjectExpression, scope: object }): object {
    let res: ObjectLiteral = {};

    expression.properties.forEach((property) => {
      const type = property.type;

      switch (type) {
        case 'Property': {
          const value = visitNode({ node: property.value, scope });

          if (property.computed) {
            res[visitNode({ node: property.key, scope })] = value;
            return;
          }

          if (property.key.type !== 'Identifier') throw new Error(`Unknown key type ${property.key.type}`);
          res[property.key.name] = value;
          return;
        };
        case 'SpreadElement':
          res = { ...res, ...visitNode({ node: property.argument, scope }) };
          return;
        default:
          throw new Error(`Unknown property type ${type}`);
      }
    });

    return res;
  }

  function visitIfStatement({ node, scope }: { node: IfStatement, scope: object }) {
    if (visitNode({ node: node.test, scope })) {
      switch (node.consequent.type) {
        case 'BlockStatement':
          visitBlockStatement({ node: node.consequent, scope })();
          return;
        default:
          visitNode({ node: node.consequent, scope });
          return;
      }
    } else {
      if (node.alternate) {
        switch (node.alternate.type) {
          case 'BlockStatement':
            visitBlockStatement({ node: node.alternate, scope })();
            return;
          default:
            visitNode({ node: node.alternate, scope });
            return;
        }
      }
    }
  }

  function visitBinaryExpression({ expression, scope }: { expression: BinaryExpression, scope: object }): any {
    const left = () => visitNode({ node: expression.left, scope });
    const right = () => visitNode({ node: expression.right, scope });

    switch (expression.operator) {
      case '*':
        return left() * right();
      case '/':
        return left() / right();
      case '-':
        return left() - right();
      case '+':
        return left() + right();
      case '%':
        return left() % right();
      case '**':
        return left() ** right();
      case '^':
        return left() ^ right();
      case '&':
        return left() & right();
      case '|':
        return left() | right();
      case '<':
        return left() < right();
      case '<=':
        return left() <= right();
      case '>':
        return left() > right();
      case '>=':
        return left() >= right();
      case '<<':
        return left() << right();
      case '>>':
        return left() >> right();
      case '==':
        return left() == right();
      case '===':
        return left() === right();
      case '!=':
        return left() != right();
      case '!==':
        return left() !== right();
      default:
        throw new Error(`Unknown binary operator ${expression.operator}`);
    }
  }

  function visitLogicalExpression({ expression, scope }: { expression: LogicalExpression, scope: object }): any {
    const left = () => visitNode({ node: expression.left, scope });
    const right = () => visitNode({ node: expression.right, scope });

    switch (expression.operator) {
      case '&&':
        return left() && right();
      case '||':
        return left() || right();
      default:
        throw new Error(`Unknown logical operator ${expression.operator}`);
    }
  }

  function visitUnaryExpression({ expression, scope }: { expression: UnaryExpression, scope: object }): any {
    switch (expression.operator) {
      case '-':
        return -visitNode({ node: expression.argument, scope });
      case '+':
        return +visitNode({ node: expression.argument, scope });
      case '!':
        return !visitNode({ node: expression.argument, scope });
      default:
        throw new Error(`Unknown unary operator ${expression.operator}`);
    }
  }

  function visitAssignmentExpression({ expression, scope }: { expression: AssignmentExpression, scope: object }): any {
    if (expression.left.type !== 'Identifier') throw new Error(`Unknown left side of assignment ${expression.left.type}`);

    switch (expression.operator) {
      case '=':
        if (!(expression.left.name in scope)) throw new Error(`${expression.left.name} is unknown`);
        redefineProperty(scope, expression.left.name, { value: visitNode({ node: expression.right, scope }) });
        return;
      default:
        throw new Error(`Unknown assignment operator ${expression.operator}`);
    }
  }

  function visitCallExpression({ expression, scope }: { expression: CallExpression, scope: object }): any {
    const args = expression.arguments.map((argument) => visitNode({ node: argument, scope }));

    switch (expression.callee.type) {
      case 'MemberExpression': {
        const object = visitNode({ node: expression.callee.object, scope });
        const fn = visitNode({ node: expression.callee.property, scope: object });

        if (typeof fn !== 'function') throw new Error(`${fn} is not a function`);

        return fn.apply(object, args);
      };
      case 'Identifier': {
        const fn = (scope as ObjectLiteral)[expression.callee.name];

        if (typeof fn !== 'function') throw new Error(`${expression.callee.name} is not a function`);

        return fn(...args);
      };
      default:
        throw new Error(`Unknown callee type ${expression.callee.type}`);
    }
  }

  function visitVariableDeclaration({ node, scope }: { node: VariableDeclaration, scope: object }) {
    for (const declaration of node.declarations) {
      switch (declaration.id.type) {
        case 'Identifier':
          if (scope.hasOwnProperty(declaration.id.name)) throw new Error(`${declaration.id.name} is already declared`);

          if (declaration.init === null || declaration.init === undefined) {
            Object.defineProperty(scope, declaration.id.name, { value: declaration.init });
            return;
          }

          Object.defineProperty(scope, declaration.id.name, { value: visitNode({ node: declaration.init, scope }), writable: node.kind !== 'const' });
          return;
        default:
          throw new Error(`Unknown variable declaration ${declaration.id.type}`);
      }
    }
  }

  function visitLiteral({ node }: { node: Literal }) {
    return node.value
  }

  function visitBlockStatement({ node, scope, params }: { node: BlockStatement, scope: object, params?: any[] }) {
    return (...runtimeParams: any[]) => {
      const newScope = createScope(scope);
      newScope['arguments'] = runtimeParams;

      if (params) {
        params.forEach((param, index) => {
          visitParamNode({ node: param, scope: newScope, values: runtimeParams, index });
        });
      }

      try {
        const res = node.body.map((item) => visitNode({ node: item, scope: newScope }));

        return res[res.length - 1];
      } catch (error) {
        if (error instanceof ReturnException) return error.value;

        throw (error);
      }
    }
  }

  function visitArrowFunctionBody({ node, scope, params }: { node: AnyNode, scope: object, params: any[] }) {
    return (...runtimeParams: any[]): any => {
      const newScope = createScope(scope);

      params.forEach((param, index) => {
        visitParamNode({ node: param, scope: newScope, values: runtimeParams, index });
      });

      return visitNode({ node, scope: newScope });
    }
  }

  function visitFunctionBody({ node, scope, params }: { node: AnyNode, scope: object, params: any[] }) {
    switch (node.type) {
      case 'BlockStatement':
        return visitBlockStatement({ node: node as BlockStatement, scope, params });
      default:
        return visitArrowFunctionBody({ node, scope, params });
    }
  }

  function visitFunctionDeclaration({ node, scope }: { node: FunctionDeclaration | AnonymousFunctionDeclaration, scope: object }) {
    const fn = visitFunctionBody({ node: node.body, scope, params: node.params });

    if (!node.id) return fn;
    if (node.async) throw new Error('Async functions are not supported');

    Object.defineProperty(scope, node.id.name, { value: fn, writable: false });
  }

  function visitFunctionExpression({ node, scope }: { node: FunctionExpression, scope: object }) {
    return visitFunctionBody({ node: node.body, scope, params: node.params });
  }

  function visitArrowFunctionExpression({ node, scope }: { node: ArrowFunctionExpression, scope: object }) {
    if (node.async) throw new Error('Async functions are not supported');

    return visitFunctionBody({ node: node.body, scope, params: node.params });
  }

  function visitReturnStatement({ node, scope }: { node: ReturnStatement, scope: object }) {
    if (node.argument === undefined || node.argument === null) return node.argument;

    return visitNode({ node: node.argument, scope });
  }

  function visitMemberExpression({ node, scope }: { node: MemberExpression, scope: object }): any {
    const object = visitNode({ node: node.object, scope });

    if (object === null || object === undefined) {
      throw new Error('Cannot read properties of ' + object);
    }

    if (node.computed) {
      const property = visitNode({ node: node.property, scope });
      return object[property];
    }

    if (node.property.type !== 'Identifier') {
      throw new Error(`Unexpected property type: ${node.property.type}`);
    }

    return object[node.property.name];
  }

  function visitParamNode({ node, scope, values, index }: { node: Pattern, scope: object, values: any[], index: number }) {
    switch (node.type) {
      case 'Identifier':
        Object.defineProperty(scope, node.name, { value: values[index] });
        return;
      case 'RestElement':
        if (node.argument.type !== 'Identifier') throw new Error(`Unknown argument type ${node.argument.type}`);

        Object.defineProperty(scope, node.argument.name, { value: values.slice(index) });
        return;
      default:
        throw new Error(`Unknown param type ${node.type}`);
    }
  }

  function visitNode({ node, scope }: { node: AnyNode, scope: object }): any {
    switch (node.type) {
      case 'ExpressionStatement':
        return visitExpressionStatement({ node, scope });
      case 'BinaryExpression':
        return visitBinaryExpression({ expression: node, scope });
      case 'UnaryExpression':
        return visitUnaryExpression({ expression: node, scope });
      case 'LogicalExpression':
        return visitLogicalExpression({ expression: node, scope });
      case 'Literal':
        return visitLiteral({ node });
      case 'Identifier':
        if (!hasProperty(scope, node.name)) throw new Error(`Unknown variable ${node.name}`);

        return (scope as ObjectLiteral)[node.name];
      case 'VariableDeclaration':
        return visitVariableDeclaration({ node, scope });
      case 'FunctionExpression':
        return visitFunctionExpression({ node, scope });
      case 'FunctionDeclaration':
        return visitFunctionDeclaration({ node, scope });
      case 'ArrowFunctionExpression':
        return visitArrowFunctionExpression({ node, scope });
      case 'EmptyStatement':
        return;
      case 'ReturnStatement':
        throw new ReturnException(visitReturnStatement({ node, scope }));
      case 'CallExpression':
        return visitCallExpression({ expression: node, scope });
      case 'AssignmentExpression':
        return visitAssignmentExpression({ expression: node, scope });
      case 'ArrayExpression':
        return visitArrayExpression({ expression: node, scope });
      case 'ObjectExpression':
        return visitObjectExpression({ expression: node, scope });
      case 'IfStatement':
        return visitIfStatement({ node, scope });
      case 'BlockStatement':
        return visitBlockStatement({ node: node, scope })();
      case 'MemberExpression':
        return visitMemberExpression({ node, scope });
      default:
        throw new Error(`Unknown node type ${node.type}`);
    };
  }

  const tree = parse(script, { ecmaVersion: 2022 }).body;
  const scope = createScope(context);
  const res = tree.map((node: AnyNode) => visitNode({ node, scope }));

  return res[res.length - 1];
}