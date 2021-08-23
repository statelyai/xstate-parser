import * as t from "@babel/types";

export type Location = t.SourceLocation | null;

export interface StringLiteralNode {
  value: string;
  node: t.Node;
}

export interface Parser<T extends t.Node = any, Result = any> {
  parse: (node: t.Node) => Result | undefined;
  matches: (node: T) => boolean;
}

export interface AnyParser<Result> {
  parse: (node: any) => Result | undefined;
  matches: (node: any) => boolean;
}
