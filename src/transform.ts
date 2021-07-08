import * as parser from "@babel/parser";
// import * as parser from "@typescript-eslint/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import produce from "immer";
import {
  MachineConfig,
  StateNodeConfig,
  TransitionConfig,
  TransitionConfigOrTarget,
  TransitionsConfig,
} from "xstate";

export const parseMachinesFromFile = (
  fileContents: string,
): MachineConfig<any, any, any>[] => {
  const machines: MachineConfig<any, any, any>[] = [];

  const makeMachineModifier =
    (index: number): ModifyMachine =>
    (modification) => {
      machines[index] = produce(machines[index], modification);
    };

  const parseResult = parser.parse(fileContents, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  traverse(parseResult as any, {
    CallExpression(path) {
      const callee = path.node.callee;

      if (t.isIdentifier(callee)) {
        if (["Machine", "createMachine"].includes(callee.name)) {
          const machineConfig = path.node.arguments[0];

          if (t.isObjectExpression(machineConfig)) {
            machines.push({});
            parseStateNode(
              machineConfig,
              makeMachineModifier(machines.length - 1),
            );
          } else {
            throw new Error("Machine config must be an object expression");
          }
        }
      }
    },
  });

  return machines;
};

const parseStateNode = (config: t.ObjectExpression, modify: ModifyMachine) => {
  const properties = config.properties;

  properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      parseStateNodeProperty(property, modify);
    } else {
      throw new Error("Properties on a state node must be object properties");
    }
  });
};

const parseStateNodeProperty = (
  property: t.ObjectProperty,
  modify: ModifyMachine,
) => {
  if (t.isIdentifier(property.key)) {
    const keyName = property.key.name as keyof StateNodeConfig<any, any, any>;
    switch (keyName) {
      case "id": {
        return modify((state) => {
          if (t.isStringLiteral(property.value)) {
            state.id = property.value.value;
          } else {
            throw new Error("id must be string literal");
          }
        });
      }
      case "initial": {
        return modify((state) => {
          if (t.isStringLiteral(property.value)) {
            state.initial = property.value.value;
          } else {
            throw new Error("initial must be string literal");
          }
        });
      }
      case "type": {
        return modify((state) => {
          if (t.isStringLiteral(property.value)) {
            state.type = property.value.value as any;
          } else {
            throw new Error("type must be string literal");
          }
        });
      }
      case "states": {
        return modify((state) => {
          if (t.isObjectExpression(property.value)) {
            state.states = getStatesObject(property.value);
          } else {
            throw new Error("states must be an object expression");
          }
        });
      }
      case "on": {
        return modify((state) => {
          if (t.isObjectExpression(property.value)) {
            state.on = getTransitionsConfig(property.value);
          } else {
            throw new Error("on must be an object expression");
          }
        });
      }
      case "always": {
        return modify((state) => {
          if (t.isObjectExpression(property.value)) {
            state.always = getTransitionConfigOrTarget(property.value);
          } else {
            throw new Error("always must be an object expression");
          }
        });
      }
      case "after": {
        return; // TODO
      }
      case "entry": {
        return; // TODO
      }
      case "exit": {
        return; // TODO
      }
      case "history": {
        return; // TODO
      }
      case "onDone": {
        return; // TODO
      }
      case "invoke": {
        return; // TODO
      }
      case "meta": {
        return; // TODO
      }
    }
  }
};

const getTransitionsConfig = (
  object: t.ObjectExpression,
): TransitionsConfig<any, any> => {
  const transitions: TransitionsConfig<any, any> = {};
  object.properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      if (t.isIdentifier(property.key)) {
        transitions[property.key.name] = getTransitionConfigOrTarget(
          property.value,
        );
      } else {
        throw new Error("on property key must be an identifier");
      }
    } else {
      // TODO improve error wording
      throw new Error("Object properties of on must be objects");
    }
  });

  return transitions;
};

const getTransitionConfigOrTarget = (
  propertyValue: t.ObjectProperty["value"],
): TransitionConfigOrTarget<any, any> => {
  let result: TransitionConfigOrTarget<any, any> = "";
  if (t.isStringLiteral(propertyValue)) {
    result = propertyValue.value;
  } else if (t.isObjectExpression(propertyValue)) {
    const onObject = getTransitionConfig(propertyValue);
    result = onObject;
  }
  return result;
};

const getTransitionConfig = (
  object: t.ObjectExpression,
): TransitionConfig<any, any> => {
  const transitionConfig: TransitionConfig<any, any> = {};

  object.properties.forEach((property) => {
    if (!t.isObjectProperty(property)) {
      throw new Error(`Property of on must be object property`);
    }
    if (!t.isIdentifier(property.key)) {
      throw new Error(`Key of on must be identifier`);
    }
    switch (property.key.name) {
      case "target": {
        if (t.isStringLiteral(property.value)) {
          transitionConfig.target = property.value.value;
        } else {
          throw new Error("Targets of transitions must be string literals");
        }
      }
    }
  });

  return transitionConfig;
};

const getStatesObject = (
  object: t.ObjectExpression,
): StateNodeConfig<any, any, any>["states"] => {
  const states: StateNodeConfig<any, any, any>["states"] = {};
  object.properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      let stateName = "";
      if (t.isIdentifier(property.key)) {
        stateName = property.key.name;
        states[stateName] = {};
      } else {
        throw new Error(
          "Object keys in states property must be string literals",
        );
      }

      if (t.isObjectExpression(property.value)) {
        parseStateNode(property.value, (modification) => {
          states[stateName] = produce(states[stateName], modification);
        });
      }
    } else {
      throw new Error("State nodes must be object properties");
    }
  });
  return states;
};

type ModifyMachine = (
  modifier: (machine: StateNodeConfig<any, any, any>) => void,
) => void;
