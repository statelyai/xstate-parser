export type BabelMatcher<T extends t.Node> = (node: any) => node is T;
import * as t from "@babel/types";
import { ParseContext } from "./ParseContext";
import { Parser } from "./Parser";

export interface MachineMeta extends StateMeta {
  callee?: {
    name: string;
    loc: t.SourceLocation | null;
  };
}

export interface StateMeta {
  id?: {
    value: string;
    loc: t.SourceLocation | null;
  };
  key?: string;
  keyNode?: {
    loc: t.SourceLocation | null;
  };
  valueNode?: {
    loc: t.SourceLocation | null;
  };
  initial?: {
    value: string;
    loc: t.SourceLocation | null;
  };
  states: Record<string, StateMeta>;
  type?: {
    value: string;
    loc: t.SourceLocation | null;
  };
}

export type GetMetaFromNode<T extends t.Node> = (
  node: T,
  context: ParseContext,
  parse: (node: t.Node, parser: Parser<any>) => void,
) => void;

export type GetChildren<T extends t.Node> = (
  parse: (node: t.Node, parser: Parser<any>) => void,
  node: T,
) => void;

export type ParseResult = Record<string, MachineMeta>;

export interface ParserOptionalProps<T extends t.Node> {
  getMetaFromNode?: GetMetaFromNode<T>;
  getChildren?: GetChildren<T>;
}
