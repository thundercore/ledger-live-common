// @flow
import { Observable, from, of, concat, throwError } from "rxjs";
import { mergeMap, delay, filter, map } from "rxjs/operators";

import getDeviceInfo from "../hw/getDeviceInfo";
import installOsuFirmware from "../hw/installOsuFirmware";
import { withDevice } from "../hw/deviceAccess";
import type { FirmwareUpdateContext } from "../types/manager";
import { DeviceOnDashboardExpected } from "@ledgerhq/errors";

const waitEnd = of({ type: "wait" }).pipe(delay(1000));

const checkId = (
  deviceId: string,
  { osu }: FirmwareUpdateContext
): Observable<{ progress: number, displayedOnDevice: boolean }> =>
  withDevice(deviceId)(transport => from(getDeviceInfo(transport))).pipe(
    mergeMap(deviceInfo =>
      // if in bootloader or OSU we'll directly jump to MCU step
      deviceInfo.isBootloader || deviceInfo.isOSU
        ? throwError(new DeviceOnDashboardExpected())
        : concat(
            withDevice(deviceId)(transport =>
              installOsuFirmware(transport, deviceInfo.targetId, osu)
            ),
            waitEnd // the device is likely rebooting now, we give it some time
          )
    ),

    filter(e => e.type === "bulk-progress"),
    map(e => ({
      progress: e.progress,
      displayedOnDevice: e.index >= e.total - 1
    }))
  );

export default checkId;
