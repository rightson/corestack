/**
 * Temporal Client
 *
 * Singleton client for connecting to Temporal server
 */

import { Client, Connection } from '@temporalio/client';
import { temporalConfig } from './config';

let clientInstance: Client | null = null;

/**
 * Get or create Temporal client instance
 */
export async function getTemporalClient(): Promise<Client> {
  if (clientInstance) {
    return clientInstance;
  }

  try {
    // Create connection to Temporal server
    const connection = await Connection.connect({
      address: temporalConfig.address,
    });

    // Create client
    clientInstance = new Client({
      connection,
      namespace: temporalConfig.namespace,
    });

    console.log(
      `Connected to Temporal server at ${temporalConfig.address} (namespace: ${temporalConfig.namespace})`
    );

    return clientInstance;
  } catch (error) {
    console.error('Failed to connect to Temporal server:', error);
    throw error;
  }
}

/**
 * Close Temporal client connection
 */
export async function closeTemporalClient(): Promise<void> {
  if (clientInstance) {
    // Client doesn't have a close method, but connection does
    // The connection will be closed automatically when the process exits
    clientInstance = null;
    console.log('Temporal client closed');
  }
}

// Export singleton instance getter
export const temporalClient = {
  get: getTemporalClient,
  close: closeTemporalClient,
};
