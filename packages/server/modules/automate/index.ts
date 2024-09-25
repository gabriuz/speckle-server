import { moduleLogger } from '@/logging/logging'
import { Optional, SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import { VersionEvents, VersionsEmitter } from '@/modules/core/events/versionsEmitter'
import {
  onModelVersionCreateFactory,
  triggerAutomationRevisionRunFactory
} from '@/modules/automate/services/trigger'
import {
  getActiveTriggerDefinitionsFactory,
  getAutomationFactory,
  getAutomationRevisionFactory,
  getAutomationRunFullTriggersFactory,
  getAutomationTokenFactory,
  getFullAutomationRevisionMetadataFactory,
  getFullAutomationRunByIdFactory,
  upsertAutomationRunFactory
} from '@/modules/automate/repositories/automations'
import { Scopes } from '@speckle/shared'
import { registerOrUpdateScopeFactory } from '@/modules/shared/repositories/scopes'
import { triggerAutomationRun } from '@/modules/automate/clients/executionEngine'
import logStreamRest from '@/modules/automate/rest/logStream'
import {
  getEncryptionKeyPairFor,
  getFunctionInputDecryptorFactory
} from '@/modules/automate/services/encryption'
import { buildDecryptor } from '@/modules/shared/utils/libsodium'
import {
  setupAutomationUpdateSubscriptionsFactory,
  setupStatusUpdateSubscriptionsFactory
} from '@/modules/automate/services/subscriptions'
import { setupRunFinishedTrackingFactory } from '@/modules/automate/services/tracking'
import authGithubAppRest from '@/modules/automate/rest/authGithubApp'
import { getFeatureFlags } from '@/modules/shared/helpers/envHelper'
import { getUserById } from '@/modules/core/services/users'
import { getCommit } from '@/modules/core/repositories/commits'
import { TokenScopeData } from '@/modules/shared/domain/rolesAndScopes/types'
import db from '@/db/knex'
import { AutomationsEmitter } from '@/modules/automate/events/automations'
import { publish } from '@/modules/shared/utils/subscriptions'
import { AutomateRunsEmitter } from '@/modules/automate/events/runs'
import { createAppToken } from '@/modules/core/services/tokens'

const { FF_AUTOMATE_MODULE_ENABLED } = getFeatureFlags()
let quitListeners: Optional<() => void> = undefined

async function initScopes() {
  const scopes: TokenScopeData[] = [
    {
      name: Scopes.Automate.ReportResults,
      description: 'Report automation results to the server.',
      public: true
    },
    {
      name: Scopes.AutomateFunctions.Read,
      description: 'See available Speckle Automate functions.',
      public: true
    },
    {
      name: Scopes.AutomateFunctions.Write,
      description: 'Create and manage Speckle Automate functions.',
      public: true
    }
  ]

  const registerFunc = registerOrUpdateScopeFactory({ db })
  for (const scope of scopes) {
    await registerFunc({ scope })
  }
}

const initializeEventListeners = () => {
  const getAutomationRunFullTriggers = getAutomationRunFullTriggersFactory({ db })
  const getFullAutomationRevisionMetadata = getFullAutomationRevisionMetadataFactory({
    db
  })

  const triggerFn = triggerAutomationRevisionRunFactory({
    automateRunTrigger: triggerAutomationRun,
    getEncryptionKeyPairFor,
    getFunctionInputDecryptor: getFunctionInputDecryptorFactory({
      buildDecryptor
    }),
    createAppToken,
    automateRunsEmitter: AutomateRunsEmitter.emit,
    getAutomationToken: getAutomationTokenFactory({ db }),
    upsertAutomationRun: upsertAutomationRunFactory({ db }),
    getFullAutomationRevisionMetadata
  })
  const setupStatusUpdateSubscriptionsInvoke = setupStatusUpdateSubscriptionsFactory({
    getAutomationRunFullTriggers,
    publish,
    automateRunsEventsListener: AutomateRunsEmitter.listen
  })
  const setupAutomationUpdateSubscriptionsInvoke =
    setupAutomationUpdateSubscriptionsFactory({
      automationsEmitterListen: AutomationsEmitter.listen,
      publish
    })
  const setupRunFinishedTrackingInvoke = setupRunFinishedTrackingFactory({
    getFullAutomationRevisionMetadata,
    getUserById,
    getCommit,
    getFullAutomationRunById: getFullAutomationRunByIdFactory({ db }),
    automateRunsEventListener: AutomateRunsEmitter.listen
  })
  const getAutomation = getAutomationFactory({ db })
  const getAutomationRevision = getAutomationRevisionFactory({ db })
  const getActiveTriggerDefinitions = getActiveTriggerDefinitionsFactory({ db })

  const quitters = [
    VersionsEmitter.listen(
      VersionEvents.Created,
      async ({ modelId, version, projectId }) => {
        await onModelVersionCreateFactory({
          getAutomation,
          getAutomationRevision,
          getTriggers: getActiveTriggerDefinitions,
          triggerFunction: triggerFn
        })({ modelId, versionId: version.id, projectId })
      }
    ),
    setupStatusUpdateSubscriptionsInvoke(),
    setupAutomationUpdateSubscriptionsInvoke(),
    setupRunFinishedTrackingInvoke()
  ]

  return () => {
    quitters.forEach((quit) => quit())
  }
}

const automateModule: SpeckleModule = {
  async init(app, isInitial) {
    if (!FF_AUTOMATE_MODULE_ENABLED) return
    moduleLogger.info('⚙️  Init automate module')

    await initScopes()
    logStreamRest(app)
    authGithubAppRest(app)

    if (isInitial) {
      quitListeners = initializeEventListeners()
    }
  },
  shutdown() {
    if (!FF_AUTOMATE_MODULE_ENABLED) return
    quitListeners?.()
  }
}

export = automateModule
