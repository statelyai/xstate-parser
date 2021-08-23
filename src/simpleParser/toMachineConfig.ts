import {
  Actions,
  MachineConfig,
  StateNodeConfig,
  TransitionConfigOrTarget,
} from "xstate";
import { MaybeArrayOfActions } from "./actions";
import { TMachineCallExpression } from "./simpleParser";
import { StateNodeReturn } from "./stateNode";
import { MaybeTransitionArray } from "./transitions";
import { GetParserResult } from "./utils";

const parseStateNode = (
  astResult: StateNodeReturn,
): StateNodeConfig<any, any, any> => {
  const config: MachineConfig<any, any, any> = {};

  if (astResult?.id) {
    config.id = astResult.id.value;
  }

  if (astResult?.initial) {
    config.initial = astResult.initial.value;
  }

  if (astResult.on) {
    config.on = {};

    astResult.on.properties.forEach((onProperty) => {
      (config.on as any)[onProperty.key] = getTransitions(onProperty.result);
    });
  }

  if (astResult.history) {
    config.history = astResult.history.value;
  }

  if (astResult.states) {
    const states: typeof config.states = {};

    astResult.states.properties.forEach((state) => {
      states[state.key] = parseStateNode(state.result);
    });

    config.states = states;
  }

  return config;
};

export const toMachineConfig = (
  result: TMachineCallExpression,
): MachineConfig<any, any, any> | undefined => {
  if (!result?.definition) return undefined;
  return parseStateNode(result?.definition);
};

export const getActionConfig = (
  astActions: GetParserResult<typeof MaybeArrayOfActions>,
): Actions<any, any> => {
  const actions: Actions<any, any> = [];

  astActions?.forEach((action) => {
    actions.push(action.name);
  });

  return actions;
};

export const getTransitions = (
  astTransitions: GetParserResult<typeof MaybeTransitionArray>,
): TransitionConfigOrTarget<any, any> => {
  const transitions: TransitionConfigOrTarget<any, any> = [];

  astTransitions?.forEach((transition) => {
    const toPush: TransitionConfigOrTarget<any, any> = {};
    if (transition.target) {
      toPush.target = transition.target.value;
    }
    if (transition.cond) {
      toPush.cond = transition.cond.name;
    }
    if (transition.actions) {
      toPush.actions = getActionConfig(transition.actions);
    }

    transitions.push(toPush);
  });

  return transitions;
};
