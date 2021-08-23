import * as t from "@babel/types";
import { createParser, maybeArrayOf, unionType } from "./utils";

const ActionAsIdentifier = createParser({
  babelMatcher: t.isIdentifier,
  parseNode: (node) => {
    return {
      name: node.name,
      node,
    };
  },
});

const ActionAsString = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return {
      name: node.value,
      node,
    };
  },
});

const ActionAsNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node) => {
    return {
      name: "anonymous",
      node,
    };
  },
});

const Action = unionType([ActionAsString, ActionAsIdentifier, ActionAsNode]);

export const MaybeArrayOfActions = maybeArrayOf(Action);
