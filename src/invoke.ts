import * as t from "@babel/types";
import { createParser } from "./createParser";
import { maybeIdentifierTo } from "./identifiers";
import { BooleanLiteral, StringLiteral } from "./scalars";
import { MaybeTransitionArray } from "./transitions";
import { maybeTsAsExpression } from "./tsAsExpression";
import { unionType } from "./unionType";
import {
  isFunctionOrArrowFunctionExpression,
  maybeArrayOf,
  objectTypeWithKnownKeys,
} from "./utils";

interface InvokeNode {
  node: t.Node;
  value: string | (() => Promise<void>);
}

const InvokeSrcFunctionExpression = maybeTsAsExpression(
  maybeIdentifierTo(
    createParser({
      babelMatcher: isFunctionOrArrowFunctionExpression,
      parseNode: (node): InvokeNode => {
        const value = async function src() {};

        value.toJSON = () => "anonymous";
        return {
          value,
          node,
        };
      },
    }),
  ),
);

const InvokeSrcNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node): InvokeNode => ({
    value: "anonymous",
    node,
  }),
});

const InvokeSrc = unionType([
  StringLiteral,
  InvokeSrcFunctionExpression,
  InvokeSrcNode,
]);

const InvokeConfigObject = objectTypeWithKnownKeys({
  id: StringLiteral,
  src: InvokeSrc,
  onDone: MaybeTransitionArray,
  onError: MaybeTransitionArray,
  autoForward: BooleanLiteral,
  forward: BooleanLiteral,
});

export const Invoke = maybeArrayOf(InvokeConfigObject);
