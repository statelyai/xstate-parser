import {
  createParser,
  isFunctionOrArrowFunctionExpression,
  unionType,
} from "./utils";
import * as t from "@babel/types";

const getPermittedIdentifiers = (allowedNames: string[], node: t.Node) => {
  let allowedIdentifiers: t.Identifier[] = [];
  let disallowedIdentifiers: t.Identifier[] = [];
  t.traverse(node as any, {
    enter: (childNode) => {
      if (t.isIdentifier(childNode)) {
        if (allowedNames.includes(childNode.name)) {
          allowedIdentifiers.push(childNode as t.Identifier);
        } else {
          disallowedIdentifiers.push(childNode as t.Identifier);
        }
      }
    },
  });

  return {
    node,
    allowedIdentifiers,
    disallowedIdentifiers,
    isPure: disallowedIdentifiers.length === 0,
  };
};

const pureFunctionBlockStatement = (allowedNames: string[]) =>
  createParser({
    babelMatcher: t.isBlockStatement,
    parseNode: (node) => {
      return getPermittedIdentifiers(allowedNames, node);
    },
  });

const pureFunctionExpression = (allowedNames: string[]) =>
  createParser({
    babelMatcher: t.isExpression,
    parseNode: (node) => {
      return getPermittedIdentifiers(allowedNames, node);
    },
  });

const pureFunctionExpressionOrBlockStatement = (allowedNames: string[]) =>
  unionType([
    pureFunctionBlockStatement(allowedNames),
    pureFunctionExpression(allowedNames),
  ]);

export const pureFunction = createParser({
  babelMatcher: isFunctionOrArrowFunctionExpression,
  parseNode: (node, context) => {
    const paramNames: string[] = [];

    node.params.forEach((param) => {
      if (t.isIdentifier(param)) {
        paramNames.push(param.name);
      }
    });

    const body = node.body;

    const result = pureFunctionExpressionOrBlockStatement(paramNames).parse(
      body,
      context,
    );

    return {
      functionNode: node,
      paramNames,
      bodyParseResult: result,
    };
  },
});
