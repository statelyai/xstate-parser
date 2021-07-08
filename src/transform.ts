import * as parser from "@babel/parser";
// import * as parser from "@typescript-eslint/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import produce from "immer";
import { MachineConfig, StateNodeConfig, TransitionConfig } from "xstate";

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
        if (t.isObjectExpression(property.value)) {
          return parseStatesProperty(property.value, modify);
        } else {
          throw new Error("states must be an object expression");
        }
      }
      case "on": {
        if (t.isObjectExpression(property.value)) {
          return parseOnProperty(property.value, modify);
        } else {
          throw new Error("on must be an object expression");
        }
      }
      case "after": {
        if (t.isObjectExpression(property.value)) {
          return; // TODO
        } else {
          throw new Error("after must be an object expression");
        }
      }
      case "always": {
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

const parseOnProperty = (object: t.ObjectExpression, modify: ModifyMachine) => {
  modify((state) => {
    state.on = {};
  });
  object.properties.forEach((property) => {
    let eventName = "";
    if (t.isObjectProperty(property)) {
      if (t.isIdentifier(property.key)) {
        eventName = property.key.name;

        parseOnValue(eventName, property.value, modify);
      } else {
        throw new Error("on property key must be an identifier");
      }
    } else {
      // TODO improve error wording
      throw new Error("Object properties of on must be objects");
    }
  });
};

const parseOnValue = (
  eventName: string,
  propertyValue: t.ObjectProperty["value"],
  modify: ModifyMachine,
) => {
  if (t.isStringLiteral(propertyValue)) {
    modify((state) => {
      // @ts-ignore
      state.on![eventName] = propertyValue.value;
    });
  } else if (t.isObjectExpression(propertyValue)) {
    const onObject = getOnValueAsObject(eventName, propertyValue);
    modify((state) => {
      // @ts-ignore
      state.on![eventName] = onObject;
    });
  }
};

const getOnValueAsObject = (
  eventName: string,
  object: t.ObjectExpression,
): TransitionConfig<any, any> => {
  const transitionConfig: TransitionConfig<any, any> = {};

  object.properties.forEach((property) => {
    if (!t.isObjectProperty(property)) {
      throw new Error(`Property of on[${eventName}] must be object property`);
    }
    if (!t.isIdentifier(property.key)) {
      throw new Error(`Key of on[${eventName}] must be identifier`);
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

const parseStatesProperty = (
  object: t.ObjectExpression,
  modify: ModifyMachine,
) => {
  modify((state) => {
    state.states = {};
  });
  object.properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      let stateName = "";
      if (t.isIdentifier(property.key)) {
        stateName = property.key.name;
        modify((state) => {
          state.states![stateName] = {};
        });
      } else {
        throw new Error(
          "Object keys in states property must be string literals",
        );
      }

      if (t.isObjectExpression(property.value)) {
        parseStateNode(property.value, (modification) => {
          modify((state) => {
            modification(state.states![stateName]);
          });
        });
      }
    } else {
      throw new Error("State nodes must be object properties");
    }
  });
};

type ModifyMachine = (
  modifier: (machine: StateNodeConfig<any, any, any>) => void,
) => void;
