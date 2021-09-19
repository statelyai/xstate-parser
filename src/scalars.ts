import * as t from "@babel/types";
import { createParser } from "./createParser";
import { maybeIdentifierTo } from "./identifiers";
import { StringLiteralNode } from "./types";

export const StringLiteral = maybeIdentifierTo(
  createParser({
    babelMatcher: t.isStringLiteral,
    parseNode: (node): StringLiteralNode => {
      return {
        value: node.value,
        node,
      };
    },
  }),
);

export const NumericLiteral = maybeIdentifierTo(
  createParser({
    babelMatcher: t.isNumericLiteral,
    parseNode: (node) => {
      return {
        value: node.value,
        node,
      };
    },
  }),
);

export const BooleanLiteral = maybeIdentifierTo(
  createParser({
    babelMatcher: t.isBooleanLiteral,
    parseNode: (node) => {
      return {
        value: node.value,
        node,
      };
    },
  }),
);

export const AnyNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node) => ({ node }),
});

export const TemplateLiteral = maybeIdentifierTo(
  createParser({
    babelMatcher: t.isTemplateLiteral,
    parseNode: (node) => {
      let value = "";

      node.quasis.forEach((quasi) => {
        value = `${value}${quasi.value.raw}`;
      });
      return {
        node,
        value,
      };
    },
  }),
);

export const Unparseable = createParser({
  babelMatcher: t.isNode,
  parseNode: (node, context) => {
    context.reportCouldNotParseError(node);
    return undefined;
  },
});
