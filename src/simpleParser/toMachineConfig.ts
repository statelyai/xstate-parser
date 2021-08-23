import { MachineConfig, StateNodeConfig } from "xstate";
import { StringLiteral } from "./scalars";
import { TMachineCallExpression } from "./simpleParser";
import { StateNode, StateNodeReturn } from "./stateNode";
import { GetObjectKeysResult, objectTypeWithKnownKeys } from "./utils";

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
