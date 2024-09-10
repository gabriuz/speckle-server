import { EmailVerificationRecord } from '@/modules/emails/repositories'

export type GetPendingToken = (params: {
  token?: string
  email?: string
}) => Promise<EmailVerificationRecord | undefined>
