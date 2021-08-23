import * as t from "@babel/types";
import { Action, ChooseConditon } from "xstate";
import { choose } from "xstate/lib/actions";

import { Cond } from "./conds";
import {
  arrayOf,
  createParser,
  maybeArrayOf,
  namedFunctionCall,
  objectTypeWithKnownKeys,
  unionType,
  wrapParserResult,
} from "./utils";

export interface ActionNode {
  node: t.Node;
  action: Action<any, any>;
}

export const ActionAsIdentifier = createParser({
  babelMatcher: t.isIdentifier,
  parseNode: (node): ActionNode => {
    return {
      action: node.name,
      node,
    };
  },
});

export const ActionAsString = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node): ActionNode => {
    return {
      action: node.value,
      node,
    };
  },
});

export const ActionAsNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node): ActionNode => {
    return {
      action: "anonymous",
      node,
    };
  },
});

const ChooseFirstArg = arrayOf(
  objectTypeWithKnownKeys({
    cond: Cond,
    // Don't allow choose inside of choose for now,
    // too recursive
    // TODO - fix
    actions: maybeArrayOf(ActionAsString),
  }),
);

export const ChooseAction = wrapParserResult(
  namedFunctionCall("choose", ChooseFirstArg),
  (result, node): ActionNode => {
    const conditions: ChooseConditon<any, any>[] = [];

    result.argument1Result?.forEach((arg1Result) => {
      const toPush: typeof conditions[number] = {
        actions: [],
      };
      if (arg1Result.actions) {
        const actionResult = arg1Result.actions.map((action) => action.action);

        if (actionResult.length === 1) {
          toPush.actions = actionResult[0];
        } else {
          toPush.actions = actionResult;
        }
      }
      if (arg1Result.cond) {
        toPush.cond = arg1Result.cond.name;
      }
      conditions.push(toPush);
    });

    return {
      node: node,
      action: choose(conditions),
    };
  },
);

const NamedAction = unionType([ChooseAction]);

const BasicAction = unionType([
  ActionAsString,
  ActionAsIdentifier,
  ActionAsNode,
]);

export const ArrayOfBasicActions = maybeArrayOf(BasicAction);

export const MaybeArrayOfActions = maybeArrayOf(
  unionType([NamedAction, BasicAction]),
);
