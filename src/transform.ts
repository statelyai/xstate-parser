import * as parser from "@babel/parser";
// import * as parser from "@typescript-eslint/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import produce from "immer";
import {
  Action,
  Actions,
  InvokeConfig,
  MachineConfig,
  SingleOrArray,
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
          // @ts-ignore
          state.always = getTransitionConfigOrTarget(property.value);
        });
      }
      case "after": {
        return; // TODO
      }
      case "onEntry": {
        return modify((state) => {
          state.onEntry = getActions(property.value);
        });
      }
      case "onExit": {
        return modify((state) => {
          state.onExit = getActions(property.value);
        });
      }
      case "entry": {
        return modify((state) => {
          state.entry = getActions(property.value);
        });
      }
      case "exit": {
        return modify((state) => {
          state.exit = getActions(property.value);
        });
      }
      case "history": {
        return; // TODO
      }
      case "onDone": {
        return modify((state) => {
          if (t.isObjectExpression(property.value)) {
            // @ts-ignore
            state.onDone = getTransitionConfigOrTarget(property.value as any);
          } else {
            throw new Error("onDone must be an object expression");
          }
        });
      }
      case "invoke": {
        return modify((state) => {
          if (
            t.isObjectExpression(property.value) ||
            t.isArrayExpression(property.value)
          ) {
            state.invoke = getInvokeConfig(property.value);
          } else {
            throw new Error("Invoke must be declared as an array or object");
          }
        });
      }
      case "meta": {
        return; // TODO
      }
    }
  }
};

const getInvokeConfig = (
  invoke: t.ObjectExpression | t.ArrayExpression,
): SingleOrArray<InvokeConfig<any, any>> => {
  if (t.isObjectExpression(invoke)) {
    return getInvokeConfigFromObjectExpression(invoke);
  }
  return invoke.elements.map((invokeElem) => {
    if (t.isObjectExpression(invokeElem)) {
      return getInvokeConfigFromObjectExpression(invokeElem);
    }
    throw new Error("Invoke must be an object");
  });
};

const getInvokeConfigFromObjectExpression = (
  object: t.ObjectExpression,
): InvokeConfig<any, any> => {
  const toReturn: InvokeConfig<any, any> = {
    src: "Anonymous service",
  };

  object.properties.forEach((property) => {
    if (!t.isObjectProperty(property)) {
      throw new Error("Invoke property must be property");
    }
    if (!t.isIdentifier(property.key)) {
      throw new Error("Invoke property key must be identifier");
    }
    switch (property.key.name as keyof InvokeConfig<any, any>) {
      case "id":
        {
          if (!t.isStringLiteral(property.value)) {
            throw new Error("invoke.id must be string literal");
          }
          toReturn.id = property.value.value;
        }
        break;
      case "src":
        {
          if (!t.isStringLiteral(property.value)) {
            throw new Error("invoke.src must be string literal");
          }
          toReturn.src = property.value.value;
        }
        break;
      case "onDone":
        {
          // @ts-ignore
          toReturn.onDone = getTransitionConfigOrTarget(property.value as any);
        }
        break;
      case "onError":
        {
          // @ts-ignore
          toReturn.onError = getTransitionConfigOrTarget(property.value as any);
        }
        break;
      case "autoForward":
        {
          // TODO
        }
        break;
      case "forward":
        {
          // TODO
        }
        break;
      case "data":
        {
          // TODO
        }
        break;
    }
  });

  return toReturn;
};

const getTransitionsConfig = (
  object: t.ObjectExpression,
): TransitionsConfig<any, any> => {
  const transitions: TransitionsConfig<any, any> = {};
  object.properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      if (t.isIdentifier(property.key)) {
        transitions[property.key.name] = getTransitionConfigOrTarget(
          property.value as any,
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
  propertyValue: t.Expression | t.SpreadElement | null,
): TransitionConfigOrTarget<any, any> => {
  let result: TransitionConfigOrTarget<any, any> = "";
  if (t.isStringLiteral(propertyValue)) {
    result = propertyValue.value;
  } else if (t.isObjectExpression(propertyValue)) {
    const onObject = getTransitionConfigFromObjectExpression(propertyValue);
    result = onObject;
  } else if (t.isArrayExpression(propertyValue)) {
    const onArray = getTransitionConfigFromArrayExpression(propertyValue);
    result = onArray;
  } else {
    throw new Error(
      "Transition config must be either string, object, or array",
    );
  }
  return result;
};

const getTransitionConfigFromArrayExpression = (
  array: t.ArrayExpression,
): TransitionConfig<any, any>[] => {
  return array.elements.map((property) => {
    return getTransitionConfigOrTarget(property);
  }) as TransitionConfig<any, any>[];
};

const getTransitionConfigFromObjectExpression = (
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
      case "target":
        {
          if (t.isStringLiteral(property.value)) {
            transitionConfig.target = property.value.value;
          } else {
            throw new Error("Targets of transitions must be string literals");
          }
        }
        break;
      case "cond":
        {
          if (t.isStringLiteral(property.value)) {
            transitionConfig.cond = property.value.value;
          } else if (
            t.isFunctionExpression(property.value) ||
            t.isArrowFunctionExpression(property.value)
          ) {
            transitionConfig.cond = function cond() {
              // TODO - reconsider if cond is the best
              // idea here
              return true;
            };
          } else {
            console.log(property.value);
            throw new Error(
              "target.cond must be string literal or function expression",
            );
          }
        }
        break;
      case "actions": {
        transitionConfig.actions = getActions(property.value);
      }
    }
  });

  return transitionConfig;
};

const getActions = (action: any): Actions<any, any> => {
  if (t.isArrayExpression(action)) {
    return action.elements.map((elem) => {
      if (
        t.isStringLiteral(elem) ||
        t.isFunctionExpression(elem) ||
        t.isArrowFunctionExpression(elem)
      ) {
        return getAction(elem);
      }
      throw new Error("Actions must be string literals or functions");
    });
  }
  return getAction(action);
};

const getAction = (
  action: t.StringLiteral | t.FunctionExpression | t.ArrowFunctionExpression,
): Action<any, any> => {
  if (t.isStringLiteral(action)) {
    return action.value;
  }
  return "hello";
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
