import { createMachine } from "xstate";

const states = {
  first: "FIRST",
  second: "SECOND",
  third: {
    fourth: "FOURTH",
  },
};

const dynamic = createMachine({
  initial: states.first,
  states: {
    [states.first]: {
      on: {},
    },
    [states.third.fourth]: {},
  },
});
