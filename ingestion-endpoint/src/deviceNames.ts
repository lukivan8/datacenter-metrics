const FIXED_ASSET_NAMES = [
  "CRAC A",
  "CRAC B",
  "CRAC C",
  "UPS A",
  "UPS B",
  "UPS C",
  "PDU Rack A1",
  "PDU Rack A2",
  "PDU Rack B1",
  "PDU Rack B2",
  "Rack A1",
  "Rack A2",
  "Rack A3",
  "Rack B1",
  "Rack B2",
  "Leaf Switch A",
  "Leaf Switch B",
  "Core Switch A",
  "Core Switch B",
  "Battery Bank A",
  "Battery Bank B",
  "Generator A",
  "Generator B",
  "Chiller Loop A",
  "Chiller Loop B",
];

const ROWS = ["A", "B", "C", "D", "E", "F"];
const LETTERS = ["A", "B", "C", "D"];

function hashDeviceId(deviceId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < deviceId.length; index += 1) {
    hash ^= deviceId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function twoDigit(value: number): string {
  return value.toString().padStart(2, "0");
}

export function generateDeviceName(deviceId: string): string {
  const hash = hashDeviceId(deviceId);
  const variant = hash % 10;
  const row = ROWS[Math.floor(hash / 10) % ROWS.length];
  const letter = LETTERS[Math.floor(hash / 100) % LETTERS.length];
  const position = twoDigit((Math.floor(hash / 1_000) % 48) + 1);

  if (hash % 4 === 0) {
    return FIXED_ASSET_NAMES[Math.floor(hash / 10_000) % FIXED_ASSET_NAMES.length];
  }

  switch (variant) {
    case 0:
    case 1:
      return `Row ${row} Rack ${position}`;
    case 2:
      return `PDU Row ${row} Rack ${position}`;
    case 3:
      return `Leaf Switch ${letter}`;
    case 4:
      return `MDF Switch ${letter}`;
    case 5:
      return `UPS Room ${letter}`;
    case 6:
      return `Busway ${letter} Feed`;
    case 7:
      return `Cooling Plant ${letter}`;
    case 8:
      return `Battery Bank ${letter}`;
    default:
      return `Generator ${letter}`;
  }
}
