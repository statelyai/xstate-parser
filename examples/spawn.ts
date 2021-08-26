import { createMachine, spawn, assign } from "xstate";

const childMachine = createMachine({});

const parentMachine = createMachine({
  entry: [
    assign((context, event) => {
      return {
        wow: spawn(childMachine),
      };
    }),
  ],
});
