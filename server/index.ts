
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs'
import { dirname, resolve } from 'path'

const app = express()

const PORT = Number(process.env.PORT) || 3001

const allowedOrigins = (
  process.env.CLIENT_URL ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://localhost:5175'
)
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      callback(null, true)
      return
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`))
  },
  methods: ['GET', 'POST'],
}

app.use(cors(corsOptions))
app.use(express.json())

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: corsOptions,
})

type ChatMessage = {
  id: string
  roomCode: string
  text: string
  senderId: string
  senderName: string
  createdAt: string
}

type Participant = {
  id: string
  name: string
}

type SavedHistory = Record<string, ChatMessage[]>

const HISTORY_LIMIT = 50
const historyFile = resolve(process.cwd(), 'server', 'chat-history.json')

const rooms = new Map<string, ChatMessage[]>()
const participants = new Map<string, Map<string, Participant>>()
const typingUsers = new Map<string, Set<string>>()

function loadHistory() {
  if (!existsSync(historyFile)) return

  try {
    const content = readFileSync(historyFile, 'utf8')
    const saved = JSON.parse(content) as SavedHistory

    for (const [roomCode, messages] of Object.entries(saved)) {
      if (
        Array.isArray(messages) &&
        messages.every(
          message =>
            message &&
            typeof message.id === 'string' &&
            typeof message.text === 'string' &&
            typeof message.senderId === 'string' &&
            typeof message.senderName === 'string' &&
            typeof message.createdAt === 'string',
        )
      ) {
        rooms.set(roomCode, messages)
      }
    }

    console.log(`Loaded saved history for ${rooms.size} room(s).`)
  } catch (error) {
    console.error('Could not load saved chat history:', error)
  }
}

function saveHistory() {
  try {
    mkdirSync(dirname(historyFile), { recursive: true })

    const saved: SavedHistory = Object.fromEntries(rooms.entries())

    writeFileSync(historyFile, JSON.stringify(saved, null, 2), 'utf8')
  } catch (error) {
    console.error('Could not save chat history:', error)
  }
}

loadHistory()

function getRoom(code: string) {
  if (!rooms.has(code)) rooms.set(code, [])
  return rooms.get(code)!
}

function getParticipants(code: string) {
  if (!participants.has(code)) participants.set(code, new Map())
  return participants.get(code)!
}

function broadcastParticipants(code: string) {
  const members = Array.from(getParticipants(code).values())

  io.to(code).emit('room:participants', members)
  io.to(code).emit('room:members', { count: members.length })
}

io.on('connection', socket => {
  socket.on(
    'room:join',
    (data: { roomCode: string; senderName: string }) => {
      const roomCode = String(data?.roomCode || '').trim().toUpperCase()
      const senderName = String(data?.senderName || '').trim().slice(0, 24)

      if (!roomCode || !senderName) return

      const oldRoom = socket.data.roomCode as string | undefined

      if (oldRoom && oldRoom !== roomCode) {
        socket.leave(oldRoom)
        getParticipants(oldRoom).delete(socket.id)
        typingUsers.get(oldRoom)?.delete(socket.id)
        broadcastParticipants(oldRoom)
      }

      socket.join(roomCode)
      socket.data.roomCode = roomCode
      socket.data.participantName = senderName

      getParticipants(roomCode).set(socket.id, {
        id: socket.id,
        name: senderName,
      })

      const allMessages = getRoom(roomCode)
      const latestMessages = allMessages.slice(-HISTORY_LIMIT)

      socket.emit('room:joined', { roomCode })
      socket.emit('room:messages', latestMessages)
      socket.emit('history:status', {
        hasMore: allMessages.length > latestMessages.length,
      })

      broadcastParticipants(roomCode)
    },
  )

  socket.on(
    'history:older',
    (data: { roomCode: string; beforeId: string }) => {
      const roomCode = String(data?.roomCode || '').trim().toUpperCase()
      const beforeId = String(data?.beforeId || '')

      if (!roomCode || !beforeId || !socket.rooms.has(roomCode)) return

      const allMessages = getRoom(roomCode)
      const beforeIndex = allMessages.findIndex(
        message => message.id === beforeId,
      )

      if (beforeIndex <= 0) {
        socket.emit('history:older:result', {
          items: [],
          hasMore: false,
        })
        return
      }

      const startIndex = Math.max(0, beforeIndex - HISTORY_LIMIT)

      socket.emit('history:older:result', {
        items: allMessages.slice(startIndex, beforeIndex),
        hasMore: startIndex > 0,
      })
    },
  )

  socket.on('room:leave', (requestedRoom?: string) => {
    const roomCode = String(
      requestedRoom || socket.data.roomCode || '',
    ).trim().toUpperCase()

    if (!roomCode) return

    socket.leave(roomCode)
    getParticipants(roomCode).delete(socket.id)
    typingUsers.get(roomCode)?.delete(socket.id)

    if (socket.data.roomCode === roomCode) {
      socket.data.roomCode = undefined
    }

    broadcastParticipants(roomCode)
  })

  socket.on(
    'message:send',
    (
      data: { id?: string; text: string; senderId?: string },
      callback?: (result: { ok: boolean; error?: string }) => void,
    ) => {
      const roomCode = socket.data.roomCode as string | undefined
      const text = String(data?.text || '').trim()

      if (!roomCode || !socket.rooms.has(roomCode)) {
        callback?.({ ok: false, error: 'Join a room before sending.' })
        return
      }

      if (!text) {
        callback?.({ ok: false, error: 'Message cannot be empty.' })
        return
      }

      const participant = getParticipants(roomCode).get(socket.id)

      if (!participant) {
        callback?.({ ok: false, error: 'Please rejoin the room.' })
        return
      }

      const message: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        roomCode,
        text: text.slice(0, 2000),
        senderId: socket.id,
        senderName: participant.name,
        createdAt: new Date().toISOString(),
      }

      getRoom(roomCode).push(message)
      saveHistory()

      io.to(roomCode).emit('message:new', message)
      callback?.({ ok: true })
    },
  )

  socket.on(
    'message:delete',
    (data: { roomCode: string; messageId: string }) => {
      const roomCode = String(data?.roomCode || '').trim().toUpperCase()
      const messageId = String(data?.messageId || '')

      if (!roomCode || !messageId || !socket.rooms.has(roomCode)) return

      const messages = getRoom(roomCode)
      const message = messages.find(item => item.id === messageId)

      if (!message || message.senderId !== socket.id) return

      rooms.set(
        roomCode,
        messages.filter(item => item.id !== messageId),
      )

      saveHistory()

      io.to(roomCode).emit('message:deleted', {
        messageId,
        roomCode,
      })
    },
  )

  function updateTyping(isTyping: boolean) {
    const roomCode = socket.data.roomCode as string | undefined

    if (!roomCode || !socket.rooms.has(roomCode)) return

    if (!typingUsers.has(roomCode)) {
      typingUsers.set(roomCode, new Set())
    }

    const typing = typingUsers.get(roomCode)!

    if (isTyping) typing.add(socket.id)
    else typing.delete(socket.id)

    socket.to(roomCode).emit('typing:update', {
      participantId: socket.id,
      participantName: socket.data.participantName || 'Someone',
      isTyping,
    })
  }

  socket.on('typing:start', () => updateTyping(true))
  socket.on('typing:stop', () => updateTyping(false))

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode as string | undefined

    if (roomCode) {
      getParticipants(roomCode).delete(socket.id)
      typingUsers.get(roomCode)?.delete(socket.id)
      broadcastParticipants(roomCode)

      socket.to(roomCode).emit('typing:update', {
        participantId: socket.id,
        participantName: socket.data.participantName || 'Someone',
        isTyping: false,
      })
    }
  })
})

app.get('/', (_req, res) => {
  res.send('Chatty server is running')
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Chatty server running on port ${PORT}`)
  console.log(`Allowed frontend origins: ${allowedOrigins.join(', ')}`)
})
