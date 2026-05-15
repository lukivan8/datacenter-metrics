import type { DeviceStatus } from "./dbTypes.js";

export type MetricInput = {
    deviceId: string;
    power: number;
    temperature: number;
    timestamp: string;
};

export type MetricRecord = MetricInput & {
    receivedAt: Date;
    status: DeviceStatus;
};
