import * as t from "@babel/types";
import { createParser, unionType } from "./utils";

const CondAsStringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return {
      node,
      name: node.value,
    };
  },
});

const CondAsNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node) => {
    return {
      node,
      name: "anonymous",
    };
  },
});

export const Cond = unionType([CondAsStringLiteral, CondAsNode]);
