import {
  ProjectsEmitter,
  ProjectEvents,
  ProjectEventsPayloads
} from '@/modules/core/events/projectsEmitter'
import { getStream } from '@/modules/core/repositories/streams'
import {
  GetWorkspaceRoles,
  GetWorkspaceRoleToDefaultProjectRoleMapping
} from '@/modules/workspaces/domain/operations'
import {
  ServerInvitesEvents,
  ServerInvitesEventsPayloads
} from '@/modules/serverinvites/domain/events'
import {
  isProjectResourceTarget,
  resolveTarget
} from '@/modules/serverinvites/helpers/core'
import { logger } from '@/logging/logging'
import { updateWorkspaceRoleFactory } from '@/modules/workspaces/services/management'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { WorkspaceInviteResourceType } from '@/modules/workspaces/domain/constants'
import { Roles } from '@speckle/shared'
import { UpsertProjectRole } from '@/modules/core/domain/projects/operations'

export const onProjectCreatedFactory =
  ({
    getWorkspaceRoles,
    upsertProjectRole,
    getDefaultWorkspaceProjectRoleMapping
  }: {
    getWorkspaceRoles: GetWorkspaceRoles
    upsertProjectRole: UpsertProjectRole
    getDefaultWorkspaceProjectRoleMapping: GetWorkspaceRoleToDefaultProjectRoleMapping
  }) =>
  async (payload: ProjectEventsPayloads[typeof ProjectEvents.Created]) => {
    const { id: projectId, workspaceId } = payload.project

    if (!workspaceId) {
      return
    }

    const workspaceMembers = await getWorkspaceRoles({ workspaceId })

    const defaultRoleMapping = await getDefaultWorkspaceProjectRoleMapping({
      workspaceId
    })

    await Promise.all(
      workspaceMembers.map(({ userId, role: workspaceRole }) => {
        const projectRole = defaultRoleMapping[workspaceRole]

        // we do not need to assign new roles to the project owner
        if (userId === payload.ownerId) return
        // Guests do not get roles on project create
        if (!projectRole || workspaceRole === Roles.Workspace.Guest) return

        return upsertProjectRole({
          projectId,
          userId,
          role: projectRole
        })
      })
    )
  }

export const onInviteFinalizedFactory =
  (deps: {
    getStream: typeof getStream
    logger: typeof logger
    updateWorkspaceRole: ReturnType<typeof updateWorkspaceRoleFactory>
  }) =>
  async (
    payload: ServerInvitesEventsPayloads[typeof ServerInvitesEvents.Finalized]
  ) => {
    const { invite, accept } = payload

    const resourceTarget = invite.resource
    if (!accept || !isProjectResourceTarget(resourceTarget)) {
      return
    }
    const targetUserId = resolveTarget(invite.target).userId!

    const project = await deps.getStream({
      streamId: resourceTarget.resourceId,
      userId: targetUserId
    })
    if (!project || !project.role) {
      deps.logger.warn(
        `When handling accepted invite - project not found or useris not a collaborator`,
        { invite, project: { id: project?.id, role: project?.role } }
      )
      return
    }
    if (!project.workspaceId) return

    const workspaceRole =
      resourceTarget.secondaryResourceRoles?.[WorkspaceInviteResourceType] ||
      Roles.Workspace.Guest

    // Add user to workspace
    await deps.updateWorkspaceRole({
      role: workspaceRole,
      userId: targetUserId,
      workspaceId: project.workspaceId,
      skipProjectRoleUpdatesFor: [project.id]
    })
  }

export const initializeEventListenersFactory =
  ({
    onProjectCreated,
    onInviteFinalized
  }: {
    onProjectCreated: ReturnType<typeof onProjectCreatedFactory>
    onInviteFinalized: ReturnType<typeof onInviteFinalizedFactory>
  }) =>
  () => {
    const quitCbs = [
      ProjectsEmitter.listen(ProjectEvents.Created, onProjectCreated),
      getEventBus().listen(ServerInvitesEvents.Finalized, ({ payload }) =>
        onInviteFinalized(payload)
      )
    ]

    return () => quitCbs.forEach((quit) => quit())
  }
