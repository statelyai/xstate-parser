import * as t from "@babel/types";
import { createParser } from "./utils";
import { StringLiteralNode } from "./types";

export const StringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node): StringLiteralNode => {
    return {
      value: node.value,
      node,
    };
  },
});

export const BooleanLiteral = createParser({
  babelMatcher: t.isBooleanLiteral,
  parseNode: (node) => {
    return {
      value: node.value,
      node,
    };
  },
});
