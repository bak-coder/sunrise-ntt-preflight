import { CheckDefinition } from "../checks/types";
import { executorCapabilityStub } from "../checks/stubs/executorCapabilityStub";
import { configIntentSourceReadinessCheck } from "../checks/real/configIntentSourceReadiness";
import { nttIntentManagerProgramIdInvariantCheck } from "../checks/real/nttIntentManagerProgramIdInvariant";
import { nttPeerChainMappingPresenceCheck } from "../checks/real/nttPeerChainMappingPresence";
import { nttPeerMappingKeyShapeCheck } from "../checks/real/nttPeerMappingKeyShape";
import { nttPeerMappingEntryValueShapeCheck } from "../checks/real/nttPeerMappingEntryValueShape";
import { peerRegistrationSymmetryMockCheck } from "../checks/real/peerRegistrationSymmetryMock";
import { solanaRpcHealthReadinessCheck } from "../checks/real/solanaRpcHealthReadiness";

export type ProfileName = "ntt-generic" | "sunrise-executor";

const profileRegistry: Record<ProfileName, CheckDefinition[]> = {
  "ntt-generic": [
    configIntentSourceReadinessCheck,
    nttIntentManagerProgramIdInvariantCheck,
    nttPeerChainMappingPresenceCheck,
    nttPeerMappingKeyShapeCheck,
    nttPeerMappingEntryValueShapeCheck,
    peerRegistrationSymmetryMockCheck,
    solanaRpcHealthReadinessCheck
  ],
  "sunrise-executor": [
    configIntentSourceReadinessCheck,
    nttIntentManagerProgramIdInvariantCheck,
    nttPeerChainMappingPresenceCheck,
    nttPeerMappingKeyShapeCheck,
    nttPeerMappingEntryValueShapeCheck,
    peerRegistrationSymmetryMockCheck,
    solanaRpcHealthReadinessCheck,
    executorCapabilityStub
  ]
};

export function loadProfileChecks(profile: ProfileName): CheckDefinition[] {
  return profileRegistry[profile] ?? [];
}
