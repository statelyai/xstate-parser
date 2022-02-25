import * as t from '@babel/types';
import { MaybeArrayOfActions } from './actions';
import { Cond } from './conds';
import { createParser } from './createParser';
import { StringLiteral } from './scalars';
import { StringLiteralNode } from './types';
import { unionType } from './unionType';
import {
  GetParserResult,
  maybeArrayOf,
  objectTypeWithKnownKeys
} from './utils';
import { wrapParserResult } from './wrapParserResult';

export type TransitionConfigNode = GetParserResult<typeof TransitionObject>;

const TransitionTarget = maybeArrayOf(StringLiteral);

const TransitionObject = objectTypeWithKnownKeys({
  target: TransitionTarget,
  actions: MaybeArrayOfActions,
  cond: Cond
});

const TransitionConfigOrTargetLiteral = unionType([
  TransitionObject,
  wrapParserResult(TransitionTarget, (targets): TransitionConfigNode => {
    return {
      target: targets,
      node: targets[0].node
    };
  })
]);

export const MaybeTransitionArray = maybeArrayOf(
  TransitionConfigOrTargetLiteral
);
