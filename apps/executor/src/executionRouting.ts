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
}) => args.runtimeCanUseAA && !isVaultModuleStrategy(args.strategyKey);

export const shouldUseAARuntimeForPlan = (args: {
  runtimeCanUseAA: boolean;
  protocolId: string | null | undefined;
}) => args.runtimeCanUseAA && !isVaultModuleProtocol(args.protocolId);
