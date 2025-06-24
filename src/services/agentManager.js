/**
 * Shared ManimAgent instance to avoid multiple instantiations
 * and maintain session state across requests
 */

import ManimAgent from '../services/manimAgent.js';

// Singleton instance
let manimAgentInstance = null;

/**
 * Get or create the shared ManimAgent instance
 */
export function getManimAgent() {
  if (!manimAgentInstance) {
    manimAgentInstance = new ManimAgent();
    console.log('Created shared ManimAgent instance');
  }
  return manimAgentInstance;
}

/**
 * Reset the shared instance (useful for testing)
 */
export function resetManimAgent() {
  manimAgentInstance = null;
  console.log('Reset ManimAgent instance');
}

/**
 * Get instance info for monitoring
 */
export function getAgentInfo() {
  if (!manimAgentInstance) {
    return { exists: false };
  }
  
  return {
    exists: true,
    activeSessions: manimAgentInstance.getActiveSessions().length,
    maxSessions: manimAgentInstance.maxSessions
  };
}
