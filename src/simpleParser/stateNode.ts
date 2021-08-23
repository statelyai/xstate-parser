import { MaybeArrayOfActions } from "./actions";
import { History } from "./history";
import { Invoke } from "./invoke";
import { StringLiteral } from "./scalars";
import { MaybeTransitionArray } from "./transitions";
import { AnyParser } from "./types";
import {
  GetParserResult,
  maybeArrayOf,
  objectOf,
  ObjectOfReturn,
  objectTypeWithKnownKeys,
} from "./utils";

const On = objectOf(MaybeTransitionArray);

const After = objectOf(MaybeTransitionArray);
const Tags = maybeArrayOf(StringLiteral);

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
  onDone?: GetParserResult<typeof MaybeTransitionArray>;
  on?: GetParserResult<typeof On>;
  after?: GetParserResult<typeof After>;
  history?: GetParserResult<typeof History>;
  tags?: GetParserResult<typeof Tags>;
  states?: GetParserResult<AnyParser<ObjectOfReturn<StateNodeReturn>>>;
};

export const StateNode: AnyParser<StateNodeReturn> = objectTypeWithKnownKeys(
  () => ({
    id: StringLiteral,
    initial: StringLiteral,
    type: StringLiteral,
    history: History,
    delimiter: StringLiteral,
    entry: MaybeArrayOfActions,
    exit: MaybeArrayOfActions,
    onEntry: MaybeArrayOfActions,
    onExit: MaybeArrayOfActions,
    invoke: Invoke,
    always: MaybeTransitionArray,
    onDone: MaybeTransitionArray,
    after: After,
    on: On,
    tags: Tags,
    states: objectOf(StateNode),
  }),
);
