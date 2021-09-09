import { AnyParser, ParserContext } from ".";

/**
 * Used to declare when a type can be either one
 * thing or another. Each parser added must
 * return the same result
 */
export const unionType = <Result>(
  parsers: AnyParser<Result>[],
): AnyParser<Result> => {
  const matches = (node: any) => {
    return parsers.some((parser) => parser.matches(node));
  };
  const parse = (node: any, context: ParserContext): Result | undefined => {
    const parser = parsers.find((parser) => parser.matches(node));
    return parser?.parse(node, context);
  };

  return {
    matches,
    parse,
  };
};
