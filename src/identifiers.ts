import traverse from "@babel/traverse";
import * as t from "@babel/types";
import { createParser } from "./createParser";
import { AnyParser } from "./types";
import { unionType } from "./unionType";

/**
 * Finds a declarator in the same file which corresponds
 * to an identifier of the name you provide
 */
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

/**
 * Used for when you expect an identifier to be used
 * which references a variable declaration of a certain type
 */
export const identifierReferencingVariableDeclaration = <Result>(
  parser: AnyParser<Result>,
) => {
  return createParser({
    babelMatcher: t.isIdentifier,
    parseNode: (node, context) => {
      const variableDeclarator = findVariableDeclaratorWithName(
        context.file,
        node.name,
      );

      return parser.parse(variableDeclarator?.init, context);
    },
  });
};

export const maybeIdentifierTo = <Result>(parser: AnyParser<Result>) => {
  return unionType([parser, identifierReferencingVariableDeclaration(parser)]);
};
