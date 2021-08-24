import * as t from "@babel/types";
import { Action, ChooseConditon } from "xstate";
import { assign, choose, forwardTo, send } from "xstate/lib/actions";

import { Cond } from "./conds";
import { AnyNode, NumericLiteral, StringLiteral } from "./scalars";
import {
  arrayOf,
  createParser,
  isFunctionOrArrowFunctionExpression,
  maybeArrayOf,
  namedFunctionCall,
  objectTypeWithKnownKeys,
  unionType,
  wrapParserResult,
} from "./utils";

export interface ActionNode {
  node: t.Node;
  action: Action<any, any>;
  name: string;
}

export const ActionAsIdentifier = createParser({
  babelMatcher: t.isIdentifier,
  parseNode: (node): ActionNode => {
    return {
      action: node.name,
      node,
      name: node.name,
    };
  },
});

export const ActionAsFunctionExpression = createParser({
  babelMatcher: isFunctionOrArrowFunctionExpression,
  parseNode: (node): ActionNode => {
    return {
      node,
      action: function actions() {},
      name: "",
    };
  },
});

export const ActionAsString = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node): ActionNode => {
    return {
      action: node.value,
      node,
      name: node.value,
    };
  },
});

export const ActionAsNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node): ActionNode => {
    return {
      action: "anonymous",
      node,
      name: "",
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
        toPush.cond = arg1Result.cond.cond;
      }
      conditions.push(toPush);
    });

    return {
      node: node,
      action: choose(conditions),
      name: "",
    };
  },
);

export const AssignAction = wrapParserResult(
  namedFunctionCall("assign", AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: assign(() => {}),
      name: "",
    };
  },
);

export const SendActionSecondArg = objectTypeWithKnownKeys({
  to: StringLiteral,
  delay: unionType<{ node: t.Node; value: string | number }>([
    NumericLiteral,
    StringLiteral,
  ]),
  id: StringLiteral,
});

export const SendAction = wrapParserResult(
  namedFunctionCall("send", AnyNode, SendActionSecondArg),
  (result): ActionNode => {
    return {
      node: result.node,
      name: "",
      action: send(
        () => {
          return {
            type: "UNDEFINED",
          };
        },
        {
          id: result.argument2Result?.id?.value,
          to: result.argument2Result?.to?.value,
          delay: result.argument2Result?.delay?.value,
        },
      ),
    };
  },
);

export const ForwardToAction = wrapParserResult(
  namedFunctionCall("forwardTo", StringLiteral),
  (result): ActionNode => {
    return {
      node: result.node,
      action: forwardTo(result.argument1Result?.value || ""),
      name: "",
    };
  },
);

const NamedAction = unionType([
  ChooseAction,
  AssignAction,
  SendAction,
  ForwardToAction,
]);

const BasicAction = unionType([
  ActionAsFunctionExpression,
  ActionAsString,
  ActionAsIdentifier,
  ActionAsNode,
]);

export const ArrayOfBasicActions = maybeArrayOf(BasicAction);

export const MaybeArrayOfActions = maybeArrayOf(
  unionType([NamedAction, BasicAction]),
);
