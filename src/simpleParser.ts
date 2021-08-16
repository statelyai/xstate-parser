import * as t from "@babel/types";
import { Location } from "./types";

interface SimpleParser<T extends t.Node, Result> {
  parse: (node: T) => Result | undefined;
  matches: (node: T) => boolean;
}

const simpleParser =
  <Props, T extends t.Node, Result>(params: {
    babelMatcher: (node: any) => node is T;
    parseNode: (node: T, props: Props) => Result | undefined;
  }) =>
  (props?: Props): SimpleParser<T, Result> => {
    const matches = (node: T) => {
      return params.babelMatcher(node);
    };
    const parse = (node: T): Result | undefined => {
      if (!matches(node)) return undefined;
      return params.parseNode(node, props as Props);
    };
    return {
      parse,
      matches,
    };
  };

const ActionAsIdentifier = simpleParser({
  babelMatcher: t.isIdentifier,
  parseNode: (node) => {
    return {
      name: node.name,
      loc: node.loc,
    };
  },
});

const ActionAsString = simpleParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node) => {
    return {
      name: node.value,
      loc: node.loc,
    };
  },
});

const unionType =
  <Props, Result>(parsers: ((props: Props) => SimpleParser<any, Result>)[]) =>
  (props: Props): SimpleParser<any, Result> => {
    const parsersWithProps = parsers.map((parser) => parser(props));
    const matches = (node: any) => {
      return parsersWithProps.some((parser) => parser.matches(node));
    };
    const parse = (node: any) => {
      const parser = parsersWithProps.find((parser) => parser.matches(node));
      return parser?.parse(node);
    };

    return {
      matches,
      parse,
    };
  };

const arrayOf = <Props, Result>(
  parser: (props: Props) => SimpleParser<any, Result>,
) => {
  return simpleParser({
    babelMatcher: t.isArrayExpression,
    parseNode: (node, props: Props) => {
      return node.elements.map((elem) => {
        return parser(props).parse(elem);
      });
    },
  });
};

const Action = unionType([ActionAsIdentifier, ActionAsString]);

const ArrayOfActions = (props: StateNodeChildrenProps) => {
  const parser = arrayOf(Action)();

  return {
    matches: parser.matches,
    parse: (node: any) => {
      const result = parser.parse(node);
    },
  };
};

const keysFromObject = simpleParser({
  babelMatcher: t.isObjectExpression,
  parseNode: (node, props) => {
    return node.properties.map((property) => {
      if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
        return {
          key: property.key.name,
          keyNode: property.key,
          valueNode: property.value,
        };
      }
    });
  },
});

const objectTypeWithKnownKeys = <Props, Result>(
  obj: Record<string, (props: Props) => SimpleParser<any, Result>>,
) =>
  simpleParser({
    babelMatcher: t.isObjectExpression,
    parseNode: (node, props: Props) => {
      const parser = keysFromObject({});

      const keys = parser.parse(node);

      keys?.forEach((keyResult) => {
        if (!keyResult) return;

        const getParser = obj[keyResult.key];

        getParser(props).parse(keyResult.valueNode);
      });
    },
  });

const StateNodeId = simpleParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node, props: StateNodeChildrenProps) => {
    props.reportId(node.value, node.loc);
  },
});

interface StateNodeChildrenProps {
  reportInitial: (value: string, loc: Location) => void;
  reportId: (value: string, loc: Location) => void;
}

const StateNodeInitial = simpleParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node, props: StateNodeChildrenProps) => {
    props.reportInitial(node.value, node.loc);
  },
});

const StateNode = objectTypeWithKnownKeys({
  id: StateNodeId,
  initial: StateNodeInitial,
  onEntry: ArrayOfActions,
});
