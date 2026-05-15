import type { ServerResponse } from "node:http";
import type { DeviceLatestRow } from "../types/dbTypes.js";

export type LiveTelemetryEvent = {
    deviceId: string;
    power: number;
    temperature: number;
    timestamp: string;
    receivedAt: string;
    status: DeviceLatestRow["status"];
};

type Client = {
    response: ServerResponse;
    heartbeat: NodeJS.Timeout;
};

export class LiveSubscriberRegistry {
    private subscribers = new Map<string, Set<Client>>();

    subscribe(deviceId: string, response: ServerResponse) {
        const client: Client = {
            response,
            heartbeat: setInterval(
                () => this.safeWrite(client, ": heartbeat\n\n"),
                20_000,
            ),
        };

        let clients = this.subscribers.get(deviceId);
        if (!clients) {
            clients = new Set();
            this.subscribers.set(deviceId, clients);
        }
        clients.add(client);

        this.safeWrite(
            client,
            'event: connected\ndata: {"connected":true}\n\n',
        );

        return () => this.unsubscribe(deviceId, client);
    }

    publish(row: DeviceLatestRow) {
        const clients = this.subscribers.get(row.device_id);
        if (!clients?.size) return;

        const event: LiveTelemetryEvent = {
            deviceId: row.device_id,
            power: Number(row.power),
            temperature: Number(row.temperature),
            timestamp: row.timestamp.toISOString(),
            receivedAt: row.received_at.toISOString(),
            status: row.status,
        };

        const payload = `data: ${JSON.stringify(event)}\n\n`;
        for (const client of [...clients])
            this.safeWrite(client, payload, row.device_id);
    }

    publishMany(rows: DeviceLatestRow[]) {
        for (const row of rows) this.publish(row);
    }

    private safeWrite(client: Client, chunk: string, deviceId?: string) {
        if (client.response.destroyed || client.response.writableEnded) {
            if (deviceId) this.unsubscribe(deviceId, client);
            return false;
        }

        try {
            client.response.write(chunk);
            return true;
        } catch {
            if (deviceId) this.unsubscribe(deviceId, client);
            return false;
        }
    }

    private unsubscribe(deviceId: string, client: Client) {
        clearInterval(client.heartbeat);
        const clients = this.subscribers.get(deviceId);
        if (!clients) return;
        clients.delete(client);
        if (clients.size === 0) this.subscribers.delete(deviceId);
    }
}
