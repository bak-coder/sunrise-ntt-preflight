import { CheckDefinition } from "../checks/types";
import { configIntentSourceReadinessCheck } from "../checks/real/configIntentSourceReadiness";
import { nttIntentManagerProgramIdInvariantCheck } from "../checks/real/nttIntentManagerProgramIdInvariant";
import { nttPeerChainMappingPresenceCheck } from "../checks/real/nttPeerChainMappingPresence";
import { nttPeerMappingKeyShapeCheck } from "../checks/real/nttPeerMappingKeyShape";
import { nttPeerMappingEntryValueShapeCheck } from "../checks/real/nttPeerMappingEntryValueShape";
import { peerRegistrationSymmetryMockCheck } from "../checks/real/peerRegistrationSymmetryMock";
import { decimalsSyncMockCheck } from "../checks/real/decimalsSyncMock";
import { solanaRpcHealthReadinessCheck } from "../checks/real/solanaRpcHealthReadiness";
import { executorEndpointReachabilityCheck } from "../checks/real/executorEndpointReachability";
import { executorRelayCapabilitiesCheck } from "../checks/real/executorRelayCapabilities";
import { executorTransceiverConfigPresenceCheck } from "../checks/real/executorTransceiverConfigPresence";
import { executorQuoteSanityCheck } from "../checks/real/executorQuoteSanity";
import { computeBudgetSanityCheck } from "../checks/real/computeBudgetSanity";

export type ProfileName = "ntt-generic" | "sunrise-executor";

const profileRegistry: Record<ProfileName, CheckDefinition[]> = {
  "ntt-generic": [
    configIntentSourceReadinessCheck,
    nttIntentManagerProgramIdInvariantCheck,
    nttPeerChainMappingPresenceCheck,
    nttPeerMappingKeyShapeCheck,
    nttPeerMappingEntryValueShapeCheck,
    peerRegistrationSymmetryMockCheck,
    decimalsSyncMockCheck,
    solanaRpcHealthReadinessCheck
  ],
  "sunrise-executor": [
    configIntentSourceReadinessCheck,
    nttIntentManagerProgramIdInvariantCheck,
    nttPeerChainMappingPresenceCheck,
    nttPeerMappingKeyShapeCheck,
    nttPeerMappingEntryValueShapeCheck,
    executorTransceiverConfigPresenceCheck,
    peerRegistrationSymmetryMockCheck,
    decimalsSyncMockCheck,
    solanaRpcHealthReadinessCheck,
    executorEndpointReachabilityCheck,
    executorRelayCapabilitiesCheck,
    executorQuoteSanityCheck,
    computeBudgetSanityCheck
  ]
};

export function loadProfileChecks(profile: ProfileName): CheckDefinition[] {
  return profileRegistry[profile] ?? [];
}
