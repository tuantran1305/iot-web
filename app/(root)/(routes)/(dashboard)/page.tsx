"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import useWebSocket from "react-use-websocket";
import { toast } from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Power, PanelRightOpen, PanelRightClose, ThermometerSun, Droplet, SunMedium, Sprout, Wifi, Timer, Lightbulb, Fan, Flame, CloudFog } from "lucide-react";

import LatestTelemetryCard from "./components/latest-telemetry-card";
import InputThreshold from "./components/input-threshold";
import TelemetryTable from "./components/telemetry-table";
import TelemetryMultiChart from "./components/telemetry-multi-chart";
import { config } from "@/lib/config";
import { TbEntity } from "thingsboard-api-client";

const { tbServer, deviceId } = config;

const keys = [
  "air_temp",
  "air_hum",
  "lux",
  "soil_moist",
  "system_on",
  "light_on",
  "mist_on",
  "pump_on",
  "fan_on",
  "heater_on",
  "wifi_connected",
  "uptime",
  "auto_mode",
].join(",");

const attrKeys = [
  "power",
  "auto_mode_control",
  "heat",
  "light",
  "fan",
  "drip",
  "mist",
  "curtain_open",
  "curtain_close",
  "soil_high",
  "soil_low",
  "temp_high",
  "temp_low",
  "hum_high",
  "hum_low",
  "light_high",
  "light_low",
].join(",");

function formatAttribute(data: any) {
  const booleanKeys = new Set([
    "power",
    "heat",
    "light",
    "fan",
    "drip",
    "mist",
    "curtain_open",
    "curtain_close",
  ]);
  const numberKeys = new Set([
    "soil_high",
    "soil_low",
    "temp_high",
    "temp_low",
    "hum_high",
    "hum_low",
    "light_high",
    "light_low",
  ]);
  const format: Record<string, any> = {};
  Object.values(data || {}).forEach((item: any) => {
    const key = item?.key;
    const val = item?.value;
    if (booleanKeys.has(key)) {
      format[key] = val === true || val === "true" || val === 1 || val === "1";
    } else if (numberKeys.has(key)) {
      const n = typeof val === "number" ? val : parseFloat(val);
      format[key] = Number.isFinite(n) ? n : val;
    } else {
      format[key] = val;
    }
  });
  return format;
}

const DashboardPage = () => {
  const [loading, setLoading] = useState(false);
  const [latestData, setLatestData] = useState<any>();
  const [attribute, setAttribute] = useState<any>();
  const [socketUrl, setSocketUrl] = useState("");
  const [edit, setEdit] = useState<{ key: string; value: any }>({ key: "", value: "" });

  const now = useMemo(() => Date.now(), []);

  const powerOn = attribute?.power === true || attribute?.power === "true" || attribute?.power === 1 || attribute?.power === "1";
  const autoModeVal = latestData?.auto_mode?.[0]?.value;
  const isAutoMode = autoModeVal === true || autoModeVal === "true" || autoModeVal === 1 || autoModeVal === "1";
  const isAutoControl = attribute?.auto_mode_control === true || attribute?.auto_mode_control === "true" || attribute?.auto_mode_control === 1 || attribute?.auto_mode_control === "1";

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
    setSocketUrl(`${protocol}://${tbServer}/api/ws/plugins/telemetry?token=${token}`);
  }, []);

  const { sendMessage } = useWebSocket(socketUrl || null, {
    onOpen: () => {
      const cmd = {
        tsSubCmds: [{ entityType: "DEVICE", entityId: deviceId, scope: "LATEST_TELEMETRY", cmdId: 10 }],
        historyCmds: [],
        attrSubCmds: [],
      };
      sendMessage(JSON.stringify(cmd));
    },
    onMessage: (event) => {
      const obj = JSON.parse(event.data)?.data;
      setLatestData((prev: any) => {
        if (!obj) return prev;
        const merged = { ...(prev || {}) };
        Object.entries(obj).forEach(([k, v]) => {
          merged[k] = v as any;
        });
        return merged;
      });
    },
    shouldReconnect: () => true,
  });

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [latestResp, attrResp] = await Promise.all([
          axios.post("/api/telemetry/latest", { token, deviceId, keys }),
          axios.post("/api/telemetry/attribute", { token, deviceId, keys: attrKeys }),
        ]);
        setLatestData(latestResp.data);
        setAttribute(formatAttribute(attrResp.data));
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Lỗi kết nối dữ liệu");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const onTogglePower = async (next: boolean) => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      await axios.post("/api/telemetry/attribute/save", { token, deviceId, payload: { power: next } });
      setAttribute((prev: any) => ({ ...(prev || {}), power: next }));
      toast.success(next ? "POWER: ON" : "POWER: OFF");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không lưu được trạng thái POWER");
    } finally {
      setLoading(false);
    }
  };

  const setAutoControl = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      await axios.post("/api/telemetry/attribute/save", { token, deviceId, payload: { auto_mode_control: true } });
      setAttribute((prev: any) => ({ ...(prev || {}), auto_mode_control: true }));
      toast.success("Chuyển chế độ: Auto Control");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không chuyển được chế độ");
    }
  };

  const setAutoSensor = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      await axios.post("/api/telemetry/attribute/save", { token, deviceId, payload: { auto_mode_control: false } });
      setAttribute((prev: any) => ({ ...(prev || {}), auto_mode_control: false }));
      toast.success("Chuyển chế độ: Auto Sensor");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không chuyển được chế độ");
    }
  };

  const onClickDevice = async (data: Record<string, boolean>) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      await axios.post("/api/telemetry/attribute/save", { token, deviceId, payload: { ...data } });
      setAttribute((prev: any) => ({ ...(prev || {}), ...data }));
      toast.success("Đã điều khiển thiết bị");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không điều khiển được thiết bị");
    }
  };

  const onSave = async () => {
    try {
      if (!edit.key) return;
      const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
      const num = typeof edit.value === "number" ? edit.value : parseFloat(edit.value);
      const val = Number.isFinite(num) ? num : edit.value;
      await axios.post("/api/telemetry/attribute/save", { token, deviceId, payload: { [edit.key]: val } });
      setAttribute((prev: any) => ({ ...(prev || {}), [edit.key]: val }));
      setEdit({ key: "", value: "" });
      toast.success("Lưu ngưỡng thành công");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Không lưu được ngưỡng");
    }
  };

  const table = useMemo(() => {
    return (
      <TelemetryTable
        entityId={deviceId}
        entityType={TbEntity.DEVICE}
        keys={"air_temp,air_hum,lux,soil_moist"}
        startTs={now - 24 * 60 * 60 * 1000}
        endTs={now}
      />
    );
  }, [now]);

  return (
    <div className="space-y-6">
      {/* POWER card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" /> POWER
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Badge variant={powerOn ? "default" : "secondary"}>{powerOn ? "ON" : "OFF"}</Badge>
          <Button disabled={loading} onClick={() => onTogglePower(true)}>ON</Button>
          <Button variant="destructive" disabled={loading} onClick={() => onTogglePower(false)}>OFF</Button>
        </CardContent>
      </Card>

      {/* Top-level mode indicator */}
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md ${isAutoMode ? "bg-green-50" : "bg-red-50"}`}>
            <span className={`h-3 w-3 rounded-full ${isAutoMode ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-base font-semibold">Chế độ: {isAutoMode ? "Auto" : "Manual"}</span>
          </div>
        </CardContent>
      </Card>

      {/* System content below POWER; blur when OFF */}
      {!powerOn && (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">Hệ thống đang tắt. Bật POWER để hiển thị.</div>
      )}
      {!isAutoMode && (
        <div className="rounded-md border p-3 text-sm text-muted-foreground">Chế độ Manual: giao diện bị làm mờ và không thể thao tác.</div>
      )}
      <div className={powerOn && isAutoMode ? "space-y-6" : "space-y-6 opacity-50 pointer-events-none select-none"}>
        {/* Mode + Controls/Threshold in one card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isAutoMode ? <PanelRightOpen className="h-5 w-5" /> : <PanelRightClose className="h-5 w-5" />}
              Auto Control or Auto Sensor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button disabled={!isAutoMode} variant={isAutoControl ? "default" : "secondary"} onClick={setAutoControl}>Auto Control</Button>
              <Button disabled={!isAutoMode} variant={!isAutoControl ? "default" : "secondary"} onClick={setAutoSensor}>Auto Sensor</Button>
            </div>

            {isAutoMode && isAutoControl ? (
              // Show device control buttons when Auto + Auto Control
              <div className="grid gap-4 md:grid-cols-3 grid-cols-1">
                <LatestTelemetryCard title="Bóng đèn sưởi" icon={<Flame className="h-8 w-8 text-red-500" />} loading={false} data={{ value: attribute?.heat }} isBoolean booleanArr={["ON","OFF"]}>
                  <Button className="mt-2" onClick={() => onClickDevice({ heat: !attribute?.heat })}>{attribute?.heat ? "OFF" : "ON"}</Button>
                </LatestTelemetryCard>
                <LatestTelemetryCard title="Đèn chiếu sáng" icon={<Lightbulb className="h-8 w-8 text-yellow-500" />} loading={false} data={{ value: attribute?.light }} isBoolean booleanArr={["ON","OFF"]}>
                  <Button className="mt-2" onClick={() => onClickDevice({ light: !attribute?.light })}>{attribute?.light ? "OFF" : "ON"}</Button>
                </LatestTelemetryCard>
                <LatestTelemetryCard title="Quạt" icon={<Fan className="h-8 w-8 text-blue-500" />} loading={false} data={{ value: attribute?.fan }} isBoolean booleanArr={["ON","OFF"]}>
                  <Button className="mt-2" onClick={() => onClickDevice({ fan: !attribute?.fan })}>{attribute?.fan ? "OFF" : "ON"}</Button>
                </LatestTelemetryCard>
                <LatestTelemetryCard title="Tưới nhỏ giọt" icon={<Droplet className="h-8 w-8 text-emerald-500" />} loading={false} data={{ value: attribute?.drip }} isBoolean booleanArr={["ON","OFF"]}>
                  <Button className="mt-2" onClick={() => onClickDevice({ drip: !attribute?.drip })}>{attribute?.drip ? "OFF" : "ON"}</Button>
                </LatestTelemetryCard>
                <LatestTelemetryCard title="Phun sương" icon={<CloudFog className="h-8 w-8 text-cyan-500" />} loading={false} data={{ value: attribute?.mist }} isBoolean booleanArr={["ON","OFF"]}>
                  <Button className="mt-2" onClick={() => onClickDevice({ mist: !attribute?.mist })}>{attribute?.mist ? "OFF" : "ON"}</Button>
                </LatestTelemetryCard>
                <LatestTelemetryCard title="Rèm" icon={<PanelRightOpen className="h-8 w-8 text-gray-500" />} loading={false} data={{ value: attribute?.curtain_open }} isBoolean booleanArr={["Mở","Đóng"]}>
                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => onClickDevice({ curtain_open: true, curtain_close: false })}>Mở</Button>
                    <Button variant="secondary" onClick={() => onClickDevice({ curtain_open: false, curtain_close: true })}>Đóng</Button>
                  </div>
                </LatestTelemetryCard>
              </div>
            ) : isAutoMode && !isAutoControl ? (
              // Show threshold editor when Auto + Auto Sensor
              <div className="grid gap-4 md:grid-cols-2 grid-cols-1">
                <InputThreshold title="Temp high" targetKey="temp_high" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                <InputThreshold title="Temp low" targetKey="temp_low" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                <InputThreshold title="Hum high" targetKey="hum_high" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                <InputThreshold title="Hum low" targetKey="hum_low" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                <InputThreshold title="Soil high" targetKey="soil_high" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                <InputThreshold title="Soil low" targetKey="soil_low" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                <InputThreshold title="Light high" targetKey="light_high" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
                <InputThreshold title="Light low" targetKey="light_low" setEdit={setEdit} edit={edit} attribute={attribute} onSave={onSave} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Latest sensors */}
        <div className="grid gap-4 md:grid-cols-3 grid-cols-1">
          <LatestTelemetryCard title="Nhiệt độ" icon={<ThermometerSun className="h-8 w-8 text-orange-500" />} data={latestData?.["air_temp"]?.[0]} loading={loading} unit="°C" />
          <LatestTelemetryCard title="Độ ẩm" icon={<Droplet className="h-8 w-8 text-blue-500" />} data={latestData?.["air_hum"]?.[0]} loading={loading} unit="%" />
          <LatestTelemetryCard title="Ánh sáng" icon={<SunMedium className="h-8 w-8 text-yellow-500" />} data={latestData?.["lux"]?.[0]} loading={loading} unit="lx" />
          <LatestTelemetryCard title="Độ ẩm đất" icon={<Sprout className="h-8 w-8 text-green-600" />} data={latestData?.["soil_moist"]?.[0]} loading={loading} unit="%" />
          <LatestTelemetryCard title="WiFi" icon={<Wifi className="h-8 w-8 text-slate-500" />} data={latestData?.["wifi_connected"]?.[0]} loading={loading} isBoolean booleanArr={["ON","OFF"]} />
          <LatestTelemetryCard title="Uptime" icon={<Timer className="h-8 w-8 text-teal-600" />} data={latestData?.["uptime"]?.[0]} loading={loading} unit="s" />
        </div>

        {/* Relay status via telemetry */}
        <Card>
          <CardHeader><CardTitle>Trạng thái thiết bị</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 grid-cols-1">
            <LatestTelemetryCard title="Quạt" icon={<Fan className="h-8 w-8 text-blue-500" />} data={latestData?.["fan_on"]?.[0]} loading={loading} isBoolean booleanArr={["ON","OFF"]} />
            <LatestTelemetryCard title="Sưởi" icon={<Flame className="h-8 w-8 text-red-500" />} data={latestData?.["heater_on"]?.[0]} loading={loading} isBoolean booleanArr={["ON","OFF"]} />
            <LatestTelemetryCard title="Đèn" icon={<Lightbulb className="h-8 w-8 text-yellow-500" />} data={latestData?.["light_on"]?.[0]} loading={loading} isBoolean booleanArr={["ON","OFF"]} />
            <LatestTelemetryCard title="Phun sương" icon={<CloudFog className="h-8 w-8 text-cyan-500" />} data={latestData?.["mist_on"]?.[0]} loading={loading} isBoolean booleanArr={["ON","OFF"]} />
            <LatestTelemetryCard title="Bơm" icon={<Droplet className="h-8 w-8 text-emerald-500" />} data={latestData?.["pump_on"]?.[0]} loading={loading} isBoolean booleanArr={["ON","OFF"]} />
          </CardContent>
        </Card>

        {/* Combined chart */}
        <TelemetryMultiChart
          token={typeof window !== "undefined" ? (localStorage.getItem("token") || "") : ""}
          entityId={deviceId}
          startTs={0}
          endTs={now}
          refreshMs={60000}
        />

        {/* Table */}
        {table}
      </div>
    </div>
  );
};

export default DashboardPage;

