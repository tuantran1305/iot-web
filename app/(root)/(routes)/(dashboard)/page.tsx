"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { config } from "@/lib/config";
import { thingsboard } from "@/lib/tbClient";
import { cn } from "@/lib/utils";
import axios from "axios";
import { ThermometerSun, Droplet, SunMedium, Sprout, Wifi, Timer, Lightbulb, Fan, Flame, CloudFog, PanelRightOpen, PanelRightClose } from "lucide-react";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import useWebSocket from "react-use-websocket";
import { TbEntity } from "thingsboard-api-client";
import InputThreshold from "./components/input-threshold";
import LatestTelemetryCard from "./components/latest-telemetry-card";
import TelemetryTable from "./components/telemetry-table";
import TelemetryChart from "./components/telemetry-chart";
import TelemetryMultiChart from "./components/telemetry-multi-chart";
import SafeZoneEditor from "./components/safe-zone-editor";

const { deviceId, tbServer } = config;
// Latest telemetry keys for agricultural device
const keys = "air_temp,air_hum,lux,soil_moist,system_on,light_on,mist_on,pump_on,fan_on,heater_on,wifi_connected,uptime";
// Attribute keys for modes, controls, and thresholds
const attrKeys =
  [
    "mode", // Auto/Manual
    "auto_type", // sensor/web
    // Web control attributes
    "heat",
    "light",
    "fan",
    "drip",
    "mist",
    "curtain_open",
    "curtain_close",
    // Thresholds for sensor auto mode
    "soil_high",
    "soil_low",
    "temp_high",
    "temp_low",
    "light_high",
    "light_low",
  ].join(",");

const formatAttribute = (data: any) => {
  const booleanKeys = new Set([
    "heat",
    "light",
    "fan",
    "drip",
    "mist",
    "curtain_open",
    "curtain_close",
    // include other boolean flags if they exist later
  ]);
  const numberKeys = new Set([
    "soil_high",
    "soil_low",
    "temp_high",
    "temp_low",
    "light_high",
    "light_low",
  ]);

  const format: Record<string, any> = {};
  Object.values(data).forEach((item: any) => {
    const key = item["key"];
    const val = item["value"];

    if (booleanKeys.has(key)) {
      // Normalize to true booleans
      format[key] = val === true || val === "true" || val === 1 || val === "1";
    } else if (numberKeys.has(key)) {
      const n = typeof val === "number" ? val : parseFloat(val);
      format[key] = Number.isFinite(n) ? n : val;
    } else {
      format[key] = val;
    }
  });
  return format;
};

const DashboardPage = () => {
  const [loading, setLoading] = useState(false);
  const [latestData, setLatestData] = useState() as any;
  const [attribute, setAttribute] = useState() as any;
  const [socketUrl, setSocketUrl] = useState("");
  const [saveState, setSaveState] = useState(false);
  const [edit, setEdit] = useState({ key: "", value: "" });
  const [mode, setMode] = useState<"Auto"|"Manual">("Auto");
  const [autoType, setAutoType] = useState<"sensor"|"web">("sensor");
  // Derived system state from latest telemetry
  const systemOn = latestData?.["system_on"]?.[0]?.["value"] === "true";

  useEffect(() => {
    const token = localStorage.getItem("token");
    // Prefer secure WS if the page is served over HTTPS and server supports it
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
    const socketUrl = `${protocol}://${tbServer}/api/ws/plugins/telemetry?token=${token}`;
    setSocketUrl(socketUrl);
  }, []);
  const { getWebSocket } = useWebSocket(socketUrl != "" ? socketUrl : null, {
    onOpen: () => {
      var object = {
        tsSubCmds: [
          {
            entityType: "DEVICE",
            entityId: deviceId,
            scope: "LATEST_TELEMETRY",
            cmdId: 10,
          },
        ],
        historyCmds: [],
        attrSubCmds: [],
      };
      var data = JSON.stringify(object);
      getWebSocket().send(data);
    },
    onMessage: (event) => {
      let obj = JSON.parse(event.data).data;
      setLatestData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          air_temp: obj?.["air_temp"] ? [{ ts: obj["air_temp"][0][0], value: obj["air_temp"][0][1] }] : prev.air_temp,
          air_hum: obj?.["air_hum"] ? [{ ts: obj["air_hum"][0][0], value: obj["air_hum"][0][1] }] : prev.air_hum,
          lux: obj?.["lux"] ? [{ ts: obj["lux"][0][0], value: obj["lux"][0][1] }] : prev.lux,
          soil_moist: obj?.["soil_moist"] ? [{ ts: obj["soil_moist"][0][0], value: obj["soil_moist"][0][1] }] : prev.soil_moist,
          system_on: obj?.["system_on"] ? [{ ts: obj["system_on"][0][0], value: obj["system_on"][0][1] }] : prev.system_on,
          light_on: obj?.["light_on"] ? [{ ts: obj["light_on"][0][0], value: obj["light_on"][0][1] }] : prev.light_on,
          mist_on: obj?.["mist_on"] ? [{ ts: obj["mist_on"][0][0], value: obj["mist_on"][0][1] }] : prev.mist_on,
          pump_on: obj?.["pump_on"] ? [{ ts: obj["pump_on"][0][0], value: obj["pump_on"][0][1] }] : prev.pump_on,
          fan_on: obj?.["fan_on"] ? [{ ts: obj["fan_on"][0][0], value: obj["fan_on"][0][1] }] : prev.fan_on,
          heater_on: obj?.["heater_on"] ? [{ ts: obj["heater_on"][0][0], value: obj["heater_on"][0][1] }] : prev.heater_on,
          wifi_connected: obj?.["wifi_connected"] ? [{ ts: obj["wifi_connected"][0][0], value: obj["wifi_connected"][0][1] }] : prev.wifi_connected,
          uptime: obj?.["uptime"] ? [{ ts: obj["uptime"][0][0], value: obj["uptime"][0][1] }] : prev.uptime,
        };
      });
    },
    onError: () => {
      // Fallback: when WS fails (e.g., HTTPS-only context + ws server), disable WS by clearing URL
      setSocketUrl("");
    },
    onClose: () => {},
  }) as any;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      redirect("/login");
    }

    const getData = async () => {
      setLoading(true);
      await axios
        .post(`/api/telemetry/latest`, {
          token,
          deviceId,
          keys,
        })
        .then((resp) => {
          setLatestData(resp.data);
        })
        .catch((error) => {
          console.error({ error });
          toast.error("Có lỗi xảy ra");
        })
        .finally(() => {
          setLoading(false);
        });
    };

    getData();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      redirect("/login");
    }

    const getData = async () => {
      setLoading(true);
      await axios
        .post(`/api/telemetry/attribute`, {
          token,
          deviceId,
          keys: attrKeys,
        })
        .then((resp) => {
          setAttribute(formatAttribute(resp.data));
        })
        .catch((error) => {
          console.error({ error });
          toast.error("Có lỗi xảy ra");
        })
        .finally(() => {
          setLoading(false);
        });
    };

    getData();
  }, [saveState]);

  const now = Date.now();

  const onSave = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      redirect("/login");
    }

    await axios
      .post(`/api/telemetry/attribute/save`, {
        token,
        deviceId,
        payload: {
          ...attribute,
          [edit.key]: edit.key.endsWith("_high") || edit.key.endsWith("_low") || edit.key.includes("temp") || edit.key.includes("light") || edit.key.includes("soil")
            ? parseFloat(edit.value)
            : edit.value,
        },
      })
      .then(() => {
        toast.success("Lưu ngưỡng thành công");
        setSaveState((prev) => !prev);
      })
      .catch((error) => {
        console.error({ error });
        toast.error("Có gì đó sai sai");
      })
      .finally(() => {
        setEdit({ key: "", value: "" });
      });
  }, [attribute, edit]);

  const onToggleSetZone = useCallback(async (value: boolean) => {
    const token = localStorage.getItem("token");
    if (!token) {
      redirect("/login");
    }

    await axios
      .post(`/api/telemetry/attribute/save`, {
        token,
        deviceId,
        payload: {
          ...attribute,
          set_zone: value,
        },
      })
      .then(() => {
        toast.success("Cập nhật chế độ vùng an toàn");
        setSaveState((prev) => !prev);
      })
      .catch((error) => {
        console.error({ error });
        toast.error("Không thể thay đổi chế độ vùng");
      });
  }, [attribute]);

  // Memoize table to avoid re-render on every ping
  const table = useMemo(() => (
    <TelemetryTable
      entityId={deviceId}
      entityType={TbEntity.DEVICE}
      keys={keys}
      startTs={0}
      endTs={now}
      limit={200}
    />
  ), [now]);

  const Maps = dynamic(() => import("./components/maps"), {
    ssr: false,
  });

  const onClickDevice = useCallback(async (data: any) => {
    const token = localStorage.getItem("token");
    if (!token) {
      redirect("/login");
    }
    await axios
      .post(`/api/telemetry/attribute/save`, {
        token,
        deviceId,
        payload: {
          ...data,
        },
      })
      .then(() => {
        toast.success("Lưu thành công");
        setSaveState((prev) => !prev);
      })
      .catch((error) => {
        console.error({ error });
        toast.error("Có lỗi xảy ra");
      })
      .finally(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Top status cards */}
      <div className="grid gap-4 md:grid-cols-3 grid-cols-1">
        <LatestTelemetryCard title="Nhiệt độ không khí" icon={<ThermometerSun className="h-8 w-8 text-red-500" />} data={latestData?.["air_temp"][0]} loading={loading} unit="°C" />
        <LatestTelemetryCard title="Độ ẩm không khí" icon={<Droplet className="h-8 w-8 text-blue-500" />} data={latestData?.["air_hum"][0]} loading={loading} unit="%" />
        <LatestTelemetryCard title="Ánh sáng" icon={<SunMedium className="h-8 w-8 text-yellow-500" />} data={latestData?.["lux"][0]} loading={loading} unit=" lx" />
        <LatestTelemetryCard title="Độ ẩm đất" icon={<Sprout className="h-8 w-8 text-green-500" />} data={latestData?.["soil_moist"][0]} loading={loading} unit=" %" />
        <LatestTelemetryCard title="WiFi" icon={<Wifi className="h-8 w-8 text-indigo-500" />} data={latestData?.["wifi_connected"][0]} loading={loading} isBoolean booleanArr={["Kết nối", "Mất kết nối"]} />
        <LatestTelemetryCard title="Uptime" icon={<Timer className="h-8 w-8 text-gray-500" />} data={latestData?.["uptime"][0]} loading={loading} unit=" s" />
      </div>

      {/* Mode selection */}
      <Card>
        <CardHeader>
          <CardTitle>Chế độ: Auto / Manual</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Indicators */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${systemOn ? "bg-green-100" : "bg-red-100"}`}>
              <span className={`h-3 w-3 rounded-full ${systemOn ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm font-medium">Hệ thống: {systemOn ? "ON" : "OFF"}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-100">
              <span className="h-3 w-3 rounded-full bg-slate-500" />
              <span className="text-sm font-medium">Chế độ: {mode}</span>
            </div>
          </div>

          {/* Display-only mode state: no direct controls */}
          {mode === "Auto" && (
            <div className="flex items-center gap-2">
              <Badge>Auto</Badge>
            </div>
          )}
          {mode === "Manual" && (
            <div className="flex items-center gap-2">
              <Badge>Manual</Badge>
            </div>
          )}

          {/* In Manual, show Auto configuration (unlocked). In Auto, show as usual */}
          {(mode === "Auto" || mode === "Manual") && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant={autoType === "sensor" ? "default" : "secondary"}
                  onClick={() => {
                    setAutoType("sensor");
                    onClickDevice({ auto: "sensor" });
                  }}
                >
                  Auto Sensor
                </Button>
                <Button
                  variant={autoType === "web" ? "default" : "secondary"}
                  onClick={() => {
                    setAutoType("web");
                    onClickDevice({ auto: "control" });
                  }}
                >
                  Auto Control
                </Button>
              </div>

              {autoType === "sensor" && (
                <div className="grid gap-4 md:grid-cols-3 grid-cols-1">
                  <LatestTelemetryCard title="Ngưỡng nhiệt độ" icon={<ThermometerSun className="h-8 w-8 text-red-500" />} loading={false}>
                    <div className="flex flex-col gap-2">
                      <InputThreshold title="Temp high" targetKey="temp_high" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                      <InputThreshold title="Temp low" targetKey="temp_low" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                    </div>
                  </LatestTelemetryCard>
                  <LatestTelemetryCard title="Ngưỡng độ ẩm đất" icon={<Sprout className="h-8 w-8 text-green-500" />} loading={false}>
                    <div className="flex flex-col gap-2">
                      <InputThreshold title="Soil high" targetKey="soil_high" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                      <InputThreshold title="Soil low" targetKey="soil_low" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                    </div>
                  </LatestTelemetryCard>
                  <LatestTelemetryCard title="Ngưỡng ánh sáng" icon={<SunMedium className="h-8 w-8 text-yellow-500" />} loading={false}>
                    <div className="flex flex-col gap-2">
                      <InputThreshold title="Light high" targetKey="light_high" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                      <InputThreshold title="Light low" targetKey="light_low" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                    </div>
                  </LatestTelemetryCard>
                </div>
              )}

              {autoType === "web" && (
                <div className="grid gap-4 md:grid-cols-3 grid-cols-1">
                  <LatestTelemetryCard title="Bóng đèn sưởi" icon={<Flame className="h-8 w-8 text-red-500" />} loading={false} data={{ value: attribute?.["heat"] }} isBoolean booleanArr={["Bật","Tắt"]}>
                    <Button className="mt-2" onClick={() => onClickDevice({ heat: !attribute?.["heat"] })}>{attribute?.["heat"] ? "Tắt" : "Bật"}</Button>
                  </LatestTelemetryCard>
                  <LatestTelemetryCard title="Đèn chiếu sáng" icon={<Lightbulb className="h-8 w-8 text-yellow-500" />} loading={false} data={{ value: attribute?.["light"] }} isBoolean booleanArr={["Bật","Tắt"]}>
                    <Button className="mt-2" onClick={() => onClickDevice({ light: !attribute?.["light"] })}>{attribute?.["light"] ? "Tắt" : "Bật"}</Button>
                  </LatestTelemetryCard>
                  <LatestTelemetryCard title="Quạt" icon={<Fan className="h-8 w-8 text-blue-500" />} loading={false} data={{ value: attribute?.["fan"] }} isBoolean booleanArr={["Bật","Tắt"]}>
                    <Button className="mt-2" onClick={() => onClickDevice({ fan: !attribute?.["fan"] })}>{attribute?.["fan"] ? "Tắt" : "Bật"}</Button>
                  </LatestTelemetryCard>
                  <LatestTelemetryCard title="Tưới nhỏ giọt" icon={<Droplet className="h-8 w-8 text-emerald-500" />} loading={false} data={{ value: attribute?.["drip"] }} isBoolean booleanArr={["Bật","Tắt"]}>
                    <Button className="mt-2" onClick={() => onClickDevice({ drip: !attribute?.["drip"] })}>{attribute?.["drip"] ? "Tắt" : "Bật"}</Button>
                  </LatestTelemetryCard>
                  <LatestTelemetryCard title="Phun sương" icon={<CloudFog className="h-8 w-8 text-cyan-500" />} loading={false} data={{ value: attribute?.["mist"] }} isBoolean booleanArr={["Bật","Tắt"]}>
                    <Button className="mt-2" onClick={() => onClickDevice({ mist: !attribute?.["mist"] })}>{attribute?.["mist"] ? "Tắt" : "Bật"}</Button>
                  </LatestTelemetryCard>
                  <LatestTelemetryCard title="Rèm mở" icon={<PanelRightOpen className="h-8 w-8 text-gray-500" />} loading={false} data={{ value: attribute?.["curtain_open"] }} isBoolean booleanArr={["Mở","Đóng"]}>
                    <Button className="mt-2" onClick={() => onClickDevice({ curtain_open: true, curtain_close: false })}>Mở</Button>
                  </LatestTelemetryCard>
                  <LatestTelemetryCard title="Rèm đóng" icon={<PanelRightClose className="h-8 w-8 text-gray-700" />} loading={false} data={{ value: attribute?.["curtain_close"] }} isBoolean booleanArr={["Đóng","Mở"]}>
                    <Button className="mt-2" onClick={() => onClickDevice({ curtain_open: false, curtain_close: true })}>Đóng</Button>
                  </LatestTelemetryCard>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Combined chart for 4 metrics */}
      <TelemetryMultiChart
        token={typeof window !== "undefined" ? (localStorage.getItem("token") || "") : ""}
        entityId={deviceId}
        startTs={0}
        endTs={now}
        refreshMs={60000}
      />

      {/* Bảng dữ liệu cảm biến (200 dòng tối đa) */}
      {table}
    </div>
  );
};

export default DashboardPage;
