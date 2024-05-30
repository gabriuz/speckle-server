/* eslint-disable @typescript-eslint/require-await */

import { BaseBridge } from '~~/lib/bridge/base'
import { IBinding } from '~~/lib/bindings/definitions/IBinding'
import { IModelCard, IModelCardSharedEvents } from '~~/lib/models/card'

export const IBasicConnectorBindingKey = 'baseBinding'

// Needs to be agreed between Frontend and Core
export interface IBasicConnectorBinding
  extends IBinding<IBasicConnectorBindingHostEvents> {
  // Various
  getSourceApplicationName: () => Promise<string>
  getSourceApplicationVersion: () => Promise<string>
  getConnectorVersion: () => Promise<string>
  getDocumentInfo: () => Promise<DocumentInfo>

  // Document state calls
  getDocumentState: () => Promise<DocumentModelStore>
  addModel: (model: IModelCard) => Promise<void>
  updateModel: (model: IModelCard) => Promise<void>
  highlightModel: (modelCardId: string) => Promise<void>
  highlightObjects: (objectIds: string[]) => Promise<void>
  removeModel: (model: IModelCard) => Promise<void>
}

export interface IBasicConnectorBindingHostEvents extends IModelCardSharedEvents {
  documentChanged: () => void
}

export type DocumentModelStore = {
  models: IModelCard[]
}

export type DocumentInfo = {
  location: string
  name: string
  id: string
  message?: string
}

export type ToastInfo = {
  modelCardId: string
  text: string
  level: 'info' | 'danger' | 'warning' | 'success'
  action?: ToastAction
  timeout?: number
}

export type ToastAction = {
  url: string
  name: string
}

export class MockedBaseBinding extends BaseBridge {
  constructor() {
    super()
  }

  private documentModelStore: IModelCard[] = [
    {
      typeDiscriminator: 'SenderModelCard',
      modelCardId: 'sender_test',
      projectId: useRuntimeConfig().public.speckleSampleProjectId,
      modelId: useRuntimeConfig().public.speckleSampleModelId,
      accountId: useRuntimeConfig().public.speckleAccountId,
      expired: false,
      lastLocalUpdate: '',
      notifications: [],
      sendFilter: {
        name: 'Selection',
        selectedObjectIds: ['test'],
        summary: 'Test',
        typeDiscriminator: 'RhinoSelectionFilter'
      },
      settings: [
        {
          id: 'includeAttributes',
          type: 'boolean',
          title: 'Include Attributes',
          value: true,
          typeDiscriminator: 'CardSetting'
        }
      ]
    } as IModelCard,
    {
      typeDiscriminator: 'ReceiverModelCard',
      modelCardId: 'receiver_test',
      projectId: useRuntimeConfig().public.speckleSampleProjectId,
      modelId: useRuntimeConfig().public.speckleSampleModelId,
      accountId: useRuntimeConfig().public.speckleAccountId,
      expired: false,
      lastLocalUpdate: '',
      notifications: [],
      settings: [
        {
          id: 'includeAttributes',
          type: 'boolean',
          title: 'Include Attributes',
          value: true,
          typeDiscriminator: 'CardSetting'
        },
        {
          id: 'mergeCoplanarFaces',
          type: 'boolean',
          title: 'Merge Coplanar Faces',
          value: true,
          typeDiscriminator: 'CardSetting'
        },
        {
          id: 'receiveMode',
          type: 'string',
          title: 'Receive Mode',
          value: 'Update',
          enum: ['Update', 'Create', 'Ignore'],
          typeDiscriminator: 'CardSetting'
        }
      ]
    } as IModelCard
  ]

  public addModel(model: IModelCard) {
    this.documentModelStore = this.documentModelStore.concat([model])
  }

  public removeModel(model: IModelCard) {
    const modelIndex = this.documentModelStore.findIndex(
      (m) => m.modelCardId === model.modelCardId
    )
    if (modelIndex > -1) {
      this.documentModelStore = this.documentModelStore.splice(modelIndex, 1)
    }
  }

  public updateModel(model: IModelCard) {
    const modelIndex = this.documentModelStore.findIndex(
      (m) => m.modelId === model.modelId
    )
    this.documentModelStore[modelIndex] = model
  }

  public getConnectorVersion() {
    return '0.0.0'
  }

  public getSourceApplicationName() {
    return 'Mock'
  }

  public getSourceApplicationVersion() {
    return Math.random().toString()
  }

  public getDocumentInfo() {
    return {
      name: 'Mocked File',
      location: 'www',
      id: Math.random().toString()
    }
  }

  public getDocumentState() {
    return {
      models: this.documentModelStore
    }
  }

  public showDevTools() {
    console.log('Mocked bindings cannot do this')
  }
}
