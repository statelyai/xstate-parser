import * as parser from "@babel/parser";
// import * as parser from "@typescript-eslint/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
import produce from "immer";
import {
  Action,
  Actions,
  actions as xstateActions,
  ChooseConditon,
  Condition,
  DelayedTransitions,
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
        return modify((state) => {
          state.after = getDelayedTransitions(property.value);
        });
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

const getDelayedTransitions = (after: {}): DelayedTransitions<any, any> => {
  if (!t.isObjectExpression(after)) {
    throw new Error("After must be expressed as an object");
  }

  const delayedTransitions: DelayedTransitions<any, any> = {};

  after.properties.forEach((property) => {
    if (!t.isObjectProperty(property)) {
      throw new Error(`After value must be an object property`);
    }
    if (!t.isStringLiteral(property.key) && !t.isNumericLiteral(property.key)) {
      console.log(property.key);
      throw new Error(`After key must be string or number literal`);
    }
    // @ts-ignore
    delayedTransitions[property.key.value] = getTransitionConfigOrTarget(
      property.value,
    );
  });
  return delayedTransitions;
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
          if (t.isStringLiteral(property.value)) {
            toReturn.src = property.value.value;
          } else if (
            t.isArrowFunctionExpression(property.value) ||
            t.isFunctionExpression(property.value)
          ) {
            toReturn.src = function src() {
              return () => {};
            };
          } else if (t.isIdentifier(property.value)) {
            toReturn.src = function src() {
              return () => {};
            };
          } else {
            console.log(property.value);
            throw new Error("invoke.src must be string literal");
          }
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
  propertyValue: {} | null,
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
          transitionConfig.cond = getCond(property.value);
        }
        break;
      case "actions": {
        transitionConfig.actions = getActions(property.value);
      }
    }
  });

  return transitionConfig;
};

const getCond = (cond: {}): Condition<any, any> => {
  if (t.isStringLiteral(cond)) {
    return cond.value;
  } else if (
    t.isFunctionExpression(cond) ||
    t.isArrowFunctionExpression(cond)
  ) {
    return function cond() {
      // TODO - reconsider if cond is the best
      // idea here
      return true;
    };
  } else {
    console.log(cond);
    throw new Error(
      "target.cond must be string literal or function expression",
    );
  }
};

const getActions = (action: any): Actions<any, any> => {
  if (t.isArrayExpression(action)) {
    return action.elements.map((elem) => {
      return getAction(elem);
    });
  }
  return getAction(action);
};

const getAction = (action: {} | null): Action<any, any> => {
  if (t.isStringLiteral(action)) {
    return action.value;
  }
  // console.log(action);

  if (t.isCallExpression(action)) {
    if (!t.isIdentifier(action.callee)) {
      throw new Error("Action callee must be an identifier");
    }
    switch (action.callee.name as keyof typeof xstateActions) {
      case "assign":
        return xstateActions.assign(() => {});
      // TODO - calculate all actions here
      case "send":
        return xstateActions.send("");
      case "forwardTo":
        return getForwardToAction(action);
      case "choose":
        return getChooseAction(action);
      default:
        return () => {};
    }
    // action.callee;
  }

  if (t.isArrowFunctionExpression(action) || t.isFunctionExpression(action)) {
    return function actions() {};
  }

  console.log(action);
  throw new Error(
    "Action must be string literal, known XState action or function/arrow function expression",
  );
};

const getForwardToAction = (action: t.CallExpression): Action<any, any> => {
  const idArgument = action.arguments[0];

  if (t.isStringLiteral(idArgument)) {
    return xstateActions.forwardTo(idArgument.value);
  }
  throw new Error("forwardToAction arguments[0] must be a string");
};

const getChooseAction = (action: t.CallExpression): Action<any, any> => {
  const arrayArgument = action.arguments[0];

  if (!t.isArrayExpression(arrayArgument)) {
    throw new Error("choose arguments[0] must be an array");
  }

  const toReturn: Array<ChooseConditon<any, any>> = [];

  arrayArgument.elements.forEach((elem, index) => {
    if (!t.isObjectExpression(elem)) {
      throw new Error(`choose arguments[0][${index}] must be an object`);
    }
    toReturn.push({
      actions: [],
    });
    elem.properties.forEach((property) => {
      if (!t.isObjectProperty(property)) {
        throw new Error(
          `choose arguments[0][${index}] properties must be object properties`,
        );
      }
      if (!t.isIdentifier(property.key)) {
        throw new Error(`choose arguments[0][${index}] key must be identifier`);
      }

      switch (property.key.name as keyof ChooseConditon<any, any>) {
        case "actions":
          toReturn[toReturn.length - 1].actions = getActions(property.value);
          break;
        case "cond":
          toReturn[toReturn.length - 1].cond = getCond(property.value);
      }
    });
  });

  return xstateActions.choose(toReturn);
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
