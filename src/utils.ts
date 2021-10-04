import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { createParser } from "./createParser";
import {
  identifierReferencingVariableDeclaration,
  maybeIdentifierTo,
} from "./identifiers";
import {
  AnyNode,
  NumericLiteral,
  StringLiteral,
  TemplateLiteral,
} from "./scalars";
import { maybeTsAsExpression } from "./tsAsExpression";
import { AnyParser, ParserContext } from "./types";
import { unionType } from "./unionType";

/**
 * Allows you to wrap a parser and reformulate
 * the result at the end of it
 */
export const wrapParserResult = <T extends t.Node, Result, NewResult>(
  parser: AnyParser<Result>,
  changeResult: (result: Result, node: T) => NewResult,
): AnyParser<NewResult> => {
  return {
    matches: parser.matches,
    parse: (node: any, context) => {
      const result = parser.parse(node, context);
      if (!result) return undefined;
      return changeResult(result, node);
    },
  };
};

/**
 * Useful for when something might, or might not,
 * be declared as an array
 */
export const maybeArrayOf = <Result>(
  parser: AnyParser<Result> | AnyParser<Result[]>,
): AnyParser<Result[]> => {
  const arrayParser = createParser({
    babelMatcher: t.isArrayExpression,
    parseNode: (node, context) => {
      const toReturn: Result[] = [];

      node.elements.map((elem) => {
        const result = parser.parse(elem, context);
        if (result && Array.isArray(result)) {
          toReturn.push(...result);
        } else if (result) {
          toReturn.push(result);
        }
      });

      return toReturn;
    },
  });

  const otherParser = wrapParserResult<t.Node, Result | Result[], Result[]>(
    parser,
    (res) => {
      if (Array.isArray(res)) {
        return res;
      }
      return [res];
    },
  );

  return unionType([arrayParser, otherParser]);
};

/**
 * Used to declare that this node is declared
 * an array of something
 */
export const arrayOf = <Result>(
  parser: AnyParser<Result>,
): AnyParser<Result[]> => {
  return createParser({
    babelMatcher: t.isArrayExpression,
    parseNode: (node, context) => {
      const toReturn: Result[] = [];

      node.elements.map((elem) => {
        const result = parser.parse(elem, context);
        if (result) {
          toReturn.push(result);
        }
      });

      return toReturn;
    },
  });
};

export const staticObjectProperty = <KeyResult>(
  keyParser: AnyParser<KeyResult>,
) =>
  createParser<
    t.ObjectProperty,
    {
      node: t.ObjectProperty;
      key?: KeyResult;
    }
  >({
    babelMatcher: (node): node is t.ObjectProperty => {
      return t.isObjectProperty(node) && !node.computed;
    },
    parseNode: (node, context) => {
      return {
        node,
        key: keyParser.parse(node.key, context),
      };
    },
  });

export const spreadElement = <Result>(parser: AnyParser<Result>) => {
  return createParser({
    babelMatcher: t.isSpreadElement,
    parseNode: (node, context) => {
      const result = {
        node,
        argumentResult: parser.parse(node.argument, context),
      };

      return result;
    },
  });
};

export const spreadElementReferencingIdentifier = <Result>(
  parser: AnyParser<Result>,
) => {
  return spreadElement(identifierReferencingVariableDeclaration(parser));
};

export const dynamicObjectProperty = <KeyResult>(
  keyParser: AnyParser<KeyResult>,
) =>
  createParser<
    t.ObjectProperty,
    {
      node: t.ObjectProperty;
      key?: KeyResult;
    }
  >({
    babelMatcher: (node): node is t.ObjectProperty => {
      return t.isObjectProperty(node) && node.computed;
    },
    parseNode: (node, context) => {
      return {
        node,
        key: keyParser.parse(node.key, context),
      };
    },
  });

const staticPropertyWithKey = staticObjectProperty(
  unionType<{ node: t.Node; value: string | number }>([
    createParser({
      babelMatcher: t.isIdentifier,
      parseNode: (node) => {
        return {
          node,
          value: node.name,
        };
      },
    }),
    StringLiteral,
    NumericLiteral,
  ]),
);

const dynamicPropertyWithKey = dynamicObjectProperty(
  maybeIdentifierTo(unionType([StringLiteral, TemplateLiteral])),
);

const propertyKey = unionType([staticPropertyWithKey, dynamicPropertyWithKey]);

/**
 * Utility function for grabbing the properties of
 * an object expression
 */
export const getPropertiesOfObjectExpression = (
  node: t.ObjectExpression,
  context: ParserContext,
) => {
  const propertiesToReturn: {
    node: t.ObjectProperty;
    key: string;
    keyNode: t.Node;
  }[] = [];

  node.properties.forEach((property) => {
    const propertiesToParse: t.Node[] = [property];

    const spreadElementResult = spreadElementReferencingIdentifier(
      createParser({
        babelMatcher: t.isObjectExpression,
        parseNode: (node) => node,
      }),
    ).parse(property, context);

    propertiesToParse.push(
      ...(spreadElementResult?.argumentResult?.properties || []),
    );

    propertiesToParse.forEach((property) => {
      const result = propertyKey.parse(property, context);
      if (result && result?.key) {
        propertiesToReturn.push({
          key: `${result.key?.value}`,
          node: result.node,
          keyNode: result.key.node,
        });
      }
    });
  });

  return propertiesToReturn;
};

export type GetObjectKeysResult<
  T extends { [index: string]: AnyParser<unknown> },
> = {
  [K in keyof T]?: ReturnType<T[K]["parse"]>;
} & {
  node: t.Node;
};

export type GetParserResult<TParser extends AnyParser<any>> = ReturnType<
  TParser["parse"]
>;

/**
 * Used for declaring an object expression where the known keys
 * can be different things
 */
export const objectTypeWithKnownKeys = <
  T extends { [index: string]: AnyParser<any> },
>(
  parserObject: T | (() => T),
) =>
  maybeTsAsExpression(
    maybeIdentifierTo(
      createParser<t.ObjectExpression, GetObjectKeysResult<T>>({
        babelMatcher: t.isObjectExpression,
        parseNode: (node, context) => {
          const properties = getPropertiesOfObjectExpression(node, context);
          const parseObject =
            typeof parserObject === "function" ? parserObject() : parserObject;

          const toReturn = {
            node,
          };

          properties?.forEach((property) => {
            const key = property.key;
            const parser = parseObject[key];

            if (!parser) return;

            const result = parser.parse(property.node.value, context);

            // @ts-ignore
            toReturn[key] = result;
          });

          return toReturn as GetObjectKeysResult<T>;
        },
      }),
    ),
  );

export interface ObjectOfReturn<Result> {
  node: t.Node;
  properties: {
    keyNode: t.Node;
    key: string;
    result: Result;
  }[];
}

/**
 * Used when you have a keyed object where all the
 * values are the same type, for instance `states` or
 * `on`
 */
export const objectOf = <Result>(
  parser: AnyParser<Result>,
): AnyParser<ObjectOfReturn<Result>> => {
  return maybeIdentifierTo(
    createParser({
      babelMatcher: t.isObjectExpression,
      parseNode: (node, context) => {
        const properties = getPropertiesOfObjectExpression(node, context);

        const toReturn = {
          node,
          properties: [],
        } as ObjectOfReturn<Result>;

        properties.forEach((property) => {
          const result = parser.parse(property.node.value, context);

          if (result) {
            toReturn.properties.push({
              key: property.key,
              keyNode: property.keyNode,
              result,
            });
          }
        });

        return toReturn;
      },
    }),
  );
};

/**
 * Returns a parser for a named function and allows you to
 * parse its arguments
 */
export const namedFunctionCall = <Argument1Result, Argument2Result>(
  name: string,
  argument1Parser: AnyParser<Argument1Result>,
  argument2Parser?: AnyParser<Argument2Result>,
): AnyParser<{
  node: t.CallExpression;
  argument1Result: Argument1Result | undefined;
  argument2Result: Argument2Result | undefined;
}> => {
  const namedFunctionParser = maybeTsAsExpression(
    maybeIdentifierTo(
      createParser({
        babelMatcher: t.isCallExpression,
        parseNode: (node) => {
          return node;
        },
      }),
    ),
  );

  return {
    matches: (node: t.CallExpression) => {
      if (!namedFunctionParser.matches(node)) {
        return false;
      }

      if (!t.isIdentifier(node.callee)) {
        return false;
      }

      return node.callee.name === name;
    },
    parse: (node: t.CallExpression, context) => {
      return {
        node,
        argument1Result: argument1Parser.parse(node.arguments[0], context),
        argument2Result: argument2Parser?.parse(node.arguments[1], context),
      };
    },
  };
};

export const isFunctionOrArrowFunctionExpression = (
  node: any,
): node is t.ArrowFunctionExpression | t.FunctionExpression => {
  return t.isArrowFunctionExpression(node) || t.isFunctionExpression(node);
};
