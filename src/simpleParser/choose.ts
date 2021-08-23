import { ChooseConditon } from "xstate";
import { choose } from "xstate/lib/actions";
import { ActionNode, ArrayOfBasicActions } from "./actions";
import { Cond } from "./conds";
import { getActionConfig } from "./toMachineConfig";
import {
  arrayOf,
  maybeArrayOf,
  namedFunctionCall,
  objectTypeWithKnownKeys,
  wrapParserResult,
} from "./utils";

const ChooseFirstArg = arrayOf(
  objectTypeWithKnownKeys({
    // Don't allow choose inside of choose for now,
    // too recursive
    // TODO - fix
    actions: ArrayOfBasicActions,
    cond: Cond,
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
        toPush.actions = getActionConfig(arg1Result.actions);
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
