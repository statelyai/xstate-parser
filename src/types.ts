export type BabelMatcher<T extends t.Node> = (node: any) => node is T;
import * as t from "@babel/types";
import { MachineConfig } from "xstate";
import { ParseContext } from "./ParseContext";
import { Parser } from "./Parser";

export type Location = t.SourceLocation | null;

export interface MachineMeta extends StateMeta {
  callee?: {
    name: string;
    loc: Location;
  };
}

export interface StateMeta {
  id?: {
    value: string;
    loc: Location;
  };
  key?: string;
  keyNode?: {
    loc: Location;
  };
  valueNode?: {
    loc: Location;
  };
  initial?: {
    value: string;
    loc: Location;
  };
  states: Record<string, StateMeta>;
  type?: {
    value: string;
    loc: Location;
  };
  invokes: {
    loc: Location;
    src?: {
      loc: Location;
      value: string;
    };
    id?: {
      loc: Location;
      value: string;
    };
  }[];
  transitions: Record<
    string,
    {
      keyLoc: Location;
      valueLoc: Location;
      targets: { target: string }[];
    }
  >;
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

export type ParseResult = Record<
  string,
  { meta: MachineMeta; config: MachineConfig<any, any, any> }
>;

export interface ParserOptionalProps<T extends t.Node> {
  getMetaFromNode?: GetMetaFromNode<T>;
  getChildren?: GetChildren<T>;
}
