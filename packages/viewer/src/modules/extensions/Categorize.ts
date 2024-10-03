import { BatchObject } from '@speckle/viewer'
import { ObjectLayers } from '@speckle/viewer'
import { Extension, IViewer, TreeNode } from '@speckle/viewer'
import { NodeRenderView } from '@speckle/viewer'
import { Box3Helper, Color, Matrix4, Vector3, Box3 } from 'three'
import potpack from 'potpack'

/** Simple animation data interface */
interface Animation {
  target: BatchObject
  start: Vector3
  end: Vector3
  current: Vector3
  radialEnd: Vector3
  time: number
}

export class Categorize extends Extension {
  /** We'll store our animations here */
  private animations: Animation[] = []
  /** We'll store the boxes for the categories here */

  /** Animation params */
  private readonly animTimeScale: number = 0.25

  public constructor(viewer: IViewer) {
    super(viewer)
  }

  /** We're tying in to the viewer core's frame event */
  public onLateUpdate(deltaTime: number) {
    if (!this.animations.length) return

    let animCount = 0
    for (let k = 0; k < this.animations.length; k++) {
      /** Animation finished, no need to update it */
      if (this.animations[k].time === 1) {
        continue
      }
      /** Compute the next animation time value */
      const t = this.animations[k].time + deltaTime * this.animTimeScale
      /** Clamp it to 1 */
      this.animations[k].time = Math.min(t, 1)
      /** Compute current position value based on animation time */
      const valueL = new Vector3().copy(this.animations[k].start).lerp(
        this.animations[k].end,
        this.easeOutQuart(this.animations[k].time) // Added easing
      )
      const valueR = new Vector3().copy(this.animations[k].start).lerp(
        this.animations[k].radialEnd,
        this.easeOutQuart(this.animations[k].time) // Added easing
      )
      const value = new Vector3().lerpVectors(
        valueR,
        valueL,
        this.easeOutQuart(this.animations[k].time)
      )
      /** Apply the translation */
      this.animations[k].target.transformTRS(value, undefined, undefined, undefined)
      animCount++
    }

    /** If any animations updated, request a render */
    if (animCount) this.viewer.requestRender()
  }

  public onRender() {
    // NOT IMPLEMENTED for this example
  }
  public onResize() {
    // NOT IMPLEMENTED for this example
  }

  public play() {
    for (let k = 0; k < this.animations.length; k++) {
      this.animations[k].time = 0
    }
  }
  /** Example's main function */
  public async run() {
    const categories: { [id: string]: TreeNode[] } = {}

    await this.viewer.getWorldTree().walkAsync((node: TreeNode) => {
      if (!node.model.atomic || this.viewer.getWorldTree().isRoot(node)) return true
      const category = node.model.raw.category
      if (category) {
        if (!categories[category]) {
          categories[category] = []
        }
        categories[category].push(node)
      }
      return true
    })

    /** We go over each category */
    const finalBoxes = Array<{ category: string; obj: BatchObject; box: Box3 }>()
    const categoryBoxes = []
    const origin = new Vector3(50, 50, 0)
    const padding = 0.5
    const categoryPadding = 5
    for (const cat in categories) {
      const group = categories[cat]
      const groupBoxes: {
        obj: BatchObject
        w: number
        h: number
        x: number
        y: number
      }[] = []

      /** We go over each node in the category */
      for (let k = 0; k < group.length; k++) {
        const node = group[k]
        /** Get the render views */
        const rvs = this.viewer
          .getWorldTree()
          .getRenderTree()
          .getRenderViewsForNode(node)

        /** Get the batch objects which we'll animate */
        const objects = rvs.map((rv: NodeRenderView) => {
          return this.viewer.getRenderer().getObject(rv)
        })

        /** Compute the union of all the batch objects bounds in the node */
        objects.forEach((obj: BatchObject | null) => {
          if (!obj) return
          const aabbSize = obj?.aabb.getSize(new Vector3())
          groupBoxes.push({
            obj,
            w: aabbSize.x + padding,
            h: aabbSize.y + padding,
            x: 0,
            y: 0
          })
        })
      }
      const { w, h, fill } = potpack(groupBoxes)
      categoryBoxes.push({
        category: cat,
        w: w + categoryPadding,
        h: h + categoryPadding,
        x: 0,
        y: 0
      })
      console.warn('Groups size -> ', cat, ':', w, h, fill)
      for (let k = 0; k < groupBoxes.length; k++) {
        const box = new Box3(
          new Vector3(groupBoxes[k].x + origin.x, groupBoxes[k].y + origin.y, 0),
          new Vector3(
            groupBoxes[k].x + origin.x + groupBoxes[k].w,

            groupBoxes[k].y + origin.y + groupBoxes[k].h,
            0
          )
        )
        finalBoxes.push({
          category: cat,
          obj: groupBoxes[k].obj,
          box
        })
      }
      //   offset += w + 5
    }
    potpack(categoryBoxes)

    for (let k = 0; k < finalBoxes.length; k++) {
      const categoryBox = categoryBoxes.find(
        (value) => value.category === finalBoxes[k].category
      )
      if (!categoryBox) return

      const box = finalBoxes[k].box.applyMatrix4(
        new Matrix4().makeTranslation(categoryBox.x, categoryBox.y, 0)
      )
      const boxHelper = new Box3Helper(box, new Color(0x047efb))
      /** Set the layers to PROPS, so that AO and interactions will ignore them */
      boxHelper.layers.set(ObjectLayers.OVERLAY)
      boxHelper.frustumCulled = false
      /** Add the BoxHelper to the scene */
      this.viewer.getRenderer().scene.add(boxHelper)
      const bObj = finalBoxes[k].obj
      const boxCenter = box.getCenter(new Vector3())
      const aabbCenter = bObj.aabb.getCenter(new Vector3())
      const aabbSize = bObj.aabb.getSize(new Vector3())
      const finalPos = new Vector3()
        .copy(boxCenter)
        .sub(aabbCenter.sub(new Vector3(0, 0, aabbSize.z * 0.5)))

      const theta = Math.random() * 2 * Math.PI
      const radius = Math.random() * 150
      const x = radius * Math.cos(theta)
      const y = radius * Math.sin(theta)

      const finalRadial = boxCenter.sub(new Vector3(x, y, 0))
      this.animations.push({
        target: finalBoxes[k].obj,
        start: new Vector3(),
        end: finalPos,
        current: new Vector3(),
        time: 0,
        radialEnd: finalRadial
      })
      //   finalBoxes[k].obj.transformTRS(finalPos)
    }
  }

  private easeOutQuart(x: number): number {
    return 1 - Math.pow(1 - x, 4)
  }
}
