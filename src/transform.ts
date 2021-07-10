import * as parser from "@babel/parser";
// import * as parser from "@typescript-eslint/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";
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

export interface MachineParseResult {
  config: MachineConfig<any, any, any>;
  node: t.ObjectExpression;
}

export const parseMachinesFromFile = (
  fileContents: string,
): MachineParseResult[] => {
  const machines: MachineParseResult[] = [];

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
            machines.push({
              config: parseStateNode(machineConfig),
              node: machineConfig,
            });
          } else if (t.isIdentifier(machineConfig)) {
            const variableDeclarator = findVariableDeclaratorWithName(
              parseResult,
              machineConfig.name,
            );

            if (!variableDeclarator) {
              throw new Error("Could not find machine config in this file");
            }
            if (!t.isObjectExpression(variableDeclarator.init)) {
              throw new Error("Machine config must be an object expression");
            }
            machines.push({
              node: variableDeclarator.init,
              config: parseStateNode(variableDeclarator.init),
            });
          } else {
            throw new Error("Machine config must be an object expression");
          }
        }
      }
    },
  });

  return machines;
};

export const findVariableDeclaratorWithName = (
  file: any,
  name: string,
): t.VariableDeclarator | null | undefined => {
  let declarator: t.VariableDeclarator | null | undefined = null;

  traverse(file, {
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id) && path.node.id.name === name) {
        declarator = path.node as any;
      }
    },
  });

  return declarator;
};

export const parseStateNode = (
  config: t.ObjectExpression,
): StateNodeConfig<any, any, any> => {
  const properties = config.properties;

  const stateNode: StateNodeConfig<any, any, any> = {};

  properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      Object.assign(stateNode, parseStateNodeProperty(property));
    } else {
      throw new Error("Properties on a state node must be object properties");
    }
  });

  return stateNode;
};

export const parseStateNodeProperty = (
  property: t.ObjectProperty,
): Partial<StateNodeConfig<any, any, any>> => {
  if (t.isIdentifier(property.key)) {
    const keyName = property.key.name as keyof StateNodeConfig<any, any, any>;
    switch (keyName) {
      case "id": {
        if (t.isStringLiteral(property.value)) {
          return {
            id: property.value.value,
          };
        } else {
          throw new Error("id must be string literal");
        }
      }
      case "initial": {
        if (t.isStringLiteral(property.value)) {
          return {
            initial: property.value.value,
          };
        } else {
          throw new Error("initial must be string literal");
        }
      }
      case "type": {
        if (t.isStringLiteral(property.value)) {
          return {
            type: property.value.value as any,
          };
        } else {
          throw new Error("type must be string literal");
        }
      }
      case "states": {
        if (t.isObjectExpression(property.value)) {
          return {
            states: getStatesObject(property.value),
          };
        } else {
          throw new Error("states must be an object expression");
        }
      }
      case "on": {
        if (t.isObjectExpression(property.value)) {
          return { on: getTransitionsConfig(property.value) };
        } else {
          throw new Error("on must be an object expression");
        }
      }
      case "always": {
        return {
          always: getTransitionConfigOrTarget(property.value),
        };
      }
      case "after": {
        return {
          after: getDelayedTransitions(property.value),
        };
      }
      case "onEntry": {
        return {
          onEntry: getActions(property.value),
        };
      }
      case "onExit": {
        return { onExit: getActions(property.value) };
      }
      case "entry": {
        return { entry: getActions(property.value) };
      }
      case "exit": {
        return { exit: getActions(property.value) };
      }
      case "history": {
        return {}; // TODO
      }
      case "onDone": {
        // @ts-ignore
        return { onDone: getTransitionConfigOrTarget(property.value as any) };
      }
      case "invoke": {
        if (
          t.isObjectExpression(property.value) ||
          t.isArrayExpression(property.value)
        ) {
          return { invoke: getInvokeConfig(property.value) };
        } else {
          throw new Error("Invoke must be declared as an array or object");
        }
      }
      case "meta": {
        return {}; // TODO
      }
      default: {
        return {};
      }
    }
  }
  throw new Error("Property key of state node must be identifier");
};

export const getDelayedTransitions = (after: {}): DelayedTransitions<
  any,
  any
> => {
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

export const getInvokeConfig = (
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

export const getInvokeConfigFromObjectExpression = (
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

export const getTransitionsConfig = (
  object: t.ObjectExpression,
): TransitionsConfig<any, any> => {
  const transitions: TransitionsConfig<any, any> = {};
  object.properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      if (t.isIdentifier(property.key)) {
        transitions[property.key.name] = getTransitionConfigOrTarget(
          property.value,
        );
      } else if (t.isStringLiteral(property.key)) {
        transitions[property.key.value] = getTransitionConfigOrTarget(
          property.value,
        );
      } else {
        console.log(property.key);
        throw new Error("on property key must be an identifier");
      }
    } else {
      // TODO improve error wording
      throw new Error("Object properties of on must be objects");
    }
  });

  return transitions;
};

export const getTransitionConfigOrTarget = (
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

export const getTransitionConfigFromArrayExpression = (
  array: t.ArrayExpression,
): TransitionConfig<any, any>[] => {
  return array.elements.map((property) => {
    return getTransitionConfigOrTarget(property);
  }) as TransitionConfig<any, any>[];
};

export const getTransitionConfigFromObjectExpression = (
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

export const getCond = (cond: {}): Condition<any, any> => {
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

export const getActions = (action: any): Actions<any, any> => {
  if (t.isArrayExpression(action)) {
    return action.elements.map((elem) => {
      return getAction(elem);
    });
  }
  return getAction(action);
};

export const getAction = (action: {} | null): Action<any, any> => {
  if (t.isStringLiteral(action)) {
    return action.value;
  }
  // console.log(action);

  if (t.isCallExpression(action)) {
    let actionName = "";
    if (t.isIdentifier(action.callee)) {
      // raise()
      actionName = action.callee.name;
    } else if (
      t.isMemberExpression(action.callee) &&
      t.isIdentifier(action.callee.property)
    ) {
      // actions.raise()
      actionName = action.callee.property.name;
    } else {
      throw new Error(
        "Action callee must be an identifier or member expression",
      );
    }

    switch (actionName as keyof typeof xstateActions) {
      case "assign":
        return xstateActions.assign(() => {});
      // TODO - calculate all actions here
      case "send": {
        const obj = Object.create({ type: "ANY" });
        return xstateActions.send(obj); // TODO
      }
      case "sendParent": {
        const obj = Object.create({ type: "ANY" });
        return xstateActions.sendParent(obj); // TODO
      }
      case "forwardTo":
        return getForwardToAction(action);
      case "choose":
        return getChooseAction(action);
      case "stop":
        return xstateActions.stop("");
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
        states[stateName] = parseStateNode(property.value);
      }
    } else {
      throw new Error("State nodes must be object properties");
    }
  });
  return states;
};
