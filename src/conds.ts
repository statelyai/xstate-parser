import * as t from "@babel/types";
import { Condition } from "xstate";
import {
  createParser,
  isFunctionOrArrowFunctionExpression,
  unionType,
} from "./utils";

export interface CondNode {
  node: t.Node;
  cond: Condition<any, any>;
}

const CondAsFunctionExpression = createParser({
  babelMatcher: isFunctionOrArrowFunctionExpression,
  parseNode: (node): CondNode => {
    return {
      node,
      cond: () => {
        return false;
      },
    };
  },
});

const CondAsStringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node): CondNode => {
    return {
      node,
      cond: node.value,
    };
  },
});

const CondAsNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node): CondNode => {
    return {
      node,
      cond: "anonymous",
    };
  },
});

export const Cond = unionType([
  CondAsFunctionExpression,
  CondAsStringLiteral,
  CondAsNode,
]);
