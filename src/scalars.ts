import * as t from "@babel/types";
import { createParser } from "./createParser";
import { maybeIdentifierTo } from "./identifiers";
import { StringLiteralNode } from "./types";
import { maybeTsAsExpression } from "./tsAsExpression";

export const StringLiteral = maybeTsAsExpression(
  maybeIdentifierTo(
    createParser({
      babelMatcher: t.isStringLiteral,
      parseNode: (node): StringLiteralNode => {
        return {
          value: node.value,
          node,
        };
      },
    }),
  ),
);

export const NumericLiteral = maybeTsAsExpression(
  maybeIdentifierTo(
    createParser({
      babelMatcher: t.isNumericLiteral,
      parseNode: (node) => {
        return {
          value: node.value,
          node,
        };
      },
    }),
  ),
);

export const BooleanLiteral = maybeTsAsExpression(
  maybeIdentifierTo(
    createParser({
      babelMatcher: t.isBooleanLiteral,
      parseNode: (node) => {
        return {
          value: node.value,
          node,
        };
      },
    }),
  ),
);

export const AnyNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node) => ({ node }),
});

export const Identifier = createParser({
  babelMatcher: t.isIdentifier,
  parseNode: (node) => ({ node }),
});

export const TemplateLiteral = maybeTsAsExpression(
  maybeIdentifierTo(
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
  ),
);
