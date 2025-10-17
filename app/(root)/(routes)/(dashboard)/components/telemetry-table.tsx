import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import axios from "axios";
import { Loader } from "lucide-react";
import moment from "moment";
import Link from "next/link";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { TbEntity } from "thingsboard-api-client";

interface TelemetryTableProps {
  entityId: string;
  entityType: TbEntity;
  keys: string;
  startTs: number;
  endTs: number;
}

const formattedData = (data: any, keys: string) => {
  let newData = {} as any;
  const keyList = keys.split(",");
  for (const [key, value] of Object.entries(data)) {
    if (typeof value == "object" && value != null) {
      for (const [key1, value1] of Object.entries(value)) {
        newData[value1.ts] = {
          ...newData[value1.ts],
          [key]: value1.value,
        };
      }
    }
  }
  let returnData = [] as any;
  let counter = 0;
  for (const [key, value] of Object.entries(newData)) {
    returnData[counter] = {
      idx: counter,
      ts: moment(parseFloat(key)).format("HH:mm:ss DD-MM-YYYY"),
    };
    keyList.map((item) => {
      returnData[counter] = {
        ...returnData[counter],
        [item]: null,
      };
    });
    if (typeof value == "object" && value != null) {
      for (const [key1, value1] of Object.entries(value)) {
        returnData[counter] = {
          ...returnData[counter],
          [key1]: value1,
        };
      }
    }
    counter = counter + 1;
  }
  return returnData;
};

const TelemetryTable = ({
  entityId,
  entityType,
  keys,
  startTs,
  endTs,
}: TelemetryTableProps) => {
  const [dataFormatTable, setDataFormatTable] = useState() as any;
  const [loading, setLoading] = useState(false);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "idx",
      header: "",
      cell: ({ row }) => (
        <p className="text-center">{parseInt(row.getValue("idx")) + 1}</p>
      ),
    },
    {
      accessorKey: "SPO2",
      header: "SpO2 (%)",
    },
    {
      accessorKey: "heartRate",
      header: "Nhịp tim (BPM)",
    },
    {
      accessorKey: "temperature",
      header: "Nhiệt độ cơ thể (°C)",
    },
    {
      accessorKey: "ts",
      header: "Thời gian cập nhật",
    },
    {
      accessorKey: "latitude",
      header: "Vĩ Độ",
    },
    {
      accessorKey: "longitude",
      header: "Kinh Độ",
    },
    {
      accessorKey: "",
      header: "Mapped pin",
      cell: ({ row }) => {
        if (row.getValue("latitude") && row.getValue("longitude")) {
          const url = `https://maps.google.com/?q=${row.getValue(
            "latitude"
          )},${row.getValue("longitude")}`;
          return (
            <Button variant={"link"} className="px-0">
              <Link
                href={url}
                target="_blank"
                className="font-medium text-blue-500"
              >
                {url}
              </Link>
            </Button>
          );
        }
      },
    },
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      redirect("/login");
    }
    const getData = async () => {
      setLoading(true);
      const resp = await axios.post(`/api/telemetry/timeseries`, {
        token,
        entityId,
        entityType,
        keys,
        startTs,
        endTs,
      });
      const formatData = formattedData(resp.data, keys);
      setDataFormatTable(formatData);
      setLoading(false);
    };
    getData();
  }, [endTs, entityId, entityType, keys, startTs]);

  return (
    <div className="container mx-0 lg:mx-auto px-0">
      {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
      {dataFormatTable != null && (
        <DataTable columns={columns} data={dataFormatTable} />
      )}
    </div>
  );
};

export default TelemetryTable;
