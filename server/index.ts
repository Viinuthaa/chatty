
import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)

const PORT = Number(process.env.PORT) || 3001
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

app.use(cors({ origin: CLIENT_URL }))
app.use(express.json())

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
})

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Chatty server is running.',
  })
})

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`)

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Chatty server running at http://localhost:${PORT}`)
})
