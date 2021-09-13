import * as t from "@babel/types";
import { Action, ChooseConditon } from "xstate";
import { assign, choose, forwardTo, send } from "xstate/lib/actions";

import { Cond, CondNode } from "./conds";
import { AnyNode, NumericLiteral, StringLiteral } from "./scalars";
import {
  arrayOf,
  isFunctionOrArrowFunctionExpression,
  maybeArrayOf,
  namedFunctionCall,
  objectTypeWithKnownKeys,
  wrapParserResult,
} from "./utils";
import {
  AfterAction,
  CancelAction,
  DoneAction,
  EscalateAction,
  LogAction,
  PureAction,
  RaiseAction,
  RespondAction,
  SendParentAction,
  SendUpdateAction,
  StartAction,
  StopAction,
} from "./namedActions";
import { createParser } from "./createParser";
import { unionType } from "./unionType";
import { maybeIdentifierTo } from "./identifiers";

export interface ActionNode {
  node: t.Node;
  action: Action<any, any>;
  name: string;
  chooseConditions?: ParsedChooseCondition[];
}

export interface ParsedChooseCondition {
  condition: ChooseConditon<any, any>;
  actionNodes: ActionNode[];
  conditionNode?: CondNode;
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

export const ActionAsFunctionExpression = maybeIdentifierTo(
  createParser({
    babelMatcher: isFunctionOrArrowFunctionExpression,
    parseNode: (node): ActionNode => {
      const action = function actions() {};

      action.toJSON = () => "anonymous";
      return {
        node,
        action,
        name: "",
      };
    },
  }),
);

export const ActionAsString = maybeIdentifierTo(
  createParser({
    babelMatcher: t.isStringLiteral,
    parseNode: (node): ActionNode => {
      return {
        action: node.value,
        node,
        name: node.value,
      };
    },
  }),
);

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
    const conditions: ParsedChooseCondition[] = [];

    result.argument1Result?.forEach((arg1Result) => {
      const toPush: typeof conditions[number] = {
        condition: {
          actions: [],
        },
        actionNodes: [],
      };
      if (arg1Result.actions) {
        const actionResult = arg1Result.actions.map((action) => action.action);

        if (actionResult.length === 1) {
          toPush.condition.actions = actionResult[0];
        } else {
          toPush.condition.actions = actionResult;
        }
        toPush.actionNodes = arg1Result.actions;
      }
      if (arg1Result.cond) {
        toPush.condition.cond = arg1Result.cond.cond;
        toPush.conditionNode = arg1Result.cond;
      }
      conditions.push(toPush);
    });

    return {
      node: node,
      action: choose(conditions.map((condition) => condition.condition)),
      chooseConditions: conditions,
      name: "",
    };
  },
);

interface AssignFirstArg {
  node: t.Node;
  value: {} | (() => {});
}

const AssignFirstArgObject = createParser({
  babelMatcher: t.isObjectExpression,
  parseNode: (node) => {
    return {
      node,
      value: {},
    };
  },
});

const AssignFirstArgFunction = createParser({
  babelMatcher: isFunctionOrArrowFunctionExpression,
  parseNode: (node) => {
    const value = function anonymous() {
      return {};
    };
    value.toJSON = () => {
      return {};
    };

    return {
      node,
      value,
    };
  },
});

const AssignFirstArg = unionType<AssignFirstArg>([
  AssignFirstArgObject,
  AssignFirstArgFunction,
]);

export const AssignAction = wrapParserResult(
  namedFunctionCall("assign", AssignFirstArg),
  (result): ActionNode => {
    const defaultAction = function anonymous() {
      return {};
    };
    defaultAction.toJSON = () => {
      return {};
    };

    return {
      node: result.node,
      action: assign(result.argument1Result?.value || defaultAction),
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
  namedFunctionCall(
    "send",
    unionType<{ node: t.Node; value?: string }>([StringLiteral, AnyNode]),
    SendActionSecondArg,
  ),
  (result): ActionNode => {
    return {
      node: result.node,
      name: "",
      action: send(
        result.argument1Result?.value ??
          (() => {
            return {
              type: "UNDEFINED",
            };
          }),
        {
          id: result.argument2Result?.id?.value,
          to: result.argument2Result?.to?.value,
          delay: result.argument2Result?.delay?.value,
        },
      ),
    };
  },
);

export const ForwardToActionSecondArg = objectTypeWithKnownKeys({
  to: StringLiteral,
});

export const ForwardToAction = wrapParserResult(
  namedFunctionCall("forwardTo", StringLiteral, ForwardToActionSecondArg),
  (result): ActionNode => {
    return {
      node: result.node,
      action: forwardTo(result.argument1Result?.value || "", {
        to: result.argument2Result?.to?.value,
      }),
      name: "",
    };
  },
);

const NamedAction = unionType([
  ChooseAction,
  AssignAction,
  SendAction,
  ForwardToAction,
  AfterAction,
  CancelAction,
  DoneAction,
  EscalateAction,
  LogAction,
  PureAction,
  RaiseAction,
  RespondAction,
  SendUpdateAction,
  StartAction,
  StopAction,
  SendParentAction,
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
