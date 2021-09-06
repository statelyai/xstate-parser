import { StringLiteral, TemplateLiteral } from "./scalars";
import * as t from "@babel/types";
import { createParser, objectTypeWithKnownKeys, unionType } from "./utils";

export const MetaDescription = unionType([StringLiteral, TemplateLiteral]);

export const StateMeta = objectTypeWithKnownKeys({
  description: MetaDescription,
});
