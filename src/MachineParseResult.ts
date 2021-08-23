import { TMachineCallExpression } from "./machineCallExpression";
import { StateNodeReturn } from "./stateNode";
import { toMachineConfig } from "./toMachineConfig";
import { StringLiteralNode } from "./types";

/**
 * Gives some helpers to the user of the lib
 */
export class MachineParseResult {
  ast: TMachineCallExpression;
  private stateNodes: { path: string[]; ast: StateNodeReturn }[];

  constructor(props: { ast: TMachineCallExpression }) {
    this.ast = props.ast;

    this.stateNodes = this._getAllStateNodes();
  }

  private _getAllStateNodes = (): {
    path: string[];
    ast: StateNodeReturn;
  }[] => {
    if (!this.ast?.definition) return [];
    const nodes = [] as { path: string[]; ast: StateNodeReturn }[];

    const getSubNodes = (
      definition: StateNodeReturn | undefined,
      path: string[],
    ) => {
      if (definition) {
        nodes.push({
          ast: definition,
          path,
        });
      }
      definition?.states?.properties.forEach((stateNode) => {
        getSubNodes(stateNode.result, [...path, stateNode.key]);
      });
    };

    getSubNodes(this.ast?.definition, []);

    return nodes;
  };

  getTransitionTargets = () => {
    const targets: { target: StringLiteralNode; fromPath: string[] }[] = [];

    this.stateNodes.forEach((stateNode) => {
      stateNode.ast.on?.properties.forEach((on) => {
        on.result.forEach((transition) => {
          if (transition.target?.node) {
            targets.push({
              target: transition.target,
              fromPath: stateNode.path,
            });
          }
        });
      });
      stateNode.ast.onDone?.forEach((transition) => {
        if (transition.target?.node) {
          targets.push({
            target: transition.target,
            fromPath: stateNode.path,
          });
        }
      });
      stateNode.ast.invoke?.forEach((invoke) => {
        invoke.onDone?.forEach((transition) => {
          if (transition.target?.node) {
            targets.push({
              target: transition.target,
              fromPath: stateNode.path,
            });
          }
        });
        invoke.onError?.forEach((transition) => {
          if (transition.target?.node) {
            targets.push({
              target: transition.target,
              fromPath: stateNode.path,
            });
          }
        });
      });
      stateNode.ast.always?.forEach((transition) => {
        if (transition.target?.node) {
          targets.push({
            target: transition.target,
            fromPath: stateNode.path,
          });
        }
      });
    });

    return targets;
  };

  getStateNodeByPath = (path: string[]) => {
    return this.stateNodes.find((node) => {
      return node.path.join("") === path.join("");
    });
  };

  getAllStateNodes = () => this.stateNodes;

  toConfig = () => {
    return toMachineConfig(this.ast);
  };
}
