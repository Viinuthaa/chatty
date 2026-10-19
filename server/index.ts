
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

app.use(
  cors({
    origin: allowedOrigins,
  }),
)
app.use(express.json())

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
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

  socket.on('room:join', (roomCode: string) => {
    if (
      typeof roomCode !== 'string' ||
      !/^[A-Z0-9]{4,8}$/.test(roomCode)
    ) {
      socket.emit('room:error', 'Invalid room code.')
      return
    }

    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.leave(room)
      }
    }

    socket.join(roomCode)
    socket.emit('room:joined', { roomCode })

    io.to(roomCode).emit('room:members', {
      count: io.sockets.adapter.rooms.get(roomCode)?.size ?? 0,
    })

    console.log(`${socket.id} joined room ${roomCode}`)
  })

  socket.on('room:leave', (roomCode: string) => {
    if (typeof roomCode !== 'string') return

    socket.leave(roomCode)

    io.to(roomCode).emit('room:members', {
      count: io.sockets.adapter.rooms.get(roomCode)?.size ?? 0,
    })
  })

  socket.on('disconnecting', () => {
    for (const roomCode of socket.rooms) {
      if (roomCode !== socket.id) {
        const remaining =
          io.sockets.adapter.rooms.get(roomCode)?.size ?? 1

        io.to(roomCode).emit('room:members', {
          count: Math.max(0, remaining - 1),
        })
      }
    }
  })

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`Chatty server running at http://localhost:${PORT}`)
})
