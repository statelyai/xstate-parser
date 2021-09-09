import * as t from "@babel/types";
import { MaybeArrayOfActions } from "./actions";
import { Cond } from "./conds";
import { createParser } from "./createParser";
import { StringLiteral } from "./scalars";
import { StringLiteralNode } from "./types";
import { unionType } from "./unionType";
import {
  GetParserResult,
  maybeArrayOf,
  objectTypeWithKnownKeys,
  wrapParserResult,
} from "./utils";

export type TransitionConfigNode = GetParserResult<typeof TransitionObject>;

const TransitionObject = objectTypeWithKnownKeys({
  target: StringLiteral,
  actions: MaybeArrayOfActions,
  cond: Cond,
});

const TransitionConfigOrTargetLiteral = unionType([
  TransitionObject,
  wrapParserResult(StringLiteral, (target): TransitionConfigNode => {
    return {
      target,
      node: target.node,
    };
  }),
]);

export const MaybeTransitionArray = maybeArrayOf(
  TransitionConfigOrTargetLiteral,
);
