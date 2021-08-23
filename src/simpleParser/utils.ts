import * as t from "@babel/types";
import { MachineConfig, StateNode, StateNodeConfig } from "xstate";
import {
  Parser,
  ParserReturnType,
  ParserReturnTypeObject,
  StateNodeEvent,
} from "./types";

export const unionType = (parsers: Parser<any>[]) => {
  const matches = (node: any) => {
    return parsers.some((parser) => parser.matches(node));
  };
  const parse = (node: any) => {
    const parser = parsers.find((parser) => parser.matches(node));
    return parser?.parse(node);
  };

  return {
    matches,
    parse,
  };
};

export const wrapParserResult = <T extends t.Node>(
  parser: Parser,
  changeResult: (result: ParserReturnType, node: T) => ParserReturnType,
): Parser => {
  return {
    matches: parser.matches,
    parse: (node: T) => {
      const result = parser.parse(node);
      if (!result) return result;
      return changeResult(result, node);
    },
  };
};

export const createParser = <T extends t.Node>(params: {
  babelMatcher: (node: any) => node is T;
  parseNode: (node: T) => ParserReturnType | undefined;
}): Parser<T> => {
  const matches = (node: T) => {
    return params.babelMatcher(node);
  };
  const parse = (node: T): ParserReturnType | undefined => {
    if (!matches(node)) return undefined;
    return params.parseNode(node);
  };
  return {
    parse,
    matches,
  };
};

export const arrayOf = (parser: Parser<any>) => {
  return createParser({
    babelMatcher: t.isArrayExpression,
    parseNode: (node) => {
      const toReturn: ParserReturnType = [];
      node.elements.map((elem) => {
        toReturn.push(...(parser.parse(elem) || []));
      });

      return toReturn;
    },
  });
};

export const objectTypeWithUnknownKeys = createParser({
  babelMatcher: t.isObjectExpression,
  parseNode: (node) => {
    const toReturn: ParserReturnType = [];
    node.properties.forEach((property) => {
      if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
        toReturn.push({
          type: "KEY_OF_OBJECT",
          key: property.key.name,
          keyNode: property.key,
          valueNode: property.value,
        });
      }
    });
    return toReturn;
  },
});

export const objectTypeWithKnownKeys = (obj: Record<string, Parser<any>>) =>
  createParser({
    babelMatcher: t.isObjectExpression,
    parseNode: (node) => {
      const keys = objectTypeWithUnknownKeys.parse(node);

      const toReturn: ParserReturnType = [];

      keys?.forEach((keyResult) => {
        if (keyResult.type !== "KEY_OF_OBJECT") return;

        const parser = obj[keyResult.key];

        if (!parser) return;

        const result = parser.parse(keyResult.valueNode);
        toReturn.push(...(result || []));
      });

      return toReturn;
    },
  });

const filterByEventType = <Type extends ParserReturnTypeObject["type"]>(
  type: Type,
  array: ParserReturnType | undefined,
): Extract<ParserReturnTypeObject, { type: Type }>[] => {
  return (array || []).filter((e) => e.type === type) as any;
};

const getFirstEventOfType = <Type extends ParserReturnTypeObject["type"]>(
  type: Type,
  array: ParserReturnType | undefined,
): Extract<ParserReturnTypeObject, { type: Type }> => {
  return filterByEventType(type, array)[0];
};

const some = <Type extends ParserReturnTypeObject["type"]>(
  type: Type,
  array: ParserReturnType | undefined,
): boolean => {
  return Boolean(filterByEventType(type, array)[0]);
};

export const eventUtils = {
  find: getFirstEventOfType,
  filter: filterByEventType,
  some,
};

export const eventsToMachineConfigs = (
  events: ParserReturnType,
): StateNodeConfig<any, any, any>[] => {
  const machineCallees = eventUtils.filter("MACHINE_CALLEE", events);

  return machineCallees.map(({ definition }) => {
    return stateNodeMetaToConfig(definition);
  });
};

export const stateNodeMetaToConfig = (
  definition: StateNodeEvent,
): StateNodeConfig<any, any, any> => {
  const config: StateNodeConfig<any, any, any> = {};

  if (definition.id) {
    config.id = definition.id.value;
  }

  if (definition.always) {
    config.always = definition.always.transitions.map(
      ({ target, cond, actions }) => {
        return {
          target: target?.target,
          cond: cond?.name,
          actions: actions?.actions?.map((action) => action.name),
        };
      },
    );
  }

  if (definition.initial) {
    config.initial = definition.initial.value;
  }

  if (definition.entryActions) {
    config.entry = definition.entryActions.actions.map((action) => {
      return action.name;
    });
  }

  if (definition.exitActions) {
    config.exit = definition.exitActions.actions.map((action) => {
      return action.name;
    });
  }

  if (definition.states) {
    config.states = {};

    definition.states.nodes.forEach((node) => {
      (config.states as any)[node.key] = stateNodeMetaToConfig(node.node);
    });
  }

  if (definition.invoke) {
    config.invoke = definition.invoke.services.map((service) => {
      return {
        src: service.src?.value!,
        id: service.id?.value,
        onDone: service.onDone?.transitions.map(({ target, cond, actions }) => {
          return {
            target: target?.target,
            cond: cond?.name,
            actions: actions?.actions?.map((action) => action.name),
          };
        }),
        onError: service.onError?.transitions.map(
          ({ target, cond, actions }) => {
            return {
              target: target?.target,
              cond: cond?.name,
              actions: actions?.actions?.map((action) => action.name),
            };
          },
        ),
      };
    });
  }

  if (definition.on) {
    config.on = {};

    definition.on.transitions.forEach((transition) => {
      (config.on as any)[transition.event] = transition.transitions.map(
        ({ target, cond, actions }) => {
          return {
            target: target?.target,
            cond: cond?.name,
            actions: actions?.actions?.map((action) => action.name),
          };
        },
      );
    });
  }

  return config;
};
