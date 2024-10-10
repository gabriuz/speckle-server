import {
  Color,
  DoubleSide,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  WebGLRenderTarget
} from 'three'
import { BaseGPass } from './GPass.js'
import { WorldTree } from '../../tree/WorldTree.js'
import { BatchUpdateRange, GeometryType } from '../../batching/Batch.js'
import SpeckleRenderer from '../../SpeckleRenderer.js'
import { MeshBatch } from '../../batching/MeshBatch.js'
import { NodeRenderView } from '../../tree/NodeRenderView.js'
import { MinimalMaterial } from '../../materials/Materials.js'
import SpeckleStandardColoredMaterial from '../../materials/SpeckleStandardColoredMaterial.js'
import { Assets } from '../../../index.js'
import SpeckleMesh from '../../objects/SpeckleMesh.js'

export class GBasitPass extends BaseGPass {
  public clear = false
  protected tree: WorldTree
  protected speckleRenderer: SpeckleRenderer
  protected materialMap: {
    [batchID: string]: [
      batch: MeshBatch,
      colorMap: Map<number, Array<NodeRenderView>>,
      material: SpeckleStandardColoredMaterial
    ]
  } = {}

  public constructor(tree: WorldTree, renderer: SpeckleRenderer) {
    super()
    this.tree = tree
    this.speckleRenderer = renderer

    this._outputTarget = new WebGLRenderTarget(256, 256, {
      minFilter: NearestFilter,
      magFilter: NearestFilter
    })
    /** On Chromium, on MacOS the 16 bit depth render buffer appears broken.
     *  We're not really using a stencil buffer at all, we're just forcing
     *  three.js to use a 24 bit depth render buffer
     */
    this._outputTarget.depthBuffer = true
    this._outputTarget.stencilBuffer = true
  }

  public get displayName(): string {
    return 'BASIT'
  }

  onBeforeRender = () => {
    const batches: MeshBatch[] = this.speckleRenderer.batcher.getBatches(
      undefined,
      GeometryType.MESH
    )

    for (let k = 0; k < batches.length; k++) {
      const batch: MeshBatch = batches[k]
      const colorMap: Map<number, Array<NodeRenderView>> = new Map()
      colorMap.set(0x888888, [])

      for (let i = 0; i < batch.renderViews.length; i++) {
        const rv = batch.renderViews[i]
        const colorMaterial: MinimalMaterial | null = rv.renderData.colorMaterial
        if (!colorMaterial) {
          const defaultColorEntry = colorMap.get(0x888888)
          if (defaultColorEntry) defaultColorEntry.push(rv) /** This is so dumb */
          continue
        }

        if (!colorMap.has(colorMaterial.color)) colorMap.set(colorMaterial.color, [])
        const entry = colorMap.get(colorMaterial.color)
        if (entry) entry.push(rv)
      }

      const rampTexture = Assets.generateDiscreetRampTexture(
        Array.from(colorMap.keys())
      )
      const material = new SpeckleStandardColoredMaterial(
        {
          side: DoubleSide,
          transparent: false,
          wireframe: false
        },
        ['USE_RTE']
      )
      material.clipShadows = true
      material.setGradientTexture(rampTexture)

      this.materialMap[batch.id] = [batch, colorMap, material]
    }
  }

  protected applyColorIndices() {
    for (const item in this.materialMap) {
      const batch = this.materialMap[item][0]
      const colorMap = this.materialMap[item][1]

      const updateRanges = []
      let rampIndex = 0
      for (const entry of colorMap.entries()) {
        const color = entry[0]
        updateRanges.push(
          ...entry[1].map((value: NodeRenderView) => {
            return {
              offset: value.batchStart,
              count: value.batchCount,
              materialOptions: {
                rampIndex: rampIndex / colorMap.size,
                rampIndexColor: new Color(color),
                rampWidth: entry[1].length * 4
              }
            } as BatchUpdateRange
          })
        )
        rampIndex++
      }
      batch.setBatchBuffers(updateRanges)
    }
  }

  protected overrideMaterials() {
    for (const k in this.materialMap) {
      const tuple = this.materialMap[k]
      ;(tuple[0].renderObject as SpeckleMesh).setOverrideMaterial(tuple[2])
    }
  }

  protected restoreMaterials() {
    for (const k in this.materialMap) {
      const tuple = this.materialMap[k]
      ;(tuple[0].renderObject as SpeckleMesh).restoreMaterial()
    }
  }

  public render(
    renderer: WebGLRenderer,
    camera: PerspectiveCamera | OrthographicCamera | null,
    scene?: Scene
  ): boolean {
    if (!camera || !scene) return false

    this.applyLayers(camera)

    this.applyColorIndices()
    this.overrideMaterials()

    renderer.setRenderTarget(this.outputTarget)

    if (this.clear) {
      renderer.setClearColor(0x000000)
      renderer.setClearAlpha(0.0)
      renderer.clear(true, true, true)
    }

    if (this.onBeforeRender) this.onBeforeRender()
    renderer.render(scene, camera)
    if (this.onAfterRender) this.onAfterRender()

    this.restoreMaterials()

    return false
  }
}
