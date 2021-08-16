import * as t from "@babel/types";
import { ParseContext } from "./ParseContext";
import {
  BabelMatcher,
  GetChildren,
  GetMetaFromNode,
  ParserOptionalProps,
} from "./types";

export class Parser<T extends t.Node = t.Node> {
  name: string;
  private babelMatcher: BabelMatcher<T>;
  private getMetaFromNode?: GetMetaFromNode<T>;
  private getChildren?: GetChildren<T>;
  constructor(
    props: {
      name: string;
      babelMatcher: BabelMatcher<T>;
    } & ParserOptionalProps<T>,
  ) {
    this.name = props.name;
    this.babelMatcher = props.babelMatcher;
    this.getMetaFromNode = props.getMetaFromNode;
    this.getChildren = props.getChildren;
  }

  parse = (node: t.Node, context: ParseContext) => {
    this.parseNode(node, context);

    return context.getResult();
  };

  matches = (node: t.Node) => this.babelMatcher(node);

  private parseNode = (node: t.Node, context: ParseContext) => {
    // console.log(this.name, node);
    if (!this.babelMatcher(node)) return null;

    const parseChildren = (node: t.Node, parser: Parser) => {
      parser.parse(node, context);
    };

    this.getMetaFromNode?.(node, context, parseChildren);

    this.getChildren?.(parseChildren, node);
  };
}
