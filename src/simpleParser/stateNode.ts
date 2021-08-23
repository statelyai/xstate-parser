import { MaybeArrayOfActions } from "./actions";
import { Invoke } from "./invoke";
import { StringLiteral } from "./scalars";
import { MaybeTransitionArray } from "./transitions";
import { AnyParser } from "./types";
import {
  objectOf,
  ObjectOfReturn,
  objectTypeWithKnownKeys,
  GetObjectKeysResult,
  GetParserResult,
} from "./utils";

const On = objectOf(MaybeTransitionArray);

/**
 * This is frustrating, but we need to keep this
 * up to date with the StateNode definition below.
 *
 * The reason? TS fails early when it hits a
 * recursive type definition, meaning our inference
 * falls out the window when StateNode tries to
 * reference itself
 */
export type StateNodeReturn = {
  id?: GetParserResult<typeof StringLiteral>;
  initial?: GetParserResult<typeof StringLiteral>;
  type?: GetParserResult<typeof StringLiteral>;
  delimiter?: GetParserResult<typeof StringLiteral>;
  entry?: GetParserResult<typeof MaybeArrayOfActions>;
  exit?: GetParserResult<typeof MaybeArrayOfActions>;
  onEntry?: GetParserResult<typeof MaybeArrayOfActions>;
  onExit?: GetParserResult<typeof MaybeArrayOfActions>;
  invoke?: GetParserResult<typeof Invoke>;
  always?: GetParserResult<typeof MaybeTransitionArray>;
  on?: GetParserResult<typeof On>;
  states?: GetParserResult<AnyParser<ObjectOfReturn<StateNodeReturn>>>;
};

export const StateNode: AnyParser<StateNodeReturn> = objectTypeWithKnownKeys(
  () => ({
    id: StringLiteral,
    initial: StringLiteral,
    type: StringLiteral,
    delimiter: StringLiteral,
    entry: MaybeArrayOfActions,
    exit: MaybeArrayOfActions,
    onEntry: MaybeArrayOfActions,
    onExit: MaybeArrayOfActions,
    invoke: Invoke,
    always: MaybeTransitionArray,
    on: objectOf(MaybeTransitionArray),
    states: objectOf(StateNode),
  }),
);
