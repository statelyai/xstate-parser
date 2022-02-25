import { createMachine } from "xstate";

export const descriptionMachine = createMachine({
  initial: "wow",
  description: "hello!",
  states: {
    wow: {
      description: "WOWZA!",
    },
  },
});
