import { OrthographicCamera, PerspectiveCamera } from 'three'
import { ObjectLayers } from '../../../index.js'
import SpeckleRenderer from '../../SpeckleRenderer.js'
import { GColorPass } from './GColorPass.js'
import { DepthType, GDepthPass } from './GDepthPass.js'
import { GPass, ObjectVisibility, ProgressiveGPass } from './GPass.js'
import { GPipeline } from './GPipeline.js'
import { GProgressiveAOPass } from './GProgressiveAOPass.js'
import { GBlendPass } from './GBlendPass.js'
import { GNormalsPass } from './GNormalPass.js'
import { GOutputPass, InputType } from './GOutputPass.js'

export class DefaultPipeline extends GPipeline {
  protected accumulationFrameIndex: number = 0
  protected accumulationFrameCount: number = 16
  protected dynamicStage: Array<GPass> = []
  protected progressiveStage: Array<GPass> = []

  constructor(speckleRenderer: SpeckleRenderer) {
    super(speckleRenderer)

    const depthPass = new GDepthPass()
    depthPass.depthType = DepthType.LINEAR_DEPTH
    depthPass.setLayers([ObjectLayers.STREAM_CONTENT_MESH])
    depthPass.setVisibility(ObjectVisibility.DEPTH)

    const normalPass = new GNormalsPass()
    normalPass.setLayers([ObjectLayers.STREAM_CONTENT_MESH])
    normalPass.setVisibility(ObjectVisibility.OPAQUE)
    normalPass.setJitter(true)

    const outputPass = new GOutputPass()
    outputPass.setTexture('tDiffuse', normalPass.outputTarget?.texture)
    outputPass.setInputType(InputType.Normals)

    const opaqueColorPass = new GColorPass()
    opaqueColorPass.setLayers([
      ObjectLayers.PROPS,
      ObjectLayers.STREAM_CONTENT,
      ObjectLayers.STREAM_CONTENT_MESH,
      ObjectLayers.STREAM_CONTENT_LINE,
      ObjectLayers.STREAM_CONTENT_POINT,
      ObjectLayers.STREAM_CONTENT_POINT_CLOUD,
      ObjectLayers.STREAM_CONTENT_TEXT,
      ObjectLayers.SHADOWCATCHER
    ])
    opaqueColorPass.setVisibility(ObjectVisibility.OPAQUE)

    const transparentColorPass = new GColorPass()
    transparentColorPass.setLayers([
      ObjectLayers.PROPS,
      ObjectLayers.STREAM_CONTENT,
      ObjectLayers.STREAM_CONTENT_MESH,
      ObjectLayers.STREAM_CONTENT_LINE,
      ObjectLayers.STREAM_CONTENT_POINT,
      ObjectLayers.STREAM_CONTENT_POINT_CLOUD,
      ObjectLayers.STREAM_CONTENT_TEXT,
      ObjectLayers.SHADOWCATCHER
    ])
    transparentColorPass.setVisibility(ObjectVisibility.TRANSPARENT)

    const progressiveAOPass = new GProgressiveAOPass()
    progressiveAOPass.setTexture('tDepth', depthPass.outputTarget?.texture)
    progressiveAOPass.accumulationFrames = this.accumulationFrameCount

    const blendPass = new GBlendPass()
    blendPass.setTexture('tDiffuse', progressiveAOPass.outputTarget?.texture)
    blendPass.accumulationFrames = this.accumulationFrameCount

    this.dynamicStage.push(opaqueColorPass, transparentColorPass)
    this.progressiveStage.push(
      depthPass,
      normalPass,
      opaqueColorPass,
      transparentColorPass,
      progressiveAOPass,
      blendPass
    )

    this.passList = this.dynamicStage
  }

  public update(camera: PerspectiveCamera | OrthographicCamera): void {
    this.passList.forEach((pass: GPass) => {
      pass.enabled && pass.update?.(camera)
      if (pass instanceof ProgressiveGPass) {
        pass.frameIndex = this.accumulationFrameIndex
      }
    })
    this.accumulationFrameIndex++

    if (this.accumulationFrameIndex === this.accumulationFrameCount)
      this.onAccumulationComplete()
  }

  public resize(width: number, height: number) {
    this.dynamicStage.forEach((pass: GPass) => pass.setSize?.(width, height))
    this.progressiveStage.forEach((pass: GPass) => pass.setSize?.(width, height))
    this.passList.forEach((pass: GPass) => pass.setSize?.(width, height))
  }

  public onStationaryBegin() {
    this.accumulationFrameIndex = 0
    this.passList = this.progressiveStage
  }

  public onStationaryEnd() {
    this.passList = this.dynamicStage
  }

  public onAccumulationComplete() {
    console.warn('Accumulation Complete')
  }
}
