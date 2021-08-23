import * as t from "@babel/types";
import { BooleanLiteral } from "./scalars";
import { MaybeTransitionArray } from "./transitions";
import {
  createParser,
  maybeArrayOf,
  objectTypeWithKnownKeys,
  unionType,
} from "./utils";

const InvokeIdStringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => ({
    loc: node.loc,
    value: node.value,
  }),
});

const InvokeSrcStringLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => ({
    loc: node.loc,
    value: node.value,
  }),
});

const InvokeSrcNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node) => ({
    value: "anonymous",
    loc: node.loc,
  }),
});

const InvokeSrc = unionType([InvokeSrcStringLiteral, InvokeSrcNode]);

const InvokeConfigObject = objectTypeWithKnownKeys({
  id: InvokeIdStringLiteral,
  src: InvokeSrc,
  onDone: MaybeTransitionArray,
  onError: MaybeTransitionArray,
  autoForward: BooleanLiteral,
  forward: BooleanLiteral,
});

export const Invoke = maybeArrayOf(InvokeConfigObject);
