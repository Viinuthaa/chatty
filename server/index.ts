
import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)

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

type Participant = {
  id: string
  name: string
}

type ChatMessage = {
  id: string
  roomCode: string
  text: string
  senderId: string
  senderName: string
  createdAt: string
}

type ClientToServerEvents = {
  'room:join': (data: { roomCode: string; senderName: string }) => void
  'room:leave': (roomCode: string) => void
  'message:send': (
    message: { id: string; text: string; senderId: string },
    callback?: (result: { ok: boolean; error?: string }) => void,
  ) => void
  'typing:start': (roomCode: string) => void
  'typing:stop': (roomCode: string) => void
}

type ServerToClientEvents = {
  'room:joined': (data: { roomCode: string }) => void
  'room:members': (data: { count: number }) => void
  'room:participants': (participants: Participant[]) => void
  'room:error': (message: string) => void
  'message:new': (message: ChatMessage) => void
  'typing:update': (data: {
    participantId: string
    participantName: string
    isTyping: boolean
  }) => void
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
const typingParticipants = new Map<string, Set<string>>()

app.get('/', (_req, res) => {
  res.json({ status: 'Chatty server is running' })
})

function getRoomParticipants(roomCode: string): Participant[] {
  const room = io.sockets.adapter.rooms.get(roomCode)

  if (!room) return []

  return Array.from(room).map((socketId) => ({
    id: socketId,
    name: participantNames.get(socketId) ?? 'Guest',
  }))
}

function broadcastRoomStatus(roomCode: string) {
  const participants = getRoomParticipants(roomCode)

  io.to(roomCode).emit('room:members', {
    count: participants.length,
  })

  io.to(roomCode).emit('room:participants', participants)
}

function stopTyping(socketId: string, roomCode: string) {
  const typingSet = typingParticipants.get(roomCode)

  if (!typingSet?.has(socketId)) return

  typingSet.delete(socketId)

  if (typingSet.size === 0) {
    typingParticipants.delete(roomCode)
  }

  io.to(roomCode).emit('typing:update', {
    participantId: socketId,
    participantName: participantNames.get(socketId) ?? 'Guest',
    isTyping: false,
  })
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`)

  socket.on('room:join', ({ roomCode, senderName }) => {
    const normalizedRoomCode = roomCode.trim().toUpperCase()
    const normalizedName = senderName.trim().slice(0, 24)

    if (!/^[A-Z0-9-]{4,20}$/.test(normalizedRoomCode)) {
      socket.emit('room:error', 'Please enter a valid room code.')
      return
    }

    if (!normalizedName) {
      socket.emit('room:error', 'Please enter your display name.')
      return
    }

    for (const existingRoom of socket.rooms) {
      if (existingRoom !== socket.id) {
        stopTyping(socket.id, existingRoom)
        socket.leave(existingRoom)
        broadcastRoomStatus(existingRoom)
      }
    }

    participantNames.set(socket.id, normalizedName)
    socket.join(normalizedRoomCode)

    socket.emit('room:joined', {
      roomCode: normalizedRoomCode,
    })

    broadcastRoomStatus(normalizedRoomCode)
    console.log(`${normalizedName} joined ${normalizedRoomCode}`)
  })

  socket.on('room:leave', (roomCode) => {
    const normalizedRoomCode = roomCode.trim().toUpperCase()

    if (!socket.rooms.has(normalizedRoomCode)) return

    stopTyping(socket.id, normalizedRoomCode)
    socket.leave(normalizedRoomCode)
    broadcastRoomStatus(normalizedRoomCode)
  })

  socket.on('message:send', (message, callback) => {
    const roomCode = Array.from(socket.rooms).find(
      (room) => room !== socket.id,
    )

    if (!roomCode) {
      callback?.({ ok: false, error: 'Join a room before sending messages.' })
      return
    }

    const text = message.text.trim()

    if (!text) {
      callback?.({ ok: false, error: 'Message cannot be empty.' })
      return
    }

    if (text.length > 5000) {
      callback?.({ ok: false, error: 'Message is too long.' })
      return
    }

    stopTyping(socket.id, roomCode)

    const newMessage: ChatMessage = {
      id: message.id,
      roomCode,
      text,
      senderId: socket.id,
      senderName: participantNames.get(socket.id) ?? 'Guest',
      createdAt: new Date().toISOString(),
    }

    io.to(roomCode).emit('message:new', newMessage)
    callback?.({ ok: true })
  })

  socket.on('typing:start', (roomCode) => {
    const normalizedRoomCode = roomCode.trim().toUpperCase()

    if (!socket.rooms.has(normalizedRoomCode)) return

    let typingSet = typingParticipants.get(normalizedRoomCode)

    if (!typingSet) {
      typingSet = new Set<string>()
      typingParticipants.set(normalizedRoomCode, typingSet)
    }

    if (typingSet.has(socket.id)) return

    typingSet.add(socket.id)

    socket.to(normalizedRoomCode).emit('typing:update', {
      participantId: socket.id,
      participantName: participantNames.get(socket.id) ?? 'Guest',
      isTyping: true,
    })
  })

  socket.on('typing:stop', (roomCode) => {
    const normalizedRoomCode = roomCode.trim().toUpperCase()

    if (!socket.rooms.has(normalizedRoomCode)) return

    stopTyping(socket.id, normalizedRoomCode)
  })

  socket.on('disconnecting', () => {
    for (const roomCode of socket.rooms) {
      if (roomCode !== socket.id) {
        stopTyping(socket.id, roomCode)
        broadcastRoomStatus(roomCode)
      }
    }
  })

  socket.on('disconnect', () => {
    participantNames.delete(socket.id)
    console.log(`Disconnected: ${socket.id}`)
  })
})

const PORT = Number(process.env.PORT) || 3001

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Chatty server running on port ${PORT}`)
})
