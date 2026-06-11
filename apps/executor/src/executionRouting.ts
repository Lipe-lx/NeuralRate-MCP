import { strategyRegistry } from "./executionRegistry.js";

export const isVaultModuleProtocol = (protocolId: string | null | undefined) =>
  protocolId?.trim().toLowerCase() === "neuralrate-vault-module";

export const isVaultModuleStrategy = (strategyKey: string | null | undefined) =>
  strategyKey
    ? strategyRegistry[strategyKey]?.supportedProtocols.includes("neuralrate-vault-module") === true
    : false;

export const shouldUseAARuntimeForStrategy = (args: {
  runtimeCanUseAA: boolean;
  strategyKey: string | null | undefined;
  paymasterConfigured?: boolean;
}) => {
  void args.strategyKey;
  void args.paymasterConfigured;
  return args.runtimeCanUseAA;
};

export const shouldUseAARuntimeForPlan = (args: {
  runtimeCanUseAA: boolean;
  protocolId: string | null | undefined;
  paymasterConfigured?: boolean;
}) => {
  void args.protocolId;
  void args.paymasterConfigured;
  return args.runtimeCanUseAA;
};
