import { Action, Condition } from 'xstate';
import * as t from '@babel/types';
import { TMachineCallExpression } from './machineCallExpression';
import { StateNodeReturn } from './stateNode';
import { toMachineConfig } from './toMachineConfig';
import { StringLiteralNode, Comment } from './types';
import { TransitionConfigNode } from './transitions';
import { ActionNode, ParsedChooseCondition } from './actions';
import type { Scope } from '@babel/traverse';
import { DeclarationType, INLINE_IMPLEMENTATION_TYPE } from '.';
import { RecordOfArrays } from './RecordOfArrays';

export interface MachineParseResultStateNode {
  path: string[];
  ast: StateNodeReturn;
}

/**
 * Matches '@xstate-layout awdh123jbawdjhbawd'
 */
const layoutRegex = /@xstate-layout [^\s]{1,}/;

const getLayoutString = (commentString: string): string | undefined => {
  const result = commentString.match(layoutRegex)?.[0];

  return result?.slice(`@xstate-layout `.length);
};

/**
 * Gives some helpers to the user of the lib
 */
export class MachineParseResult {
  ast: TMachineCallExpression;
  public fileComments: Comment[];
  private stateNodes: MachineParseResultStateNode[];
  public scope: Scope;

  constructor(props: {
    ast: TMachineCallExpression;
    fileComments: Comment[];
    scope: Scope;
  }) {
    this.ast = props.ast;
    this.fileComments = props.fileComments;
    this.scope = props.scope;

    this.stateNodes = this._getAllStateNodes();
  }

  private _getAllStateNodes = (): MachineParseResultStateNode[] => {
    if (!this.ast?.definition) return [];
    const nodes: MachineParseResultStateNode[] = [];

    const getSubNodes = (
      definition: StateNodeReturn | undefined,
      path: string[]
    ) => {
      if (definition) {
        nodes.push({
          ast: definition,
          path
        });
      }

      definition?.states?.properties.forEach((stateNode) => {
        getSubNodes(stateNode.result, [...path, stateNode.key]);
      });
    };

    getSubNodes(this.ast?.definition, []);

    return nodes;
  };

  getIsIgnored = () => {
    if (!this.ast?.callee?.loc) return false;
    const isIgnored = this.fileComments.some((comment) => {
      if (comment.type !== 'xstate-ignore-next-line') return false;

      return comment.node.loc.end.line === this.ast!.callee.loc!.start.line - 1;
    });

    return isIgnored;
  };

  /**
   * Returns the raw value of a comment marked with @xstate-layout.
   *
   * For instance: '@xstate-layout 1234' will return '1234'
   */
  getLayoutComment = (): { value: string; comment: Comment } | undefined => {
    if (!this.ast?.callee?.loc) return undefined;
    const layoutComment = this.fileComments.find((comment) => {
      if (comment.type !== 'xstate-layout') return false;

      return comment.node.loc.end.line === this.ast!.callee.loc!.start.line - 1;
    });

    if (!layoutComment) return undefined;

    const comment = layoutComment?.node.value || '';

    const value = getLayoutString(comment);

    if (!value) return undefined;

    return { comment: layoutComment, value };
  };

  getTransitions = () => {
    const targets: { config: TransitionConfigNode; fromPath: string[] }[] = [];

    this.stateNodes.forEach((stateNode) => {
      stateNode.ast.on?.properties.forEach((on) => {
        on.result.forEach((transition) => {
          targets.push({
            config: transition,
            fromPath: stateNode.path
          });
        });
      });
      stateNode.ast.after?.properties.forEach((after) => {
        after.result.forEach((transition) => {
          targets.push({
            config: transition,
            fromPath: stateNode.path
          });
        });
      });
      stateNode.ast.onDone?.forEach((transition) => {
        targets.push({
          config: transition,
          fromPath: stateNode.path
        });
      });
      stateNode.ast.invoke?.forEach((invoke) => {
        invoke.onDone?.forEach((transition) => {
          targets.push({
            config: transition,
            fromPath: stateNode.path
          });
        });
        invoke.onError?.forEach((transition) => {
          targets.push({
            config: transition,
            fromPath: stateNode.path
          });
        });
      });
      stateNode.ast.always?.forEach((transition) => {
        targets.push({
          config: transition,
          fromPath: stateNode.path
        });
      });
    });

    return targets;
  };

  getTransitionTargets = () => {
    return this.getTransitions()
      .map((transition) => ({
        target: transition.config?.target,
        fromPath: transition.fromPath
      }))
      .filter((transition) => Boolean(transition.target)) as {
      fromPath: string[];
      target: StringLiteralNode[];
    }[];
  };

  getStateNodeByPath = (path: string[]) => {
    return this.stateNodes.find((node) => {
      return node.path.join('') === path.join('');
    });
  };

  getAllStateNodes = () => this.stateNodes;

  toConfig = () => {
    return toMachineConfig(this.ast);
  };

  getAllConds = (
    declarationTypes: DeclarationType[] = [
      'identifier',
      'inline',
      'unknown',
      'named'
    ]
  ) => {
    const conds: {
      node: t.Node;
      cond: Condition<any, any>;
      statePath: string[];
      name: string;
    }[] = [];

    this.getTransitions().forEach((transition) => {
      if (
        transition.config.cond?.declarationType &&
        declarationTypes.includes(transition.config.cond?.declarationType)
      ) {
        conds.push({
          name: transition.config.cond.name,
          node: transition.config.cond.node,
          cond: transition.config.cond.cond,
          statePath: transition.fromPath
        });
      }
    });

    this._getAllActions().forEach((action) => {
      action.node.chooseConditions?.forEach((chooseCondition) => {
        if (
          chooseCondition.conditionNode?.declarationType &&
          declarationTypes.includes(
            chooseCondition.conditionNode?.declarationType
          )
        ) {
          conds.push({
            name: chooseCondition.conditionNode.name,
            node: chooseCondition.conditionNode.node,
            cond: chooseCondition.conditionNode.cond,
            statePath: action.statePath
          });
        }
      });
    });

    return conds;
  };

  private _getAllActions = () => {
    const actions: {
      node: ActionNode;
      statePath: string[];
    }[] = [];

    const addAction = (action: ActionNode, statePath: string[]) => {
      actions.push({
        node: action,
        statePath
      });

      action.chooseConditions?.forEach((chooseCondition) => {
        chooseCondition.actionNodes.forEach((action) => {
          addAction(action, statePath);
        });
      });
    };

    this.getTransitions().forEach((transition) => {
      transition.config?.actions?.forEach((action) =>
        addAction(action, transition.fromPath)
      );
    });

    this.getAllStateNodes().forEach((node) => {
      node.ast.entry?.forEach((action) => {
        addAction(action, node.path);
      });
      node.ast.onEntry?.forEach((action) => {
        addAction(action, node.path);
      });
      node.ast.exit?.forEach((action) => {
        addAction(action, node.path);
      });
      node.ast.onExit?.forEach((action) => {
        addAction(action, node.path);
      });
    });

    return actions;
  };

  getAllActions = (
    declarationTypes: DeclarationType[] = [
      'identifier',
      'inline',
      'unknown',
      'named'
    ]
  ) => {
    const actions: {
      node: t.Node;
      action: Action<any, any>;
      statePath: string[];
      chooseConditions?: ParsedChooseCondition[];
      name: string;
    }[] = [];

    const addActionIfHasName = (action: ActionNode, statePath: string[]) => {
      if (action && declarationTypes.includes(action.declarationType)) {
        actions.push({
          name: action.name,
          node: action.node,
          action: action.action,
          statePath,
          chooseConditions: action.chooseConditions
        });
      }
    };

    this._getAllActions().forEach((action) => {
      addActionIfHasName(action.node, action.statePath);
    });

    return actions;
  };

  getAllServices = (
    declarationTypes: DeclarationType[] = [
      'identifier',
      'inline',
      'unknown',
      'named'
    ]
  ) => {
    const services: {
      node: t.Node;
      src: string;
      id: string | undefined;
      statePath: string[];
      srcNode?: t.Node;
    }[] = [];

    this.stateNodes.map((stateNode) => {
      stateNode.ast.invoke?.forEach((invoke) => {
        const invokeSrc =
          typeof invoke.src?.value === 'string' ? invoke.src.value : undefined;
        if (
          invoke.src?.declarationType &&
          declarationTypes.includes(invoke.src?.declarationType)
        ) {
          services.push({
            src: invokeSrc ?? INLINE_IMPLEMENTATION_TYPE,
            id: invoke.id?.value,
            node: invoke.node,
            statePath: stateNode.path,
            srcNode: invoke.src?.node
          });
        }
      });
    });

    return services;
  };

  getAllNamedDelays = () => {
    const delays = new RecordOfArrays<{
      node: t.Node;
      name: string;
      statePath: string[];
    }>();

    this.stateNodes.map((stateNode) => {
      stateNode.ast.after?.properties.forEach((property) => {
        if (t.isIdentifier(property.keyNode)) {
          const key = property.key;

          delays.add(key, {
            node: property.keyNode,
            name: key,
            statePath: stateNode.path
          });
        }
      });
    });

    return delays.toObject();
  };

  getActionImplementation = (name: string) => {
    const node = this.ast?.options?.actions?.properties.find((property) => {
      return property.key === name;
    });

    return node;
  };

  getServiceImplementation = (name: string) => {
    const node = this.ast?.options?.services?.properties.find((property) => {
      return property.key === name;
    });

    return node;
  };

  getGuardImplementation = (name: string) => {
    const node = this.ast?.options?.guards?.properties.find((property) => {
      return property.key === name;
    });

    return node;
  };
}
