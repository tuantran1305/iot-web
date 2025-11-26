"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { config } from "@/lib/config";
import { thingsboard } from "@/lib/tbClient";
import { cn } from "@/lib/utils";
import axios from "axios";
import { BellIcon, Grab, Heart, Thermometer, User2Icon, Activity, Droplets } from "lucide-react";
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
import SafeZoneEditor from "./components/safe-zone-editor";

const { deviceId, tbServer } = config;
const keys = "heartRate,SPO2,temperature,longitude,latitude,waterDetected,waterDuration";
const attrKeys =
  "temperature_threshold_upper,spo2_upper,spo2_lower,heartrate_threshold_upper,heartrate_threshold_lower,buzzer,phone,alert,safe_zone";

const formatAttribute = (data: any) => {
  let format = {} as any;
  Object.values(data).map((item: any) => {
    format[item["key"]] = item["value"];
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
          heartRate: obj?.["heartRate"] 
            ? [{ ts: obj["heartRate"][0][0], value: obj["heartRate"][0][1] }]
            : prev.heartRate,
          SPO2: obj?.["SPO2"]
            ? [{ ts: obj["SPO2"][0][0], value: obj["SPO2"][0][1] }]
            : prev.SPO2,
          temperature: obj?.["temperature"]
            ? [{ ts: obj["temperature"][0][0], value: obj["temperature"][0][1] }]
            : prev.temperature,
          waterDetected: obj?.["waterDetected"]
            ? [{ ts: obj["waterDetected"][0][0], value: obj["waterDetected"][0][1] }]
            : prev.waterDetected,
          waterDuration: obj?.["waterDuration"]
            ? [{ ts: obj["waterDuration"][0][0], value: obj["waterDuration"][0][1] }]
            : prev.waterDuration,
          latitude: obj?.["latitude"]
            ? [{ ts: obj["latitude"][0][0], value: obj["latitude"][0][1] }]
            : prev.latitude,
          longitude: obj?.["longitude"]
            ? [{ ts: obj["longitude"][0][0], value: obj["longitude"][0][1] }]
            : prev.longitude,
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
          [edit.key]: parseFloat(edit.value),
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
          set_zone: value ? "true" : "false",
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
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2 grid-cols-1">
        <LatestTelemetryCard
          title="Nhiệt độ cơ thể"
          icon={<Thermometer className="h-8 w-8 text-red-500" />}
          data={latestData?.["temperature"][0]}
          loading={loading}
          unit="°C"
        >
          <div>
            {parseFloat(latestData?.["temperature"][0]["value"]) <
            attribute?.["temperature_threshold_upper"] ? (
              <Badge className="bg-green-600">Bình thường</Badge>
            ) : (
              <Badge className="bg-red-600">Quá ngưỡng</Badge>
            )}
          </div>
          <div>
            <InputThreshold
              title="Ngưỡng trên"
              targetKey="temperature_threshold_upper"
              setEdit={setEdit}
              edit={edit}
              attribute={attribute}
              onSave={onSave}
            />
          </div>
        </LatestTelemetryCard>
        <LatestTelemetryCard
          title="Phát hiện nước"
          icon={<Activity className="h-8 w-8 text-blue-500" />}
          data={latestData?.["waterDetected"][0]}
          loading={loading}
          isBoolean
          booleanArr={["Có", "Không"]}
        />
        <LatestTelemetryCard
          title="SpO2"
          icon={<Droplets className="h-8 w-8 text-blue-500" />}
          data={latestData?.["SPO2"][0]}
          isInteger={true}
          loading={loading}
          unit="%"
        >
          <div>
            {attribute?.["spo2_lower"] <=
              parseFloat(latestData?.["SPO2"][0]["value"]) &&
            parseFloat(latestData?.["SPO2"][0]["value"]) <=
              attribute?.["spo2_upper"] ? (
              <Badge className="bg-green-600">Bình thường</Badge>
            ) : (
              <Badge className="bg-red-600">Quá ngưỡng</Badge>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <InputThreshold
              title="Ngưỡng trên"
              targetKey="spo2_upper"
              setEdit={setEdit}
              edit={edit}
              attribute={attribute}
              onSave={onSave}
            />
            <InputThreshold
              title="Ngưỡng dưới"
              targetKey="spo2_lower"
              setEdit={setEdit}
              edit={edit}
              attribute={attribute}
              onSave={onSave}
            />
          </div>
        </LatestTelemetryCard>
        <LatestTelemetryCard
          title="Nhịp tim"
          icon={<Heart className="h-8 w-8 text-pink-500" />}
          data={latestData?.["heartRate"][0]}
          loading={loading}
          isInteger={true}
          unit="BPM"
        >
          <div>
            {parseFloat(latestData?.["heartRate"][0]["value"]) >
            attribute?.["heartrate_threshold_upper"] ? (
              <Badge className="bg-red-600">Nhanh</Badge>
            ) : parseFloat(latestData?.["heartRate"][0]["value"]) <
              attribute?.["heartrate_threshold_lower"] ? (
              <Badge className="bg-yellow-500">Chậm</Badge>
            ) : (
              <Badge className="bg-green-600">Bình thường</Badge>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <InputThreshold
              title="Ngưỡng trên"
              targetKey="heartrate_threshold_upper"
              setEdit={setEdit}
              edit={edit}
              attribute={attribute}
              onSave={onSave}
            />
            <InputThreshold
              title="Ngưỡng dưới"
              targetKey="heartrate_threshold_lower"
              setEdit={setEdit}
              edit={edit}
              attribute={attribute}
              onSave={onSave}
            />
          </div>
        </LatestTelemetryCard>
        <LatestTelemetryCard
          title="Thời gian trong nước"
          icon={<Activity className="h-8 w-8 text-orange-500" />}
          data={latestData?.["waterDuration"][0]}
          loading={loading}
          unit=" giây"
        />
        <LatestTelemetryCard
          title="Chuông"
          icon={<BellIcon className="h-8 w-8 text-yellow-500" />}
          data={attribute?.["buzzer"]}
          loading={loading}
          isBoolean={true}
          className={cn(
            attribute?.["buzzer"]
              ? attribute?.["buzzer"] == "true"
                ? "bg-lime-200"
                : "bg-gray-200"
              : ""
          )}
        >
          <Button
            className="mt-2"
            onClick={() =>
              onClickDevice({
                buzzer: attribute?.["buzzer"] == "true" ? "false" : "true",
              })
            }
          >
            {attribute?.["buzzer"] == "true" ? "Tắt" : "Bật"}
          </Button>
        </LatestTelemetryCard>
        <LatestTelemetryCard
          title="Người Thân"
          icon={<User2Icon className="h-8 w-8 text-green-500" />}
          loading={loading}
          isBoolean={true}
        >
          <InputThreshold
            title="Số điện thoại"
            targetKey="phone"
            setEdit={setEdit}
            edit={edit}
            attribute={attribute}
            onSave={onSave}
          />
        </LatestTelemetryCard>
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Cảnh báo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <span>{attribute?.["alert"] || "Không có"}</span>
          </CardContent>
        </Card>
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Biểu Đồ Nhiệt độ</CardTitle>
          </CardHeader>
          <CardContent>
            <TelemetryChart
              entityId={deviceId}
              entityType={TbEntity.DEVICE}
              label={"Nhiệt độ"}
              targetkey={"temperature"}
              startTs={0}
              endTs={now}
            />
          </CardContent>
        </Card>
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Biểu Đồ SPO2</CardTitle>
          </CardHeader>
          <CardContent>
            <TelemetryChart
              entityId={deviceId}
              entityType={TbEntity.DEVICE}
              label={"SPO2"}
              targetkey={"SPO2"}
              startTs={0}
              endTs={now}
            />
          </CardContent>
        </Card>
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Biểu Đồ Nhịp Tim</CardTitle>
          </CardHeader>
          <CardContent>
            <TelemetryChart
              entityId={deviceId}
              entityType={TbEntity.DEVICE}
              label={"Nhịp Tim"}
              targetkey={"heartRate"}
              startTs={0}
              endTs={now}
            />
          </CardContent>
        </Card>
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle>Biểu Đồ Thời Gian Trong Nước</CardTitle>
          </CardHeader>
          <CardContent>
            <TelemetryChart
              entityId={deviceId}
              entityType={TbEntity.DEVICE}
              label={"Thời Gian Trong Nước (giây)"}
              targetkey={"waterDuration"}
              startTs={0}
              endTs={now}
            />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bản Đồ</CardTitle>
        </CardHeader>
        <CardContent>
          <Maps
            latitude={latestData?.["latitude"]?.[0]["value"]}
            longitude={latestData?.["longitude"]?.[0]["value"]}
            safe_zone={attribute?.["safe_zone"]}
          />
        </CardContent>
      </Card>
      <SafeZoneEditor
        safe_zone={attribute?.["safe_zone"]}
        set_zone={attribute?.["set_zone"]}
        onToggleSetZone={onToggleSetZone}
        onSave={async (newSafeZone) => {
          const token = localStorage.getItem("token");
          if (!token) {
            redirect("/login");
          }
          await axios
            .post(`/api/telemetry/attribute/save`, {
              token,
              deviceId,
              payload: {
                safe_zone: JSON.stringify(newSafeZone),
              },
            })
            .then(() => {
              toast.success("Lưu vị trí an toàn thành công");
              setSaveState(!saveState);
            })
            .catch((error) => {
              console.error({ error });
              toast.error("Có lỗi xảy ra");
            });
        }}
      />
      <Card>
        <CardHeader>
          <CardTitle>Bảng Dữ Liệu</CardTitle>
        </CardHeader>
        <CardContent>{table}</CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
