/** Transmission channel a packet arrived on (triple-redundant uplink). */
export enum Channel {
  LORAWAN = 'lorawan',
  LTE = 'lte',
  BLE_MESH = 'ble_mesh',
}

/** Random Forest output classes. */
export enum RiskClass {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
}

/** Five-tier public alert scale. Order matters: index = severity. */
export enum AlertTier {
  SAFE = 'safe',
  ADVISORY = 'advisory',
  WATCH = 'watch',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum UserRole {
  CITIZEN = 'citizen',
  OFFICER = 'officer',
}

export enum NodeSource {
  SIMULATED = 'simulated',
  HARDWARE = 'hardware',
}
