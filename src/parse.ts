import * as t from "@babel/types";
import { ParseContext } from "./ParseContext";
import { Parser } from "./Parser";
import { ParseResult } from "./types";

export const parse = (node: t.Node, parser: Parser<any>): ParseResult => {
  const context = new ParseContext();
  return parser.parse(node, context);
};
