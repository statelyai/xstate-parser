import * as t from "@babel/types";
import { Action } from "xstate";
import { ChooseAction } from "./choose";
import { createParser, maybeArrayOf, unionType } from "./utils";

export interface ActionNode {
  node: t.Node;
  action: Action<any, any>;
}

const ActionAsIdentifier = createParser({
  babelMatcher: t.isIdentifier,
  parseNode: (node): ActionNode => {
    return {
      action: node.name,
      node,
    };
  },
});

const ActionAsString = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node): ActionNode => {
    return {
      action: node.value,
      node,
    };
  },
});

const ActionAsNode = createParser({
  babelMatcher: t.isNode,
  parseNode: (node): ActionNode => {
    return {
      action: "anonymous",
      node,
    };
  },
});

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
