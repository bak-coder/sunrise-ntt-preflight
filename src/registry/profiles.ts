import { CheckDefinition } from "../checks/types";
import { executorCapabilityStub } from "../checks/stubs/executorCapabilityStub";
import { configIntentSourceReadinessCheck } from "../checks/real/configIntentSourceReadiness";
import { nttIntentManagerProgramIdInvariantCheck } from "../checks/real/nttIntentManagerProgramIdInvariant";
import { nttPeerChainMappingPresenceCheck } from "../checks/real/nttPeerChainMappingPresence";
import { solanaRpcHealthReadinessCheck } from "../checks/real/solanaRpcHealthReadiness";

export type ProfileName = "ntt-generic" | "sunrise-executor";

const profileRegistry: Record<ProfileName, CheckDefinition[]> = {
  "ntt-generic": [
    configIntentSourceReadinessCheck,
    nttIntentManagerProgramIdInvariantCheck,
    nttPeerChainMappingPresenceCheck,
    solanaRpcHealthReadinessCheck
  ],
  "sunrise-executor": [
    configIntentSourceReadinessCheck,
    nttIntentManagerProgramIdInvariantCheck,
    nttPeerChainMappingPresenceCheck,
    solanaRpcHealthReadinessCheck,
    executorCapabilityStub
  ]
};

export function loadProfileChecks(profile: ProfileName): CheckDefinition[] {
  return profileRegistry[profile] ?? [];
}
