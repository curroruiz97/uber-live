import { Router } from 'express'
import * as wa from '../lib/whatsappService.js'

function fail(res, e) {
  res.status(e.status || 500).json({ error: 'wa_error', message: e.message })
}

export function whatsappRouter() {
  const router = Router()

  router.get('/status', (req, res) => res.json(wa.getStatus()))

  router.post('/connect', async (req, res) => {
    try {
      res.json(await wa.connect())
    } catch (e) {
      fail(res, e)
    }
  })

  router.post('/disconnect', async (req, res) => {
    try {
      res.json(await wa.disconnect())
    } catch (e) {
      fail(res, e)
    }
  })

  router.post('/send', async (req, res) => {
    try {
      const { phone, message } = req.body || {}
      res.json({ ok: true, ...(await wa.sendMessage(phone, message)) })
    } catch (e) {
      fail(res, e)
    }
  })

  return router
}
