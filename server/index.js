import 'dotenv/config'
import { createApp } from './app.js'

const PORT = Number(process.env.PORT) || 3001

createApp().listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] API lista en http://localhost:${PORT}/api  (uber)`)
})
