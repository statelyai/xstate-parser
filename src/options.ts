import { AnyNode, BooleanLiteral } from "./scalars";
import { objectOf, objectTypeWithKnownKeys } from "./utils";

export const MachineOptions = objectTypeWithKnownKeys({
  actions: objectOf(AnyNode),
  services: objectOf(AnyNode),
  guards: objectOf(AnyNode),
  devTools: BooleanLiteral,
});
