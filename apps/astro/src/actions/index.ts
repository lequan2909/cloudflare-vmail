import { encodeJWTSecret, generateNewMailAddr, genToken } from '@/lib/utils'
import { ActionError, defineAction } from 'astro:actions'
import { z } from 'astro:schema'
import * as DAO from 'database/dao'
import { getCloudflareD1 } from 'database/db'
import * as jose from 'jose'

// 定义统一的错误类型
const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

// Session类型定义
export interface MailboxSession {
  mailbox: string
  token: string
  expiresAt: number // 新增过期时间
}

// 辅助函数：验证会话
async function validateSession(session: MailboxSession | undefined, jwtSecret: string): Promise<boolean> {
  if (!session || !session.mailbox || !session.token || !session.expiresAt) {
    return false
  }

  if (Date.now() > session.expiresAt) {
    return false
  }

  try {
    await jose.jwtVerify(session.token, encodeJWTSecret(jwtSecret))
    return true
  }
  catch {
    return false
  }
}

export const server = {
  getEmailsByMessageToWho: defineAction({
    handler: async (_, ctx) => {
      try {
        const db = getCloudflareD1(ctx.locals.runtime.env.DB)
        const mailbox = ctx.cookies.get('mailbox')?.json() as MailboxSession

        const isValidSession = await validateSession(
          mailbox,
          ctx.locals.runtime.env.JWT_SECRET,
        )

        if (!isValidSession) {
          throw new ActionError({
            code: ErrorCodes.UNAUTHORIZED,
            message: 'Invalid or expired session',
          })
        }

        const emails = await Promise.race([
          DAO.getEmailsByMessageTo(db, mailbox.mailbox),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 5000),
          ),
        ])

        return emails
      }
      catch (error) {
        throw new ActionError({
          code: ErrorCodes.NOT_FOUND,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        })
      }
    },
  }),
  getEmailByIdOfAEmail: defineAction({
    input: z.object({
      id: z.string(),
    }),
    handler: async (input, ctx) => {
      const db = getCloudflareD1(ctx.locals.runtime.env.DB)
      const mailbox = (await DAO.getEmailByIdOfAEmail(db, input.id))?.messageTo

      if (!mailbox) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: 'mailbox not found',
        })
      }

      const token = await genToken(mailbox, ctx.locals.runtime.env.JWT_SECRET)
      const expiresAt = Date.now()
        + (ctx.locals.runtime.env.COOKIE_EXPIRES_IN_SECONDS || 86400) * 1000

      const session: MailboxSession = {
        mailbox,
        token,
        expiresAt,
      }

      ctx.cookies.set('mailbox', session, {
        httpOnly: true,
        maxAge: ctx.locals.runtime.env.COOKIE_EXPIRES_IN_SECONDS || 86400,
        path: '/',
      })

      return mailbox
    },
  }),
  getEmail: defineAction({
    input: z.object({
      id: z.string(),
    }),
    handler: async (input, ctx) => {
      const db = getCloudflareD1(ctx.locals.runtime.env.DB)
      return await DAO.getEmail(db, input.id)
    },
  }),
  generateNewMailbox: defineAction({
    accept: 'form',
    input: z.object({
      'cf-turnstile-response': z.string().min(1),
      'domain': z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i),
    }),
    handler: async (input, ctx) => {
      try {
        // Turnstile验证
        const verification = await verifyTurnstile(
          input['cf-turnstile-response'],
          ctx.locals.runtime.env.TURNSTILE_SECRET,
        )

        if (!verification.success) {
          throw new ActionError({
            code: ErrorCodes.UNAUTHORIZED,
            message: 'Turnstile verification failed',
          })
        }

        const newMailbox = generateNewMailAddr(input.domain)
        const token = await genToken(newMailbox, ctx.locals.runtime.env.JWT_SECRET)

        const expiresAt = Date.now()
          + (ctx.locals.runtime.env.COOKIE_EXPIRES_IN_SECONDS || 86400) * 1000

        const session: MailboxSession = {
          mailbox: newMailbox,
          token,
          expiresAt,
        }

        ctx.cookies.set('mailbox', session, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: ctx.locals.runtime.env.COOKIE_EXPIRES_IN_SECONDS || 86400,
          path: '/',
        })

        return newMailbox
      }
      catch (error) {
        throw new ActionError({
          code: ErrorCodes.NOT_FOUND,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        })
      }
    },
  }),
  deleteAllEmailsByMessageTo: defineAction({
    handler: async (_, ctx) => {
      const db = getCloudflareD1(ctx.locals.runtime.env.DB)
      const mailbox = ctx.cookies.get('mailbox')?.json() as MailboxSession

      if (!mailbox) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: 'mailbox not found',
        })
      }

      await jose.jwtVerify(
        mailbox.token,
        encodeJWTSecret(ctx.locals.runtime.env.JWT_SECRET),
      )

      return await DAO.deleteAllEmailsByMessageTo(db, mailbox.mailbox)
    },
  }),
  // sendEmail: defineAction({
  //   input: z.object({
  //     to: z.string().email(),
  //     subject: z.string(),
  //     content: z.string(),
  //     bcc: z.string().optional(),
  //     cc: z.string().optional(),
  //     name: z.string(),
  //   }),
  //   async handler(input, ctx) {
  //     const Env = ctx.locals.runtime.env
  //     const { mailbox, token } = ctx.cookies
  //       .get('mailbox')
  //       ?.json() as MailboxSession
  //     if (!mailbox) {
  //       throw new ActionError({
  //         code: 'NOT_FOUND',
  //         message: 'mailbox not found',
  //       })
  //     }

  //     await jose.jwtVerify(token, encodeJWTSecret(Env.JWT_SECRET))

  //     const sender = mailbox.split('@')
  //     sender[1] = Env.MAILGUN_SEND_DOMAIN

  //     const mailgun = new Mailgun(FormData)
  //     const mailgunClient = mailgun.client({
  //       username: 'api',
  //       key: Env.MAILGUN_API_KEY,
  //     })

  //     await mailgunClient.messages.create(Env.MAILGUN_SEND_DOMAIN, {
  //       from: `${input.name} <${sender.join('@')}>`,
  //       to: input.to.split(','),
  //       subject: input.subject,
  //       html: input.content,
  //       bcc: input.bcc,
  //       cc: input.cc,
  //     })
  //   },
  // }),
  exit: defineAction({
    handler: async (_, ctx) => {
      ctx.cookies.set(
        'mailbox',
        {
          mailbox: '',
          token: '',
        },
        { maxAge: 1, path: '/' },
      )
    },
  }),
}

// 辅助函数：验证 Turnstile
async function verifyTurnstile(token: string, secret: string) {
  const formData = new FormData()
  formData.append('secret', secret)
  formData.append('response', token)

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      body: formData,
      method: 'POST',
      signal: AbortSignal.timeout(3000), // 3秒超时
    },
  )

  return z.object({
    'success': z.boolean(),
    'error-codes': z.array(z.string()).optional(),
  }).parse(await response.json())
}
