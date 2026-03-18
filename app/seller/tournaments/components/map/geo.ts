export type LatLng = {
  latitude: number
  longitude: number
}

export type BoundaryType =
  | "circle"
  | "polygon"

export type CircleBoundary = {
  type: "circle"
  center: LatLng
  radiusM: number
}

export type PolygonBoundary = {
  type: "polygon"
  points: LatLng[]
}

export type Boundary =
  | CircleBoundary
  | PolygonBoundary
  | null