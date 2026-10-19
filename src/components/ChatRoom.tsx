
import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import Button from './Button'

type Message = {
  id: string
  text: string
  sender: string
  createdAt: string
}

type ChatRoomProps = {
  roomCode: string
  onLeave: () => void
}

type ServerToClientEvents = {
  'room:joined': (data: { roomCode: string }) => void
  'room:members': (data: { count: number }) => void
  'room:error': (message: string) => void
}

type ClientToServerEvents = {
  'room:join': (roomCode: string) => void
  'room:leave': (roomCode: string) => void
}

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const SERVER_URL = 'http://localhost:3001'

function loadMessages(roomCode: string): Message[] {
  try {
    const stored = localStorage.getItem(`chatty-messages-${roomCode}`)

    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed as Message[]
    }
  } catch {
    // Start with an empty conversation if stored data cannot be read.
  }

  return []
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ChatRoom({ roomCode, onLeave }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>(() =>
    loadMessages(roomCode),
  )
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [shareLabel, setShareLabel] = useState('Share invite link')
  const [connectionStatus, setConnectionStatus] = useState('Connecting…')
  const [memberCount, setMemberCount] = useState(0)
  const [roomError, setRoomError] = useState('')
  const socketRef = useRef<ChatSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const socket: ChatSocket = io(SERVER_URL)
    socketRef.current = socket

    socket.on('connect', () => {
      setConnectionStatus('Connected')
      setRoomError('')
      socket.emit('room:join', roomCode)
    })

    socket.on('disconnect', () => {
      setConnectionStatus('Reconnecting…')
      setMemberCount(0)
    })

    socket.on('connect_error', () => {
      setConnectionStatus('Server unavailable')
    })

    socket.on('room:joined', () => setRoomError(''))

    socket.on('room:members', ({ count }) => setMemberCount(count))

    socket.on('room:error', setRoomError)

    return () => {
      if (socket.connected) socket.emit('room:leave', roomCode)
      socket.disconnect()
      socketRef.current = null
    }
  }, [roomCode])

  useEffect(() => {
    localStorage.setItem(
      `chatty-messages-${roomCode}`,
      JSON.stringify(messages),
    )
  }, [messages, roomCode])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, searchQuery])

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current
    if (socket?.connected) socket.emit('room:leave', roomCode)
    onLeave()
  }, [onLeave, roomCode])

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = message.trim()
    if (!text) return

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        text,
        sender: 'You',
        createdAt: new Date().toISOString(),
      },
    ])
    setMessage('')
  }

  function deleteMessage(id: string) {
    setMessages((current) => current.filter((item) => item.id !== id))
  }

  function clearChat() {
    if (window.confirm('Clear all messages in this chat on this device?')) {
      setMessages([])
    }
  }

  async function shareInviteLink() {
    const url = new URL(window.location.href)
    url.searchParams.set('room', roomCode)

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my Chatty room',
          text: `Join my Chatty room with code ${roomCode}`,
          url: url.toString(),
        })
        setShareLabel('Invite shared!')
      } else {
        await navigator.clipboard.writeText(url.toString())
        setShareLabel('Link copied!')
      }
    } catch {
      setShareLabel('Could not share link')
    }

    window.setTimeout(() => setShareLabel('Share invite link'), 2000)
  }

  const filteredMessages = messages.filter((item) =>
    item.text.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )

  function renderMessageText(text: string) {
    const query = searchQuery.trim()
    if (!query) return text

    return text
      .split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
      .map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="rounded bg-plum-light text-plum">
            {part}
          </mark>
        ) : (
          part
        ),
      )
  }

  return (
    <main className="min-h-screen bg-milk px-4 py-5 text-plum sm:px-6 sm:py-8">
      <section className="mx-auto flex h-[calc(100dvh-2.5rem)] max-w-3xl flex-col overflow-hidden rounded-2xl border border-plum/10 bg-white/60 shadow-sm sm:h-[calc(100dvh-4rem)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-plum/10 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chatty</h1>
            <p className="mt-1 text-sm text-plum-soft">
              Room <span className="font-semibold tracking-widest">{roomCode}</span>
            </p>
            <p className="mt-1 text-xs text-plum-muted">
              {connectionStatus} · {memberCount}{' '}
              {memberCount === 1 ? 'member' : 'members'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="w-auto px-3 py-2 text-sm"
              onClick={shareInviteLink}
            >
              {shareLabel}
            </Button>
            <Button
              variant="secondary"
              className="w-auto px-3 py-2 text-sm"
              onClick={leaveRoom}
            >
              Leave
            </Button>
          </div>
        </header>

        {roomError && (
          <p role="alert" className="px-4 pt-3 text-sm text-red-700 sm:px-6">
            {roomError}
          </p>
        )}

        <div className="border-b border-plum/10 p-3 sm:px-6">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search messages…"
            aria-label="Search messages"
            className="w-full rounded-xl border border-plum/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-plum"
          />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {filteredMessages.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center text-center">
              <p className="font-medium">
                {searchQuery ? 'No matching messages' : 'Your room is ready'}
              </p>
              <p className="mt-1 text-sm text-plum-soft">
                {searchQuery
                  ? 'Try another search.'
                  : 'Send a message to start the conversation.'}
              </p>
            </div>
          ) : (
            filteredMessages.map((item) => (
              <article
                key={item.id}
                className="group rounded-xl bg-plum-light/60 p-3 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-plum-soft">
                      {item.sender}
                      <span className="ml-2 font-normal">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                      {renderMessageText(item.text)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMessage(item.id)}
                    aria-label="Delete message"
                    title="Delete message"
                    className="rounded-lg px-2 py-1 text-xs text-plum-soft transition hover:bg-white hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-plum/10 p-3 sm:p-5">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={clearChat}
              className="text-xs text-plum-soft underline decoration-plum/30 underline-offset-4 hover:text-plum"
            >
              Clear chat on this device
            </button>
          </div>
          <form onSubmit={sendMessage} className="flex min-w-0 gap-2">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write a message…"
              aria-label="Write a message"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-xl border border-plum/15 bg-white px-4 py-3 outline-none transition focus:border-plum"
            />
            <Button
              type="submit"
              className="w-auto shrink-0 px-4 py-3"
              disabled={!message.trim()}
            >
              Send
            </Button>
          </form>
          <p className="mt-2 text-center text-xs text-plum-muted">
            Messages are currently saved only in this browser.
          </p>
        </div>
      </section>
    </main>
  )
}

export default ChatRoom
