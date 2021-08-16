import * as t from "@babel/types";

export type Location = t.SourceLocation | null;

export interface Parser<T extends t.Node = any> {
  parse: (node: T) => ParserReturnType | undefined;
  matches: (node: T) => boolean;
}

export type ParserReturnTypeObject =
  | {
      type: "INITIAL";
      value: string;
      loc: Location;
    }
  | {
      type: "ID";
      value: string;
      loc: Location;
    }
  | {
      type: "KEY_OF_OBJECT";
      key: string;
      keyNode: t.Identifier;
      valueNode: t.Node;
    }
  | ActionEvent
  | {
      type: "ENTRY_ACTIONS";
      loc: Location;
      actions: ActionEvent[];
    }
  | {
      type: "EXIT_ACTIONS";
      loc: Location;
      actions: ActionEvent[];
    }
  | {
      type: "TRANSITION_ACTIONS";
      loc: Location;
      actions: ActionEvent[];
    }
  | StateNodeEvent
  | {
      type: "MACHINE_CALLEE";
      callee: t.Node;
      calleeName: string;
      definition: StateNodeEvent;
    }
  | {
      type: "ON_DECLARATION";
      loc: Location;
      transitions: EventFromType<"TRANSITION_ARRAY_DECLARATION">[];
    }
  | {
      type: "TRANSITION_ARRAY_DECLARATION";
      event: string;
      eventLoc: Location;
      transitions: EventFromType<"TRANSITION_TARGET">[];
    }
  | {
      type: "ALWAYS_DECLARATION";
      loc: Location;
      transitions: EventFromType<"TRANSITION_TARGET">[];
    }
  | {
      type: "TRANSITION_TARGET";
      loc: Location;
      target?: EventFromType<"TRANSITION_TARGET_LITERAL">;
      cond?: EventFromType<"COND">;
      actions?: EventFromType<"TRANSITION_ACTIONS">;
    }
  | {
      type: "TRANSITION_TARGET_LITERAL";
      target: string;
      loc: Location;
    }
  | {
      type: "COND";
      name: string;
      loc: Location;
    }
  | {
      type: "STATES";
      loc: Location;
      nodes: EventFromType<"CHILD_STATE">[];
    }
  | {
      type: "CHILD_STATE";
      key: string;
      keyLoc: Location;
      node: StateNodeEvent;
    };

export type StateNodeEvent = {
  type: "STATE_NODE";
  loc: Location;
  entryActions?: EventFromType<"ENTRY_ACTIONS">;
  exitActions?: EventFromType<"EXIT_ACTIONS">;
  states?: EventFromType<"STATES">;
  id?: EventFromType<"ID">;
  initial?: EventFromType<"INITIAL">;
  on?: EventFromType<"ON_DECLARATION">;
};

export type ActionEvent = {
  type: "ACTION";
  name: string;
  loc: Location;
};

export type EventFromType<Type extends ParserReturnTypeObject["type"]> =
  Extract<ParserReturnTypeObject, { type: Type }>;

export type ParserReturnType = ParserReturnTypeObject[];
