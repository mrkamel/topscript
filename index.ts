import {
  parse, AnyNode, ArrayExpression, ObjectExpression, ExpressionStatement, IfStatement,
  BinaryExpression, LogicalExpression, UnaryExpression, AssignmentExpression, CallExpression,
  VariableDeclaration, Literal, BlockStatement, ArrowFunctionExpression, FunctionDeclaration,
  FunctionExpression, ReturnStatement, Pattern, AnonymousFunctionDeclaration, MemberExpression,
  Expression,
  Statement,
  TemplateLiteral,
  WhileStatement,
} from 'acorn';

const ECMA_VERSION = 2019;

type ObjectLiteral = { [key: string]: any };

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

async function immediate(): Promise<void> {
  // This function allows us to run the code in the next tick of the event loop.
  // This is important to make sure that the code is not blocking the event loop.

  return new Promise((resolve) => {
    if (typeof window !== 'undefined') {
      setTimeout(() => resolve(), 0);
      return;
    }
    
    setImmediate(() => resolve());
  });
}

export async function topscript(script: string, context: ObjectLiteral = {}, { signal }: { signal?: AbortSignal } = {}): Promise<any> {
  function checkSignal() {
    if (signal && signal.aborted) throw new Error('Execution aborted');
  }

  async function visitExpressionStatement({ node, scope }: { node: ExpressionStatement, scope: object }): Promise<object> {
    return await visitNode({ node: node.expression, scope });
  }

  async function visitArrayExpression({ expression, scope }: { expression: ArrayExpression, scope: object }): Promise<any[]> {
    let res: any[] = [];

    for (const element of expression.elements) {
      if (element === null) {
        res.push(null);
        continue;
      }

      switch (element.type) {
        case 'SpreadElement':
          res = [...res, ...(await visitNode({ node: element.argument, scope }))];
          break;
        default:
          res.push(await visitNode({ node: element, scope }));
          break;
      }
    }

    return res;
  }

  async function mapAsync<T, U>(array: T[], fn: (item: T) => Promise<U>): Promise<U[]> {
    const res: U[] = [];

    for (const item of array) {
      res.push(await fn(item));
    }
    
    return res;
  }

  async function visitObjectExpression({ expression, scope }: { expression: ObjectExpression, scope: object }): Promise<object> {
    let res: ObjectLiteral = {};

    for (const property of expression.properties) {
      const type = property.type;

      switch (type) {
        case 'Property': {
          const value = await visitNode({ node: property.value, scope });

          if (property.computed) {
            res[await visitNode({ node: property.key, scope })] = value;
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
          res = { ...res, ...(await visitNode({ node: property.argument, scope })) };
          break;
        default:
          throw new Error(`Unknown property type ${type}`);
      }
    }

    return res;
  }

  async function visitIfStatement({ node, scope }: { node: IfStatement, scope: object }) {
    async function visitConditionNode(conditionNode: Expression | Statement) {
      switch (conditionNode.type) {
        case 'BlockStatement': {
          const fn = visitBlockStatement({ node: conditionNode, scope });
          await fn();
          return;
        };
        default:
          await visitNode({ node: conditionNode, scope });
          return;
      }
    }

    if (await visitNode({ node: node.test, scope })) {
      await visitConditionNode(node.consequent);
      return;
    }

    if (node.alternate) {
      await visitConditionNode(node.alternate);
      return;
    }
  }

  async function visitBinaryExpression({ expression, scope }: { expression: BinaryExpression, scope: object }): Promise<any> {
    const left = async () => await visitNode({ node: expression.left, scope });
    const right = async () => await visitNode({ node: expression.right, scope });

    switch (expression.operator) {
      case '*': return (await left()) * (await right());
      case '/': return (await left()) / (await right());
      case '-': return (await left()) - (await right());
      case '+': return (await left()) + (await right());
      case '%': return (await left()) % (await right());
      case '**': return (await left()) ** (await right());
      case '^': return (await left()) ^ (await right());
      case '&': return (await left()) & (await right());
      case '|': return (await left()) | (await right());
      case '<': return (await left()) < (await right());
      case '<=': return (await left()) <= (await right());
      case '>': return (await left()) > (await right());
      case '>=': return (await left()) >= (await right());
      case '<<': return (await left()) << (await right());
      case '>>': return (await left()) >> (await right());
      case '==': return (await left()) == (await right());
      case '===': return (await left()) === await right();
      case '!=': return (await left()) != await right();
      case '!==': return (await left()) !== (await right());
      default: throw new Error(`Unknown binary operator ${expression.operator}`);
    }
  }

  async function visitLogicalExpression({ expression, scope }: { expression: LogicalExpression, scope: object }): Promise<any> {
    const left = async () => await visitNode({ node: expression.left, scope });
    const right = async () => await visitNode({ node: expression.right, scope });

    switch (expression.operator) {
      case '&&': return (await left()) && (await right());
      case '||': return (await left()) || (await right());
      default: throw new Error(`Unknown logical operator ${expression.operator}`);
    }
  }

  async function visitDelete({ node, scope }: { node: Expression, scope: object }) {
    switch (node.type) {
      case 'MemberExpression': {
        const object = await visitNode({ node: node.object, scope });

        if (node.property.type === 'Identifier') {
          delete object[node.property.name];
          return;
        } else {
          delete object[await visitNode({ node: node.property, scope })];
          return;
        }
      };
      default: throw new Error(`Unknown delete type ${node.type}`);
    }
  }

  async function visitUnaryExpression({ expression, scope }: { expression: UnaryExpression, scope: object }): Promise<any> {
    switch (expression.operator) {
      case '-': return -(await visitNode({ node: expression.argument, scope }));
      case '+': return +(await visitNode({ node: expression.argument, scope }));
      case '!': return !(await visitNode({ node: expression.argument, scope }));
      case 'delete': return await visitDelete({ node: expression.argument, scope });
      default:
        throw new Error(`Unknown unary operator ${expression.operator}`);
    }
  }

  async function visitAssignmentExpression({ expression, scope }: { expression: AssignmentExpression, scope: object }): Promise<any> {
    async function assignWithOperator(fn: (a: any, b: any) => any) {
      if (expression.left.type === 'Identifier') {
        if (!(expression.left.name in scope)) throw new Error(`${expression.left.name} is unknown`);
        redefineProperty(scope, expression.left.name, { value: fn((scope as ObjectLiteral)[expression.left.name], await visitNode({ node: expression.right, scope })) });
        return;
      } else if (expression.left.type === 'MemberExpression') {
        const object = await visitNode({ node: expression.left.object, scope });

        if (expression.left.property.type === 'Identifier') {
          object[expression.left.property.name] = fn(object[expression.left.property.name], await visitNode({ node: expression.right, scope }));
          return;
        } else {
          object[await visitNode({ node: expression.left.property, scope })] = fn(
            object[await visitNode({ node: expression.left.property, scope })],
            await visitNode({ node: expression.right, scope })
          );

          return;
        }
      } else {
        throw new Error(`Unknown left side of assignment ${expression.left.type}`);
      }
    }

    switch (expression.operator) {
      case '=':
        await assignWithOperator((_a, b) => b);
        return;
      case '+=':
        await assignWithOperator((a, b) => a + b);
        return;
      case '-=':
        await assignWithOperator((a, b) => a - b);
        return;
      case '*=':
        await assignWithOperator((a, b) => a * b);
        return;
      case '/=':
        await assignWithOperator((a, b) => a / b);
        return;
      case '%=':
        await assignWithOperator((a, b) => a % b);
        return;
      case '**=':
        await assignWithOperator((a, b) => a ** b);
        return;
      case '^=':
        await assignWithOperator((a, b) => a ^ b);
        return;
      case '&=':
        await assignWithOperator((a, b) => a & b);
        return;
      case '|=':
        await assignWithOperator((a, b) => a | b);
        return;
      case '<<=':
        await assignWithOperator((a, b) => a << b);
        return;
      case '>>=':
        await assignWithOperator((a, b) => a >> b);
        return;
      default:
        throw new Error(`Unknown assignment operator ${expression.operator}`);
    }
  }

  async function visitCallExpression({ expression, scope }: { expression: CallExpression, scope: object }): Promise<any> {
    const args = await mapAsync(expression.arguments, async (argument) => await visitNode({ node: argument, scope }));

    switch (expression.callee.type) {
      case 'MemberExpression': {
        if(expression.callee.optional) throw new Error('Optional chaining is not supported');

        const object = await visitNode({ node: expression.callee.object, scope });
        const fn = await visitNode({ node: expression.callee.property, scope: object });

        if (typeof fn !== 'function') throw new Error(`${fn} is not a function`);

        return fn.apply(object, args);
      };
      case 'Identifier': {
        const fn = (scope as ObjectLiteral)[expression.callee.name];
        if (typeof fn !== 'function') throw new Error(`${expression.callee.name} is not a function`);

        return fn(...args);
      };
      case 'FunctionExpression': {
        const fn = await visitFunctionBody({ node: expression.callee.body, scope, params: expression.callee.params });
        return fn(...args);
      };
      case 'ArrowFunctionExpression': {
        const fn = await visitArrowFunctionBody({ node: expression.callee.body, scope, params: expression.callee.params });
        return fn(...args);
      };
      default:
        throw new Error(`Unknown callee type ${expression.callee.type}`);
    }
  }

  async function visitVariableDeclaration({ node, scope }: { node: VariableDeclaration, scope: object }) {
    for (const declaration of node.declarations) {
      switch (declaration.id.type) {
        case 'Identifier': {
          if (scope.hasOwnProperty(declaration.id.name)) throw new Error(`${declaration.id.name} is already declared`);

          if (declaration.init === null || declaration.init === undefined) {
            Object.defineProperty(scope, declaration.id.name, { value: declaration.init });
            break;
          }

          const value = await visitNode({ node: declaration.init, scope });
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
    return async (...runtimeParams: any[]) => {
      await immediate();
      checkSignal();

      const newScope = createScope(scope);
      newScope['arguments'] = runtimeParams;

      if (params) {
        params.forEach((param, index) => {
          visitParamNode({ node: param, scope: newScope, values: runtimeParams, index });
        });
      }

      try {
        const res = await mapAsync(node.body, async (item) => await visitNode({ node: item, scope: newScope }));

        return res[res.length - 1];
      } catch (error) {
        if (error instanceof ReturnException) return error.value;

        throw (error);
      }
    };
  }

  function visitArrowFunctionBody({ node, scope, params }: { node: AnyNode, scope: object, params: any[] }) {
    return async (...runtimeParams: any[]): Promise<any> => {
      await immediate();
      checkSignal();

      const newScope = createScope(scope);

      params.forEach((param, index) => {
        visitParamNode({ node: param, scope: newScope, values: runtimeParams, index });
      });

      return await visitNode({ node, scope: newScope });
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

  async function visitReturnStatement({ node, scope }: { node: ReturnStatement, scope: object }) {
    if (node.argument === undefined || node.argument === null) return node.argument;

    return await visitNode({ node: node.argument, scope });
  }

  async function visitMemberExpression({ node, scope }: { node: MemberExpression, scope: object }): Promise<any> {
    const object = await visitNode({ node: node.object, scope });

    if (node.computed) {
      const property = await visitNode({ node: node.property, scope });
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

  async function visitTemplateLiteral({ node, scope }: { node: TemplateLiteral, scope: object }) {
    const quasis = node.quasis.map((quasi) => quasi.value.cooked);
    const expressions = await mapAsync(node.expressions, async (expression) => await visitNode({ node: expression, scope }));
    
    const result = quasis[0] || '';

    return expressions.reduce((acc, expr, i) => {
      return acc + expr + (quasis[i + 1] || '');
    }, result);
  }

  async function visitWhileStatement({ node, scope }: { node: WhileStatement, scope: object }) {
    while (await visitNode({ node: node.test, scope })) {
      await immediate();
      checkSignal();

      const fn = visitBlockStatement({ node: node.body as BlockStatement, scope });
      await fn();
    }
  }

  async function visitNode({ node, scope }: { node: AnyNode, scope: object }): Promise<any> {
    switch (node.type) {
      case 'ExpressionStatement': return await visitExpressionStatement({ node, scope });
      case 'BinaryExpression': return await visitBinaryExpression({ expression: node, scope });
      case 'UnaryExpression': return await visitUnaryExpression({ expression: node, scope });
      case 'LogicalExpression': return await visitLogicalExpression({ expression: node, scope });
      case 'Literal': return visitLiteral({ node });
      case 'Identifier':
        if (!hasProperty(scope, node.name)) throw new Error(`Unknown variable ${node.name}`);

        return (scope as ObjectLiteral)[node.name];
      case 'VariableDeclaration': return await visitVariableDeclaration({ node, scope });
      case 'FunctionExpression': return visitFunctionExpression({ node, scope });
      case 'FunctionDeclaration': return visitFunctionDeclaration({ node, scope });
      case 'ArrowFunctionExpression': return visitArrowFunctionExpression({ node, scope });
      case 'EmptyStatement': return;
      case 'ReturnStatement': throw new ReturnException(await visitReturnStatement({ node, scope }));
      case 'CallExpression': return await visitCallExpression({ expression: node, scope });
      case 'AssignmentExpression': return await visitAssignmentExpression({ expression: node, scope });
      case 'ArrayExpression': return await visitArrayExpression({ expression: node, scope });
      case 'ObjectExpression': return await visitObjectExpression({ expression: node, scope });
      case 'IfStatement': return await visitIfStatement({ node, scope });
      case 'BlockStatement': return visitBlockStatement({ node, scope })();
      case 'MemberExpression': return await visitMemberExpression({ node, scope });
      case 'TemplateLiteral': return await visitTemplateLiteral({ node, scope });
      case 'WhileStatement': return await visitWhileStatement({ node, scope });
      default: throw new Error(`Unknown node type ${node.type}`);
    };
  }

  const tree = parse(script, { ecmaVersion: ECMA_VERSION }).body;
  const scope = createScope(context);
  const res = await mapAsync(tree, async (node) => await visitNode({ node, scope }));

  return res[res.length - 1];
}
