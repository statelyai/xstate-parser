import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { AnyParser, Parser, ParserContext } from "./types";

export const unionType = <Result>(
  parsers: AnyParser<Result>[],
): AnyParser<Result> => {
  const matches = (node: any) => {
    return parsers.some((parser) => parser.matches(node));
  };
  const parse = (node: any, context: ParserContext): Result | undefined => {
    const parser = parsers.find((parser) => parser.matches(node));
    return parser?.parse(node, context);
  };

  return {
    matches,
    parse,
  };
};

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

export const createParser = <T extends t.Node, Result>(params: {
  babelMatcher: (node: any) => node is T;
  parseNode: (node: T, context: ParserContext) => Result;
}): Parser<T, Result> => {
  const matches = (node: T) => {
    return params.babelMatcher(node);
  };
  const parse = (node: any, context: ParserContext): Result | undefined => {
    if (!matches(node)) return undefined;
    return params.parseNode(node, context);
  };
  return {
    parse,
    matches,
  };
};

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

export const getPropertiesOfObjectExpression = (node: t.ObjectExpression) => {
  const propertiesToReturn: {
    node: t.ObjectProperty;
    key: string;
    keyNode: t.Identifier | t.StringLiteral | t.NumericLiteral;
  }[] = [];

  node.properties.forEach((property) => {
    if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
      propertiesToReturn.push({
        node: property,
        key: property.key.name,
        keyNode: property.key,
      });
    } else if (
      t.isObjectProperty(property) &&
      t.isStringLiteral(property.key)
    ) {
      propertiesToReturn.push({
        node: property,
        key: property.key.value,
        keyNode: property.key,
      });
    } else if (
      t.isObjectProperty(property) &&
      t.isNumericLiteral(property.key)
    ) {
      propertiesToReturn.push({
        node: property,
        key: `${property.key.value}`,
        keyNode: property.key,
      });
    }
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

export const objectTypeWithKnownKeys = <
  T extends { [index: string]: AnyParser<any> },
>(
  parserObject: T | (() => T),
) =>
  createParser<t.ObjectExpression, GetObjectKeysResult<T>>({
    babelMatcher: t.isObjectExpression,
    parseNode: (node, context) => {
      const properties = getPropertiesOfObjectExpression(node);
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
  });

export interface ObjectOfReturn<Result> {
  node: t.Node;
  properties: {
    keyNode: t.Identifier | t.StringLiteral | t.NumericLiteral;
    key: string;
    result: Result;
  }[];
}

export const identifierReferencingVariableDeclaration = <Result>(
  parser: AnyParser<Result>,
) => {
  return createParser({
    babelMatcher: t.isIdentifier,
    parseNode: (node, context) => {
      const variableDeclarator = findVariableDeclaratorWithName(
        context.file,
        node.name,
      );

      return parser.parse(variableDeclarator?.init, context);
    },
  });
};

export const objectOf = <Result>(
  parser: AnyParser<Result>,
): AnyParser<ObjectOfReturn<Result>> => {
  return createParser({
    babelMatcher: t.isObjectExpression,
    parseNode: (node, context) => {
      const properties = getPropertiesOfObjectExpression(node);

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
  });
};

export const findVariableDeclaratorWithName = (
  file: any,
  name: string,
): t.VariableDeclarator | null | undefined => {
  let declarator: t.VariableDeclarator | null | undefined = null;

  traverse(file, {
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id) && path.node.id.name === name) {
        declarator = path.node as any;
      }
    },
  });

  return declarator;
};
