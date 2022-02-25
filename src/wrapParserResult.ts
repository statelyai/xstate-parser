import * as t from '@babel/types';
import { AnyParser } from './types';

/**
 * Allows you to wrap a parser and reformulate
 * the result at the end of it
 */
export const wrapParserResult = <T extends t.Node, Result, NewResult>(
  parser: AnyParser<Result>,
  changeResult: (result: Result, node: T) => NewResult | undefined
): AnyParser<NewResult> => {
  return {
    matches: parser.matches,
    parse: (node: any, context) => {
      const result = parser.parse(node, context);
      if (!result) return undefined;
      return changeResult(result, node);
    }
  };
};
