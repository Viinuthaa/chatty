
import cors from 'cors'
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)

const PORT = Number(process.env.PORT) || 3001

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

type ChatMessage = {
  id: string
  roomCode: string
  text: string
  senderId: string
  senderName: string
  createdAt: string
}

type ClientToServerEvents = {
  'room:join': (
    data: { roomCode: string; senderName: string },
  ) => void
  'room:leave': (roomCode: string) => void
  'message:send': (
    message: { id: string; text: string; senderId: string },
    callback?: (result: { ok: boolean; error?: string }) => void,
  ) => void
}

type ServerToClientEvents = {
  'room:joined': (data: { roomCode: string }) => void
  'room:members': (data: { count: number }) => void
  'room:error': (message: string) => void
  'message:new': (message: ChatMessage) => void
}

const io = new Server<ClientToServerEvents, ServerToClientEvents>(
  httpServer,
  {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  },
)

const participantNames = new Map<string, string>()

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Chatty server is running.',
  })
})

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`)

  socket.on('room:join', ({ roomCode, senderName }) => {
    if (
      typeof roomCode !== 'string' ||
      !/^[A-Z0-9]{4,8}$/.test(roomCode)
    ) {
      socket.emit('room:error', 'Invalid room code.')
      return
    }

    if (typeof senderName !== 'string' || !senderName.trim()) {
      socket.emit('room:error', 'Please choose a display name.')
      return
    }

    const name = senderName.trim().slice(0, 24)
    participantNames.set(socket.id, name)

    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.leave(room)
        io.to(room).emit('room:members', {
          count: io.sockets.adapter.rooms.get(room)?.size ?? 0,
        })
      }
    }

    socket.join(roomCode)
    socket.emit('room:joined', { roomCode })

    io.to(roomCode).emit('room:members', {
      count: io.sockets.adapter.rooms.get(roomCode)?.size ?? 0,
    })

    console.log(`${name} joined room ${roomCode}`)
  })

  socket.on('room:leave', (roomCode) => {
    if (typeof roomCode !== 'string') return

    socket.leave(roomCode)

    io.to(roomCode).emit('room:members', {
      count: io.sockets.adapter.rooms.get(roomCode)?.size ?? 0,
    })
  })

  socket.on('message:send', (message, callback) => {
    const roomCode = [...socket.rooms].find((room) => room !== socket.id)
    const senderName = participantNames.get(socket.id)

    if (!roomCode || !senderName) {
      callback?.({
        ok: false,
        error: 'Join a room with a display name before sending messages.',
      })
      return
    }

    if (
      !message ||
      typeof message.id !== 'string' ||
      message.id.length > 100 ||
      typeof message.text !== 'string' ||
      !message.text.trim() ||
      message.text.length > 2000 ||
      typeof message.senderId !== 'string' ||
      message.senderId.length > 100
    ) {
      callback?.({ ok: false, error: 'Invalid message.' })
      return
    }

    const chatMessage: ChatMessage = {
      id: message.id,
      roomCode,
      text: message.text.trim(),
      senderId: socket.id,
      senderName,
      createdAt: new Date().toISOString(),
    }

    io.to(roomCode).emit('message:new', chatMessage)
    callback?.({ ok: true })
  })

  socket.on('disconnecting', () => {
    for (const roomCode of socket.rooms) {
      if (roomCode !== socket.id) {
        const remaining =
          (io.sockets.adapter.rooms.get(roomCode)?.size ?? 1) - 1

        io.to(roomCode).emit('room:members', {
          count: Math.max(0, remaining),
        })
      }
    }
  })

  socket.on('disconnect', () => {
    participantNames.delete(socket.id)
    console.log(`Disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Chatty server running at http://localhost:${PORT}`)
})
