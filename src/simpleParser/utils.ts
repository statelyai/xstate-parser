import * as t from "@babel/types";
import { AnyParser, Parser } from "./types";

export const unionType = <Result>(
  parsers: AnyParser<Result>[],
): AnyParser<Result> => {
  const matches = (node: any) => {
    return parsers.some((parser) => parser.matches(node));
  };
  const parse = (node: any): Result | undefined => {
    const parser = parsers.find((parser) => parser.matches(node));
    return parser?.parse(node);
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
    parse: (node: any) => {
      const result = parser.parse(node);
      if (!result) return undefined;
      return changeResult(result, node);
    },
  };
};

export const createParser = <T extends t.Node, Result>(params: {
  babelMatcher: (node: any) => node is T;
  parseNode: (node: T) => Result;
}): Parser<T, Result> => {
  const matches = (node: T) => {
    return params.babelMatcher(node);
  };
  const parse = (node: any): Result | undefined => {
    if (!matches(node)) return undefined;
    return params.parseNode(node);
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
    parseNode: (node) => {
      const toReturn: Result[] = [];

      node.elements.map((elem) => {
        const result = parser.parse(elem);
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
    parseNode: (node) => {
      const toReturn: Result[] = [];

      node.elements.map((elem) => {
        const result = parser.parse(elem);
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
    parseNode: (node) => {
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

        const result = parser.parse(property.node.value);
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

export const objectOf = <Result>(
  parser: AnyParser<Result>,
): AnyParser<ObjectOfReturn<Result>> => {
  return createParser({
    babelMatcher: t.isObjectExpression,
    parseNode: (node) => {
      const properties = getPropertiesOfObjectExpression(node);

      const toReturn = {
        node,
        properties: [],
      } as ObjectOfReturn<Result>;

      properties.forEach((property) => {
        const result = parser.parse(property.node.value);

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
