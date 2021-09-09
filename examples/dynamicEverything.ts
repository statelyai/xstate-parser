import { createMachine } from "xstate";

const START_STATE = "first";
const OTHER_STATE = "second";
const COOL = "cool";

const states = {
  [START_STATE]: {},
  [OTHER_STATE]: {
    on: {
      [COOL]: {
        target: START_STATE,
      },
    },
  },
};

export const machine = createMachine({
  states,
});
