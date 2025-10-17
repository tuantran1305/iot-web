"use client";

import { Circle, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

interface MapsProps {
  latitude: number;
  longitude: number;
  safe_zone: any;
}

import { icon } from "leaflet";

const markerIcon = icon({
  iconUrl: "/leaflet/images/marker-icon.png",
  shadowUrl: "/leaflet/images/marker-shadow.png",
  iconAnchor: [10, 42],
  popupAnchor: [0, -51],
});

const safeIcon = icon({
  iconUrl: "/leaflet/images/safe.png",
  shadowUrl: "/leaflet/images/marker-shadow.png",
  iconSize: [18, 28],
  iconAnchor: [6, 22],
  popupAnchor: [0, -51],
});

const Maps: React.FC<MapsProps> = ({ latitude, longitude, safe_zone }) => {
  console.log({ safe_zone });
  if (longitude && latitude && safe_zone) {
    return (
      <MapContainer center={[latitude, longitude]} zoom={16}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={markerIcon}>
          <Popup>Vị trí hiện tại</Popup>
        </Marker>
        {safe_zone.map((item: any, idx: number) => (
          <>
            <Marker
              key={idx}
              position={[item.latitude, item.longitude]}
              icon={safeIcon}
            >
              <Popup>Vị trí an toàn {idx + 1}</Popup>
            </Marker>
            <Circle
              center={{ lat: item.latitude, lng: item.longitude }}
              fillColor="green"
              radius={item.radius}
            />
          </>
        ))}
      </MapContainer>
    );
  }
};

export default Maps;
