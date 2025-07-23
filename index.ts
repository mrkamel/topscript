import {
  parse, AnyNode, ArrayExpression, ObjectExpression, ExpressionStatement, IfStatement,
  BinaryExpression, LogicalExpression, UnaryExpression, AssignmentExpression, CallExpression,
  VariableDeclaration, Literal, BlockStatement, ArrowFunctionExpression, FunctionDeclaration,
  FunctionExpression, ReturnStatement, Pattern, AnonymousFunctionDeclaration, MemberExpression,
  Expression,
  Statement,
  TemplateLiteral,
  WhileStatement,
  ConditionalExpression,
  ChainExpression,
  Identifier,
} from 'acorn';

const ECMA_VERSION = 2020;

type ObjectLiteral = { [key: string]: any };
class SafeNavigationError extends Error {};

function createScope(parent?: object) {
  const res: ObjectLiteral = {};

  if (parent) Object.setPrototypeOf(res, parent);

  return res;
}

// Redefines a property on an object, even if it doesn't exist on the
// object itself, but on a parent, i.e. a prototype.

function redefineProperty(obj: object, key: PropertyKey, properties: Parameters<typeof Object.defineProperty>[2]) {
  if (obj.hasOwnProperty(key) || Object.getPrototypeOf(obj) === null) {
    Object.defineProperty(obj, key, properties);
    return;
  }

  redefineProperty(Object.getPrototypeOf(obj), key, properties);
}

// Checks if an object has a property, even if it doesn't exist on the
// object itself, but on a parent, i.e. a prototype.

function hasProperty(obj: object, key: PropertyKey): boolean {
  if (obj === null || obj === undefined) throw new Error(`Cannot read properties of ${obj} (reading '${String(key)}')`);

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

export function validate(script: string) {
  return parse(script, { ecmaVersion: ECMA_VERSION });
}

export function topscript(
  script: string,
  context: ObjectLiteral = {},
  { timeout, disableWhileStatements, maxStackSize, allowReturnOutsideFunction }: { timeout?: number, disableWhileStatements?: boolean, maxStackSize?: number, allowReturnOutsideFunction?: boolean } = {},
): any {
  const startTime = Date.now();
  let stackSize = 0;

  function withStackCheck<T>(fn: () => T): T {
    stackSize += 1;

    if (maxStackSize !== undefined && stackSize > maxStackSize) {
      throw new Error(`Maximum stack size exceeded: ${maxStackSize}`);
    }

    try {
      return fn();
    } finally {
      stackSize -= 1;
    }
  }

  function checkTimeout() {
    if (timeout && Date.now() - startTime > timeout) {
      throw new Error('Execution timed out');
    }
  }

  function visitExpressionStatement({ node, scope }: { node: ExpressionStatement, scope: object }): object {
    return visitNode({ node: node.expression, scope });
  }

  function visitArrayExpression({ expression, scope }: { expression: ArrayExpression, scope: object }): any[] {
    let res: any[] = [];

    for (const element of expression.elements) {
      if (element === null) {
        res.push(null);
        continue;
      }

      switch (element.type) {
        case 'SpreadElement':
          res = [...res, ...visitNode({ node: element.argument, scope })];
          break;
        default:
          res.push(visitNode({ node: element, scope }));
          break;
      }
    }

    return res;
  }

  function visitObjectExpression({ expression, scope }: { expression: ObjectExpression, scope: object }): object {
    let res: ObjectLiteral = {};

    for (const property of expression.properties) {
      const type = property.type;

      switch (type) {
        case 'Property': {
          const value = visitNode({ node: property.value, scope });

          if (property.computed) {
            res[visitNode({ node: property.key, scope })] = value;
            break;
          }

          if (property.key.type === 'Identifier') {
            res[property.key.name] = value;
            break;
          } else if (property.key.type === 'Literal') {
            if (typeof property.key.value !== 'string') throw new Error(`Unknown key type ${property.key.type}`);
            res[property.key.value] = value;
            break;
          } else {
            throw new Error(`Unknown key type ${property.key.type}`);
          }
        };
        case 'SpreadElement':
          res = { ...res, ...visitNode({ node: property.argument, scope }) };
          break;
        default:
          throw new Error(`Unknown property type ${type}`);
      }
    }

    return res;
  }

  function visitIfStatement({ node, scope }: { node: IfStatement, scope: object }) {
    function visitConditionNode(conditionNode: Expression | Statement) {
      switch (conditionNode.type) {
        case 'BlockStatement': {
          const fn = visitBlockStatement({ node: conditionNode, scope });
          fn();
          return;
        };
        default:
          visitNode({ node: conditionNode, scope });
          return;
      }
    }

    if (visitNode({ node: node.test, scope })) {
      visitConditionNode(node.consequent);
      return;
    }

    if (node.alternate) {
      visitConditionNode(node.alternate);
      return;
    }
  }

  function visitBinaryExpression({ expression, scope }: { expression: BinaryExpression, scope: object }): any {
    const left = () => visitNode({ node: expression.left, scope });
    const right = () => visitNode({ node: expression.right, scope });

    switch (expression.operator) {
      case '*': return left() * right();
      case '/': return left() / right();
      case '-': return left() - right();
      case '+': return left() + right();
      case '%': return left() % right();
      case '**': return left() ** right();
      case '^': return left() ^ right();
      case '&': return left() & right();
      case '|': return left() | right();
      case '<': return left() < right();
      case '<=': return left() <= right();
      case '>': return left() > right();
      case '>=': return left() >= right();
      case '<<': return left() << right();
      case '>>': return left() >> right();
      case '==': return left() == right();
      case '===': return left() === right();
      case '!=': return left() != right();
      case '!==': return left() !== right();
      default: throw new Error(`Unknown binary operator ${expression.operator}`);
    }
  }

  function visitLogicalExpression({ expression, scope }: { expression: LogicalExpression, scope: object }): any {
    const left = () => visitNode({ node: expression.left, scope });
    const right = () => visitNode({ node: expression.right, scope });

    switch (expression.operator) {
      case '&&': return left() && right();
      case '||': return left() || right();
      default: throw new Error(`Unknown logical operator ${expression.operator}`);
    }
  }

  function visitDelete({ node, scope }: { node: Expression, scope: object }) {
    switch (node.type) {
      case 'ChainExpression': {
        try {
          return visitDelete({ node: node.expression, scope });
        } catch (error) {
          if (error instanceof SafeNavigationError) return true;

          throw error;
        }
      };
      case 'MemberExpression': {
        const object = visitNode({ node: node.object, scope });

        if (node.optional && (object === undefined || object === null)) throw new SafeNavigationError();

        if (node.property.type === 'Identifier') {
          delete object[node.property.name];
          return;
        } else {
          delete object[visitNode({ node: node.property, scope })];
          return;
        }
      };
      default: throw new Error(`Unknown delete type ${node.type}`);
    }
  }

  function visitUnaryExpression({ expression, scope }: { expression: UnaryExpression, scope: object }): any {
    switch (expression.operator) {
      case '-': return -(visitNode({ node: expression.argument, scope }));
      case '+': return +(visitNode({ node: expression.argument, scope }));
      case '!': return !(visitNode({ node: expression.argument, scope }));
      case 'delete': return visitDelete({ node: expression.argument, scope });
      default:
        throw new Error(`Unknown unary operator ${expression.operator}`);
    }
  }

  function visitAssignmentExpression({ expression, scope }: { expression: AssignmentExpression, scope: object }): any {
    function assignWithOperator(fn: (a: any, b: any) => any) {
      if (expression.left.type === 'Identifier') {
        if (!(expression.left.name in scope)) throw new Error(`${expression.left.name} is unknown`);
        redefineProperty(scope, expression.left.name, { value: fn((scope as ObjectLiteral)[expression.left.name], visitNode({ node: expression.right, scope })) });
        return;
      } else if (expression.left.type === 'MemberExpression') {
        const object = visitNode({ node: expression.left.object, scope });

        if (expression.left.property.type === 'Identifier') {
          object[expression.left.property.name] = fn(object[expression.left.property.name], visitNode({ node: expression.right, scope }));
          return;
        } else {
          object[visitNode({ node: expression.left.property, scope })] = fn(
            object[visitNode({ node: expression.left.property, scope })],
            visitNode({ node: expression.right, scope })
          );

          return;
        }
      } else {
        throw new Error(`Unknown left side of assignment ${expression.left.type}`);
      }
    }

    switch (expression.operator) {
      case '=':
        assignWithOperator((_a, b) => b);
        return;
      case '+=':
        assignWithOperator((a, b) => a + b);
        return;
      case '-=':
        assignWithOperator((a, b) => a - b);
        return;
      case '*=':
        assignWithOperator((a, b) => a * b);
        return;
      case '/=':
        assignWithOperator((a, b) => a / b);
        return;
      case '%=':
        assignWithOperator((a, b) => a % b);
        return;
      case '**=':
        assignWithOperator((a, b) => a ** b);
        return;
      case '^=':
        assignWithOperator((a, b) => a ^ b);
        return;
      case '&=':
        assignWithOperator((a, b) => a & b);
        return;
      case '|=':
        assignWithOperator((a, b) => a | b);
        return;
      case '<<=':
        assignWithOperator((a, b) => a << b);
        return;
      case '>>=':
        assignWithOperator((a, b) => a >> b);
        return;
      default:
        throw new Error(`Unknown assignment operator ${expression.operator}`);
    }
  }

  function visitCallExpression({ expression, scope }: { expression: CallExpression, scope: object }) {
    const args = expression.arguments.map((argument) => visitNode({ node: argument, scope }));

    switch (expression.callee.type) {
      case 'MemberExpression': {
        const object = visitNode({ node: expression.callee.object, scope });
        
        const fn = expression.callee.property.type === 'Identifier'
          ? visitIdentifier({ node: expression.callee.property, scope: object, optional: expression.callee.optional, memberAccess: true })
          : visitNode({ node: expression.callee.property, scope: object });

        if (typeof fn !== 'function') {
          if (expression.callee.optional && (fn === undefined || fn === null)) throw new SafeNavigationError();

          if (expression.callee.property.type === 'Identifier') {
            throw new Error(`${expression.callee.property.name} is not a function`);
          }

          throw new Error(`${fn} is not a function`);
        }

        return fn.apply(object, args);
      };
      case 'Identifier': {
        const fn = (scope as ObjectLiteral)[expression.callee.name];
        if (typeof fn !== 'function') throw new Error(`${expression.callee.name} is not a function`);

        return fn(...args);
      };
      case 'FunctionExpression': {
        const fn = visitFunctionBody({ node: expression.callee.body, scope, params: expression.callee.params });
        return fn(...args);
      };
      case 'ArrowFunctionExpression': {
        const fn = visitArrowFunctionBody({ node: expression.callee.body, scope, params: expression.callee.params });
        return fn(...args);
      };
      default:
        throw new Error(`Unknown callee type ${expression.callee.type}`);
    }
  }

  function visitVariableDeclaration({ node, scope }: { node: VariableDeclaration, scope: object }) {
    for (const declaration of node.declarations) {
      switch (declaration.id.type) {
        case 'Identifier': {
          if (scope.hasOwnProperty(declaration.id.name)) throw new Error(`${declaration.id.name} is already declared`);

          if (declaration.init === null || declaration.init === undefined) {
            Object.defineProperty(scope, declaration.id.name, { value: declaration.init, writable: node.kind !== 'const' });
            break;
          }

          const value = visitNode({ node: declaration.init, scope });
          Object.defineProperty(scope, declaration.id.name, { value, writable: node.kind !== 'const' });
          break;
        };
        default:
          throw new Error(`Unknown variable declaration ${declaration.id.type}`);
      }
    }
  }

  function visitLiteral({ node }: { node: Literal }) {
    return node.value;
  }

  function visitBlockStatement({ node, scope, params }: { node: BlockStatement, scope: object, params?: any[] }) {
    return (...runtimeParams: any[]) => {
      return withStackCheck(() => {
        checkTimeout();

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
      });
    };
  }

  function visitArrowFunctionBody({ node, scope, params }: { node: AnyNode, scope: object, params: any[] }) {
    return (...runtimeParams: any[]): any => {
      return withStackCheck(() => {
        checkTimeout();

        const newScope = createScope(scope);

        params.forEach((param, index) => {
          visitParamNode({ node: param, scope: newScope, values: runtimeParams, index });
        });

        return visitNode({ node, scope: newScope });
      });
    };
  }

  function visitFunctionBody({ node, scope, params }: { node: AnyNode, scope: object, params: any[] }) {
    switch (node.type) {
      case 'BlockStatement': return visitBlockStatement({ node: node as BlockStatement, scope, params });
      default: return visitArrowFunctionBody({ node, scope, params });
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

    if (node.optional && (object === undefined || object === null)) throw new SafeNavigationError();

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

  function visitTemplateLiteral({ node, scope }: { node: TemplateLiteral, scope: object }) {
    const quasis = node.quasis.map((quasi) => quasi.value.cooked);
    const expressions = node.expressions.map((expression) => visitNode({ node: expression, scope }));
    
    const result = quasis[0] || '';

    return expressions.reduce((acc, expr, i) => {
      return acc + expr + (quasis[i + 1] || '');
    }, result);
  }

  function visitWhileStatement({ node, scope }: { node: WhileStatement, scope: object }) {
    if (disableWhileStatements) throw new Error('While statements are not available');

    while (visitNode({ node: node.test, scope })) {
      checkTimeout();
      const fn = visitBlockStatement({ node: node.body as BlockStatement, scope });
      fn();
    }
  }

  function visitConditionalExpression({ node, scope }: { node: ConditionalExpression, scope: object }) {
    const test = visitNode({ node: node.test, scope });

    if (test) return visitNode({ node: node.consequent, scope });

    return visitNode({ node: node.alternate, scope });
  }

  function visitChainExpression({ node, scope }: { node: ChainExpression, scope: object }) {
    try {
      return visitNode({ node: node.expression, scope });
    } catch (error) {
      if (error instanceof SafeNavigationError) return undefined;
      throw error;
    }
  }

  function visitIdentifier({ node, scope, optional, memberAccess }: { node: Identifier, scope: object, optional?: boolean, memberAccess?: boolean }): any {
    if (node.name === 'undefined') return undefined;
  
    if (optional && (scope === undefined || scope === null)) throw new SafeNavigationError();
    if (!hasProperty(scope, node.name) && !memberAccess) throw new Error(`Unknown variable ${node.name}`);

    return (scope as ObjectLiteral)[node.name];
  }

  function visitNode({ node, scope }: { node: AnyNode, scope: object }): any {
    switch (node.type) {
      case 'ExpressionStatement': return visitExpressionStatement({ node, scope });
      case 'BinaryExpression': return visitBinaryExpression({ expression: node, scope });
      case 'UnaryExpression': return visitUnaryExpression({ expression: node, scope });
      case 'LogicalExpression': return visitLogicalExpression({ expression: node, scope });
      case 'Literal': return visitLiteral({ node });
      case 'Identifier': return visitIdentifier({ node, scope });
      case 'VariableDeclaration': return visitVariableDeclaration({ node, scope });
      case 'FunctionExpression': return visitFunctionExpression({ node, scope });
      case 'FunctionDeclaration': return visitFunctionDeclaration({ node, scope });
      case 'ArrowFunctionExpression': return visitArrowFunctionExpression({ node, scope });
      case 'EmptyStatement': return;
      case 'ReturnStatement': throw new ReturnException(visitReturnStatement({ node, scope }));
      case 'CallExpression': return visitCallExpression({ expression: node, scope });
      case 'AssignmentExpression': return visitAssignmentExpression({ expression: node, scope });
      case 'ArrayExpression': return visitArrayExpression({ expression: node, scope });
      case 'ObjectExpression': return visitObjectExpression({ expression: node, scope });
      case 'IfStatement': return visitIfStatement({ node, scope });
      case 'BlockStatement': return visitBlockStatement({ node, scope })();
      case 'MemberExpression': return visitMemberExpression({ node, scope });
      case 'TemplateLiteral': return visitTemplateLiteral({ node, scope });
      case 'WhileStatement': return visitWhileStatement({ node, scope });
      case 'ConditionalExpression': return visitConditionalExpression({ node, scope });
      case 'ChainExpression': return visitChainExpression({ node, scope });
      default: throw new Error(`Unknown node type ${node.type}`);
    };
  }

  const tree = parse(script, { ecmaVersion: ECMA_VERSION, allowReturnOutsideFunction }).body;
  const scope = createScope(context);

  const res = (() => {
    try {
      return tree.map((node) => visitNode({ node, scope }));
    } catch (error) {
      if (error instanceof ReturnException) return [error.value];
      throw error;
    }
  })();

  return res[res.length - 1];
}