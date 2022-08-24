import { Vector3 } from 'three'
import sampleHdri from './assets/sample-hdri.png'
import { FilteringState } from './modules/filtering/FilteringManager'
import { PropertyInfo } from './modules/filtering/PropertyManager'
import { DataTree } from './modules/tree/DataTree'
import { World } from './modules/World'

export interface ViewerParams {
  postprocessing: boolean
  reflections: boolean
  showStats: boolean
  environmentSrc: Asset | string
}
export enum AssetType {
  TEXTURE_8BPP = 'png', // For now
  TEXTURE_HDR = 'hdr',
  TEXTURE_EXR = 'exr'
}

export interface Asset {
  src: string
  type: AssetType
}

/**
 * The default HDRI the viewer uses is actually a true HDR image (.exr),
 * specified by the explicit TEXTURE_EXR
 *
 * We do this because bundling an actual .exr or .hdr image format would require
 * anybody consuming the viewer to make adjustments to their build config, to enable
 * its import.
 *
 * Three.js doesn't mind the extension of the asset you load, so an .exr hidden behind
 * a .png will work just fine.
 */
export const DefaultViewerParams: ViewerParams = {
  postprocessing: false,
  reflections: true,
  showStats: false,
  environmentSrc: {
    src: sampleHdri,
    type: AssetType.TEXTURE_EXR
  }
}

export enum ViewerEvent {
  ObjectClicked = 'object-clicked',
  ObjectDoubleClicked = 'object-doubleclicked',
  LoadComplete = 'load-complete',
  LoadProgress = 'load-progress',
  UnloadComplete = 'unload-complete',
  UnloadAllComplete = 'unload-all-complete',
  Busy = 'busy'
}

export type SelectionEvent = {
  userData: Record<string, unknown>
  location: Vector3
  selectionCenter: Vector3
  multiple: boolean
}

export interface LightConfiguration {
  enabled?: boolean
  castShadow?: boolean
  intensity?: number
  color?: number
}

export interface SunLightConfiguration extends LightConfiguration {
  elevation?: number
  azimuth?: number
  radius?: number
}

export const DefaultLightConfiguration: SunLightConfiguration = {
  enabled: true,
  castShadow: true,
  intensity: 5,
  color: 0xffffff,
  elevation: 0.47,
  azimuth: 0,
  radius: 0
}

/**
 * Carried over from the old Viewer. To be extended/changed
 */
export interface IViewer {
  init(): Promise<void>
  on(eventType: ViewerEvent, handler: (arg) => void)
  toggleSectionBox(): void
  sectionBoxOff(): void
  sectionBoxOn(): void
  zoomExtents(fit?: number, transition?: boolean): void
  toggleCameraProjection(): void
  setLightConfiguration(config: LightConfiguration): void

  getViews()
  setView(id: string, transition: boolean)
  // This shouldn't be part of the API, it should be handled through `setView`
  rotateTo(side: string, transition: boolean)

  loadObject(url: string, token?: string, enableCaching?: boolean): Promise<void>
  cancelLoad(url: string, unload?: boolean): Promise<void>
  unloadObject(url: string): Promise<void>
  unloadAll(): Promise<void>

  screenshot(): Promise<string>

  /** Old Filtering members. Deprecated */
  applyFilter(filter: unknown): Promise<void>

  /** New Filtering members */
  getObjectProperties(resourceURL?: string): PropertyInfo[]
  showObjects(
    objectIds: string[],
    stateKey?: string,
    includeDescendants?
  ): Promise<FilteringState>
  hideObjects(
    objectIds: string[],
    stateKey?: string,
    includeDescendants?
  ): Promise<FilteringState>
  isolateObjects(
    objectIds: string[],
    stateKey?: string,
    includeDescendants?
  ): Promise<FilteringState>
  unIsolateObjects(
    objectIds: string[],
    stateKey?: string,
    includeDescendants?
  ): Promise<FilteringState>

  selectObjects(objectIds: string[]): Promise<void>
  resetSelection(): Promise<void>
  highlightObjects(objectIds: string[]): Promise<void>
  resetHighlight(): Promise<void>

  setColorFilter(prop: PropertyInfo): Promise<FilteringState>
  removeColorFilter(): Promise<FilteringState>
  resetFilters(): Promise<FilteringState>

  /** Data ops */
  getDataTree(): DataTree
  get World(): World

  dispose(): void
}
