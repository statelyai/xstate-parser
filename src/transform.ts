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
import { MachineCallExpression } from "./simpleParser/simpleParser";
import { ParserReturnType } from "./simpleParser/types";
import { eventsToMachineConfigs } from "./simpleParser/utils";

export interface MachineParseResult {
  config: MachineConfig<any, any, any>;
  node: t.ObjectExpression;
  statesMeta: MachineParseResultState[];
}

export interface MachineParseResultState {
  path: string[];
  location: Location;
  /**
   * Metadata for the 'initial' property of a state
   */
  initial: MachineParseResultTarget | undefined;
  targets: MachineParseResultTarget[];
  node: t.ObjectExpression;
  keyLocation: Location | undefined;
}

export interface MachineParseResultTarget {
  location: Location;
  target: string;
}

export interface Location {
  start: LineAndCharLocation;
  end: LineAndCharLocation;
}

export interface LineAndCharLocation {
  absoluteChar: number;
  line: number;
  column: number;
}

export const parseMachinesFromFile = (
  fileContents: string,
): MachineConfig<any, any, any>[] => {
  if (
    !fileContents.includes("createMachine") &&
    !fileContents.includes("Machine")
  ) {
    return [];
  }

  const parseResult = parser.parse(fileContents, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  let returnType: ParserReturnType = [];

  traverse(parseResult as any, {
    CallExpression(path: any) {
      returnType.push(...(MachineCallExpression.parse(path.node) || []));
    },
  });

  return eventsToMachineConfigs(returnType as any);
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
  object: t.ObjectExpression,
  path: string[],
  key: t.Expression | undefined,
): {
  config: StateNodeConfig<any, any, any>;
  statesMeta: MachineParseResultState[];
} => {
  const properties = object.properties;

  const stateNode: StateNodeConfig<any, any, any> = {};
  const childStatesMeta: MachineParseResultState[] = [];
  const targets: MachineParseResultTarget[] = [];
  let initialMeta: MachineParseResultTarget | undefined = undefined;

  properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      const result = parseStateNodeProperty(property, path);
      Object.assign(stateNode, result.configPartial);
      if (result.childStatesMeta) {
        childStatesMeta.push(...result.childStatesMeta);
      }
      if (result.targets) {
        targets.push(...result.targets);
      }
      if (result.initialMeta) {
        initialMeta = result.initialMeta;
      }
    } else {
      throw new Error("Properties on a state node must be object properties");
    }
  });

  const thisNodeMeta: MachineParseResultState = {
    path,
    location: getLocationFromNode(object),
    targets,
    initial: initialMeta,
    node: object,
    keyLocation: key ? getLocationFromNode(key) : undefined,
  };

  return { config: stateNode, statesMeta: [thisNodeMeta, ...childStatesMeta] };
};

export const parseStateNodeProperty = (
  property: t.ObjectProperty,
  path: string[],
): {
  configPartial: Partial<StateNodeConfig<any, any, any>>;
  targets?: MachineParseResultTarget[];
  childStatesMeta?: MachineParseResultState[];
  initialMeta?: MachineParseResultTarget;
} => {
  if (t.isIdentifier(property.key)) {
    const keyName = property.key.name as keyof StateNodeConfig<any, any, any>;
    switch (keyName) {
      case "id": {
        if (t.isStringLiteral(property.value)) {
          return {
            configPartial: {
              id: property.value.value,
            },
          };
        } else {
          throw new Error("id must be string literal");
        }
      }
      case "initial": {
        if (t.isStringLiteral(property.value)) {
          return {
            configPartial: {
              initial: property.value.value,
            },
            initialMeta: {
              target: property.value.value,
              location: getLocationFromNode(property.value),
            },
          };
        } else {
          throw new Error("initial must be string literal");
        }
      }
      case "type": {
        if (t.isStringLiteral(property.value)) {
          return {
            configPartial: {
              type: property.value.value as any,
            },
          };
        } else {
          throw new Error("type must be string literal");
        }
      }
      case "states": {
        if (t.isObjectExpression(property.value)) {
          const result = getStatesObject(property.value, path);
          return {
            configPartial: {
              states: result.config,
            },
            childStatesMeta: result.statesMeta,
          };
        } else {
          throw new Error("states must be an object expression");
        }
      }
      case "on": {
        if (t.isObjectExpression(property.value)) {
          const result = getTransitionsConfig(property.value);
          return {
            configPartial: { on: result.config },
            targets: result.targetsMeta,
          };
        } else {
          throw new Error("on must be an object expression");
        }
      }
      case "always": {
        const result = getTransitionConfigOrTarget(property.value);
        return {
          configPartial: {
            always: result.config,
          },
          targets: result.targetsMeta,
        };
      }
      case "after": {
        const result = getDelayedTransitions(property.value);
        return {
          configPartial: {
            after: result.config,
          },
          targets: result.targets,
        };
      }
      case "onEntry": {
        return {
          configPartial: {
            onEntry: getActions(property.value),
          },
        };
      }
      case "onExit": {
        return {
          configPartial: {
            onExit: getActions(property.value),
          },
        };
      }
      case "entry": {
        return {
          configPartial: {
            entry: getActions(property.value),
          },
        };
      }
      case "exit": {
        return {
          configPartial: {
            exit: getActions(property.value),
          },
        };
      }
      case "history": {
        return {
          configPartial: {},
        }; // TODO
      }
      case "onDone": {
        const result = getTransitionConfigOrTarget(property.value as any);
        return {
          configPartial: {
            onDone: result.config as any,
          },
          targets: result.targetsMeta,
        };
      }
      case "invoke": {
        if (
          t.isObjectExpression(property.value) ||
          t.isArrayExpression(property.value)
        ) {
          const result = getInvokeConfig(property.value);
          return {
            configPartial: {
              invoke: result.config,
            },
            targets: result.targetsMeta,
          };
        } else {
          throw new Error("Invoke must be declared as an array or object");
        }
      }
      case "meta": {
        return {
          configPartial: {},
        }; // TODO
      }
      default: {
        return {
          configPartial: {},
        };
      }
    }
  }
  throw new Error("Property key of state node must be identifier");
};

export const getDelayedTransitions = (after: {}): {
  config: DelayedTransitions<any, any>;
  targets: MachineParseResultTarget[];
} => {
  if (!t.isObjectExpression(after)) {
    throw new Error("After must be expressed as an object");
  }

  const delayedTransitions: DelayedTransitions<any, any> = {};
  const targets: MachineParseResultTarget[] = [];

  after.properties.forEach((property) => {
    if (!t.isObjectProperty(property)) {
      throw new Error(`After value must be an object property`);
    }
    if (!t.isStringLiteral(property.key) && !t.isNumericLiteral(property.key)) {
      console.log(property.key);
      throw new Error(`After key must be string or number literal`);
    }
    const result = getTransitionConfigOrTarget(property.value);

    delayedTransitions[property.key.value] = result.config as any;
    targets.push(...result.targetsMeta);
  });
  return { config: delayedTransitions, targets };
};

export const getInvokeConfig = (
  invoke: t.ObjectExpression | t.ArrayExpression,
): {
  config: SingleOrArray<InvokeConfig<any, any>>;
  targetsMeta: MachineParseResultTarget[];
} => {
  if (t.isObjectExpression(invoke)) {
    return getInvokeConfigFromObjectExpression(invoke);
  }
  const invokes: InvokeConfig<any, any>[] = [];
  const targetsMeta: MachineParseResultTarget[] = [];
  invoke.elements.forEach((invokeElem) => {
    if (t.isObjectExpression(invokeElem)) {
      const result = getInvokeConfigFromObjectExpression(invokeElem);
      invokes.push(result.config);
      targetsMeta.push(...result.targetsMeta);
    } else {
      throw new Error("Invoke must be an object");
    }
  });

  return {
    config: invokes,
    targetsMeta,
  };
};

export const getInvokeConfigFromObjectExpression = (
  object: t.ObjectExpression,
): {
  config: InvokeConfig<any, any>;
  targetsMeta: MachineParseResultTarget[];
} => {
  const toReturn: InvokeConfig<any, any> = {
    src: "Anonymous service",
  };
  const targetsMeta: MachineParseResultTarget[] = [];

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
          } else if (
            t.isIdentifier(property.value) ||
            t.isMemberExpression(property.value)
          ) {
            toReturn.src = function src() {
              return () => {};
            };
          } else {
            console.log(property.value);
            throw new Error(
              "invoke.src must be string literal, arrow function, function or identifier",
            );
          }
        }
        break;
      case "onDone":
        {
          const result = getTransitionConfigOrTarget(property.value as any);
          toReturn.onDone = result.config as any;
          targetsMeta.push(...result.targetsMeta);
        }
        break;
      case "onError":
        {
          const result = getTransitionConfigOrTarget(property.value as any);
          toReturn.onError = result.config as any;
          targetsMeta.push(...result.targetsMeta);
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

  return {
    config: toReturn,
    targetsMeta,
  };
};

export const getTransitionsConfig = (
  object: t.ObjectExpression,
): {
  config: TransitionsConfig<any, any>;
  targetsMeta: MachineParseResultTarget[];
} => {
  const transitions: TransitionsConfig<any, any> = {};
  const targetsMeta: MachineParseResultTarget[] = [];
  object.properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      if (t.isIdentifier(property.key)) {
        const result = getTransitionConfigOrTarget(property.value);
        transitions[property.key.name] = result.config;
        targetsMeta.push(...result.targetsMeta);
      } else if (t.isStringLiteral(property.key)) {
        const result = getTransitionConfigOrTarget(property.value);
        transitions[property.key.value] = result.config;
        targetsMeta.push(...result.targetsMeta);
      } else {
        console.log(property.key);
        throw new Error("on property key must be an identifier");
      }
    } else {
      // TODO improve error wording
      throw new Error("Object properties of on must be objects");
    }
  });

  return {
    config: transitions,
    targetsMeta,
  };
};

export const getTransitionConfigOrTarget = (
  propertyValue: {} | null,
): {
  config: TransitionConfigOrTarget<any, any>;
  targetsMeta: MachineParseResultTarget[];
} => {
  let transitionConfigOrTarget: TransitionConfigOrTarget<any, any> = "";
  const targetsMeta: MachineParseResultTarget[] = [];
  if (t.isStringLiteral(propertyValue)) {
    transitionConfigOrTarget = propertyValue.value;
    targetsMeta.push({
      location: getLocationFromNode(propertyValue),
      target: propertyValue.value,
    });
  } else if (t.isObjectExpression(propertyValue)) {
    const result = getTransitionConfigFromObjectExpression(propertyValue);
    transitionConfigOrTarget = result.config;
    targetsMeta.push(...result.targetsMeta);
  } else if (t.isArrayExpression(propertyValue)) {
    const result = getTransitionConfigFromArrayExpression(propertyValue);
    transitionConfigOrTarget = result.config;
    targetsMeta.push(...result.targetsMeta);
  } else {
    throw new Error(
      "Transition config must be either string, object, or array",
    );
  }
  return {
    config: transitionConfigOrTarget,
    targetsMeta,
  };
};

export const getTransitionConfigFromArrayExpression = (
  array: t.ArrayExpression,
): {
  config: TransitionConfig<any, any>[];
  targetsMeta: MachineParseResultTarget[];
} => {
  const config: TransitionConfig<any, any>[] = [];
  const targetsMeta: MachineParseResultTarget[] = [];
  array.elements.forEach((property) => {
    const result = getTransitionConfigOrTarget(property);
    config.push(result.config as any);
    targetsMeta.push(...result.targetsMeta);
  });

  return {
    config,
    targetsMeta,
  };
};

export const getTransitionConfigFromObjectExpression = (
  object: t.ObjectExpression,
): {
  config: TransitionConfigOrTarget<any, any>;
  targetsMeta: MachineParseResultTarget[];
} => {
  const transitionConfig: TransitionConfig<any, any> = {};
  const targetsMeta: MachineParseResultTarget[] = [];

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
            targetsMeta.push({
              location: getLocationFromNode(property.value),
              target: property.value.value,
            });
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

  return {
    config: transitionConfig,
    targetsMeta: targetsMeta,
  };
};

export const getCond = (cond: {}): Condition<any, any> => {
  if (t.isStringLiteral(cond)) {
    return cond.value;
  } else if (
    t.isIdentifier(cond) ||
    t.isMemberExpression(cond) ||
    t.isFunctionExpression(cond) ||
    t.isArrowFunctionExpression(cond)
  ) {
    return function cond() {
      return true;
    };
  } else {
    console.log(cond);
    throw new Error(
      "target.cond must be string literal, function expression, identifier or member expression",
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

  if (t.isIdentifier(action) || t.isMemberExpression(action)) {
    return function actions() {};
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
  path: string[],
): {
  config: StateNodeConfig<any, any, any>["states"];
  statesMeta: MachineParseResultState[];
} => {
  const states: StateNodeConfig<any, any, any>["states"] = {};
  const statesMeta: MachineParseResultState[] = [];
  object.properties.forEach((property) => {
    if (t.isObjectProperty(property)) {
      let stateName = "";
      if (t.isIdentifier(property.key)) {
        stateName = property.key.name;
        states[stateName] = {};
      } else if (t.isStringLiteral(property.key)) {
        stateName = property.key.value;
        states[stateName] = {};
      } else {
        console.log(property.key);
        throw new Error(
          "Object keys in states property must be identifiers or string literals",
        );
      }

      if (t.isObjectExpression(property.value)) {
        const result = parseStateNode(
          property.value,
          [...path, stateName],
          property.key,
        );
        states[stateName] = result.config;
        statesMeta.push(...result.statesMeta);
      }
    } else {
      throw new Error("State nodes must be object properties");
    }
  });
  return {
    config: states,
    statesMeta,
  };
};

const getLocationFromNode = (node: t.Node): Location => {
  return {
    start: {
      absoluteChar: node.start!,
      column: node.loc?.start.column!,
      line: node.loc?.start.line!,
    },
    end: {
      absoluteChar: node.end!,
      column: node.loc?.end.column!,
      line: node.loc?.end.line!,
    },
  };
};
