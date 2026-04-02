import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { AssetPoint, NearbyPoi } from '../../types';
import styles from './AssetDetailsPanel.module.css';

const assetMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

const poiMarkerIcon = L.divIcon({
  className: styles.poiMarker,
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface AssetLocationMapProps {
  center: AssetPoint;
  pois: NearbyPoi[];
  zoom: number;
}

export function AssetLocationMap({ center, pois, zoom }: AssetLocationMapProps) {
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      className={styles.map}
      scrollWheelZoom={false}
      zoom={zoom}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker icon={assetMarkerIcon} position={[center.latitude, center.longitude]}>
        <Popup>Photo location</Popup>
      </Marker>
      {pois.map((poi) => (
        <Marker
          key={poi.id}
          icon={poiMarkerIcon}
          position={[poi.latitude, poi.longitude]}
        >
          <Popup>
            <strong>{poi.name}</strong>
            <br />
            {poi.category}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}