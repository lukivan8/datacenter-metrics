import type {
    DeviceListItemRow,
    DeviceListSummaryRow,
    DeviceListTotalRow,
    DeviceStatus,
    TypedQueryConfig,
} from "../types/dbTypes.js";

export const deviceListSortColumns = {
    id: "d.id",
    power: "dl.power",
    temperature: "dl.temperature",
    timestamp: "dl.timestamp",
    status: "dl.status",
} as const;

export type DeviceListSortColumn = keyof typeof deviceListSortColumns;
export type DeviceListSortDirection = "asc" | "desc";
export type DeviceListStatus = DeviceStatus;
export type DeviceListFilterValues =
    | [string]
    | [DeviceStatus]
    | [string, DeviceStatus]
    | [];

export type DeviceListQueryOptions = {
    search?: string;
    status?: DeviceListStatus;
    page: number;
    pageSize: number;
    sortBy: DeviceListSortColumn;
    sortDir: DeviceListSortDirection;
};

function buildDeviceListFilters(
    search?: string,
    status?: DeviceListStatus,
): { whereSql: string; values: DeviceListFilterValues } {
    const where: string[] = [];
    const values: unknown[] = [];

    if (search) {
        values.push(`%${search}%`);
        where.push(
            `(d.id ilike $${values.length} or d.name ilike $${values.length})`,
        );
    }

    if (status) {
        values.push(status);
        where.push(`dl.status = $${values.length}`);
    }

    return {
        whereSql: where.length ? `where ${where.join(" and ")}` : "",
        values: values as DeviceListFilterValues,
    };
}

export function getDeviceListSummaryQuery(
    options: Pick<DeviceListQueryOptions, "search" | "status">,
): TypedQueryConfig<DeviceListSummaryRow, DeviceListFilterValues> {
    const { whereSql, values } = buildDeviceListFilters(
        options.search,
        options.status,
    );

    return {
        text: `
      select count(*)::int as total_devices,
        count(dl.device_id)::int as online_devices,
        count(*) filter (where dl.status = 'warning')::int as warning_devices,
        count(*) filter (where dl.status = 'critical')::int as critical_devices,
        avg(dl.power) as avg_power,
        avg(dl.temperature) as avg_temperature,
        coalesce(sum(dl.power), 0) as total_power
      from devices d left join device_latest dl on dl.device_id = d.id ${whereSql}`,
        values,
    };
}

export function getDeviceListTotalQuery(
    options: Pick<DeviceListQueryOptions, "search" | "status">,
): TypedQueryConfig<DeviceListTotalRow, DeviceListFilterValues> {
    const { whereSql, values } = buildDeviceListFilters(
        options.search,
        options.status,
    );

    return {
        text: `select count(*)::int as total from devices d left join device_latest dl on dl.device_id = d.id ${whereSql}`,
        values,
    };
}

export function getDeviceListItemsQuery(
    options: DeviceListQueryOptions,
): TypedQueryConfig<
    DeviceListItemRow,
    [...DeviceListFilterValues, number, number]
> {
    const { whereSql, values } = buildDeviceListFilters(
        options.search,
        options.status,
    );
    const queryValues = [
        ...values,
        options.pageSize,
        (options.page - 1) * options.pageSize,
    ] as [...DeviceListFilterValues, number, number];

    return {
        text: `
      select d.id, d.name, dl.power, dl.temperature, dl.timestamp, dl.status
      from devices d left join device_latest dl on dl.device_id = d.id
      ${whereSql}
      order by ${deviceListSortColumns[options.sortBy]} ${options.sortDir} nulls last
      limit $${queryValues.length - 1} offset $${queryValues.length}`,
        values: queryValues,
    };
}
