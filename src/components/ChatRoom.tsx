
import { useCallback, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import Button from './Button'

type Message = {
  id: string
  text: string
  sender: string
  senderId?: string
  createdAt: string
}

type ServerMessage = {
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

type TypingUpdate = {
  participantId: string
  participantName: string
  isTyping: boolean
}

type ServerToClientEvents = {
  'room:joined': (data: { roomCode: string }) => void
  'room:members': (data: { count: number }) => void
  'room:participants': (items: Participant[]) => void
  'room:error': (message: string) => void
  'room:messages': (items: ServerMessage[]) => void
  'history:status': (data: { hasMore: boolean }) => void
  'history:older:result': (data: {
    items: ServerMessage[]
    hasMore: boolean
  }) => void
  'message:new': (message: ServerMessage) => void
  'message:deleted': (data: {
    messageId: string
    roomCode: string
  }) => void
  'typing:update': (data: TypingUpdate) => void
}

type ClientToServerEvents = {
  'room:join': (data: {
    roomCode: string
    senderName: string
  }) => void
  'room:leave': (roomCode: string) => void
  'history:older': (data: {
    roomCode: string
    beforeId: string
  }) => void
  'message:send': (
    data: { id: string; text: string; senderId: string },
    callback?: (result: {
      ok: boolean
      error?: string
    }) => void,
  ) => void
  'message:delete': (data: {
    roomCode: string
    messageId: string
  }) => void
  'typing:start': (roomCode: string) => void
  'typing:stop': (roomCode: string) => void
}

type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>

type ChatRoomProps = {
  roomCode: string
  onLeave: () => void
}

const SERVER_URL = 'http://localhost:3001'
const NAME_KEY = 'chatty-display-name'

function getSenderId() {
  const key = 'chatty-sender-id'
  let id = localStorage.getItem(key)

  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }

  return id
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default function ChatRoom({
  roomCode,
  onLeave,
}: ChatRoomProps) {
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem(NAME_KEY) ?? '',
  )

  const [nameInput, setNameInput] = useState(
    () => localStorage.getItem(NAME_KEY) ?? '',
  )

  const [joined, setJoined] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [message, setMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [shareLabel, setShareLabel] = useState('Share invite link')
  const [connectionStatus, setConnectionStatus] = useState('Connecting…')
  const [memberCount, setMemberCount] = useState(0)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingUpdate[]>([])
  const [roomError, setRoomError] = useState('')

  const socketRef = useRef<ChatSocket | null>(null)
  const senderId = useRef(getSenderId()).current
  const bottomRef = useRef<HTMLDivElement>(null)

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  const isTypingRef = useRef(false)

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    if (isTypingRef.current) {
      socketRef.current?.emit('typing:stop', roomCode)
      isTypingRef.current = false
    }
  }, [roomCode])

  useEffect(() => {
    const socket: ChatSocket = io(SERVER_URL)
    socketRef.current = socket

    socket.on('connect', () => {
      setConnectionStatus('Connected')
      setRoomError('')

      const savedName = localStorage.getItem(NAME_KEY)?.trim()

      if (savedName) {
        setDisplayName(savedName)
        setNameInput(savedName)

        socket.emit('room:join', {
          roomCode,
          senderName: savedName,
        })
      }
    })

    socket.on('disconnect', () => {
      setConnectionStatus('Reconnecting…')
      setMemberCount(0)
      setParticipants([])
      setTypingUsers([])
      setJoined(false)
      setLoadingOlderMessages(false)
      isTypingRef.current = false
    })

    socket.on('connect_error', () => {
      setConnectionStatus('Server unavailable')
    })

    socket.on('room:joined', () => {
      setJoined(true)
      setRoomError('')
    })

    socket.on('room:members', ({ count }) => {
      setMemberCount(count)
    })

    socket.on('room:participants', setParticipants)
    socket.on('room:error', setRoomError)

    socket.on('room:messages', incoming => {
      setMessages(current => {
        const merged = [...current]

        incoming.forEach(item => {
          if (!merged.some(existing => existing.id === item.id)) {
            merged.push({
              id: item.id,
              text: item.text,
              senderId: item.senderId,
              sender: item.senderName,
              createdAt: item.createdAt,
            })
          }
        })

        return merged.sort(
          (first, second) =>
            new Date(first.createdAt).getTime() -
            new Date(second.createdAt).getTime(),
        )
      })
    })

    socket.on('history:status', ({ hasMore }) => {
      setHasOlderMessages(hasMore)
    })

    socket.on('history:older:result', ({ items, hasMore }) => {
      const olderMessages: Message[] = items.map(item => ({
        id: item.id,
        text: item.text,
        senderId: item.senderId,
        sender: item.senderName,
        createdAt: item.createdAt,
      }))

      setMessages(current => {
        const existingIds = new Set(current.map(item => item.id))

        const uniqueOlder = olderMessages.filter(
          item => !existingIds.has(item.id),
        )

        return [...uniqueOlder, ...current].sort(
          (first, second) =>
            new Date(first.createdAt).getTime() -
            new Date(second.createdAt).getTime(),
        )
      })

      setHasOlderMessages(hasMore)
      setLoadingOlderMessages(false)
    })

    socket.on('typing:update', update => {
      if (update.participantId === socket.id) return

      setTypingUsers(current => {
        const others = current.filter(
          user => user.participantId !== update.participantId,
        )

        return update.isTyping ? [...others, update] : others
      })
    })

    socket.on('message:new', incoming => {
      if (incoming.roomCode !== roomCode) return

      const received: Message = {
        id: incoming.id,
        text: incoming.text,
        senderId: incoming.senderId,
        sender: incoming.senderName,
        createdAt: incoming.createdAt,
      }

      setMessages(current =>
        current.some(item => item.id === received.id)
          ? current
          : [...current, received],
      )

      setTypingUsers(current =>
        current.filter(
          user => user.participantId !== incoming.senderId,
        ),
      )
    })

    socket.on(
      'message:deleted',
      ({ messageId, roomCode: deletedRoom }) => {
        if (deletedRoom !== roomCode) return

        setMessages(current =>
          current.filter(item => item.id !== messageId),
        )
      },
    )

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      setLoadingOlderMessages(false)

      if (socket.connected) {
        socket.emit('room:leave', roomCode)
      }

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
  }, [messages, searchQuery, typingUsers])

  const leaveRoom = useCallback(() => {
    stopTyping()

    const socket = socketRef.current

    if (socket?.connected) {
      socket.emit('room:leave', roomCode)
    }

    onLeave()
  }, [onLeave, roomCode, stopTyping])

  function joinWithName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = nameInput.trim().slice(0, 24)

    if (!name) {
      setRoomError('Please enter your display name.')
      return
    }

    localStorage.setItem(NAME_KEY, name)
    setDisplayName(name)
    setRoomError('')

    const socket = socketRef.current

    if (socket?.connected) {
      socket.emit('room:join', {
        roomCode,
        senderName: name,
      })
    } else {
      setRoomError(
        'Connecting to the server. Please try again shortly.',
      )
    }
  }

  function handleMessageChange(value: string) {
    setMessage(value)

    const socket = socketRef.current

    if (!joined || !socket?.connected) return

    if (value.trim()) {
      if (!isTypingRef.current) {
        socket.emit('typing:start', roomCode)
        isTypingRef.current = true
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', roomCode)
        isTypingRef.current = false
        typingTimeoutRef.current = null
      }, 1200)
    } else {
      stopTyping()
    }
  }

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = message.trim()
    const socket = socketRef.current

    if (!text || !socket?.connected || !joined) {
      if (!joined) {
        setRoomError('Join the room before sending messages.')
      }

      return
    }

    stopTyping()

    socket.emit(
      'message:send',
      {
        id: crypto.randomUUID(),
        text,
        senderId,
      },
      result => {
        if (!result.ok) {
          setRoomError(
            result.error ?? 'Could not send the message.',
          )
        } else {
          setRoomError('')
          setMessage('')
        }
      },
    )
  }

  function loadOlderMessages() {
    const socket = socketRef.current
    const oldestMessage = messages[0]

    if (
      !socket?.connected ||
      !joined ||
      !oldestMessage ||
      !hasOlderMessages ||
      loadingOlderMessages
    ) {
      return
    }

    setLoadingOlderMessages(true)

    socket.emit('history:older', {
      roomCode,
      beforeId: oldestMessage.id,
    })
  }

  function deleteMessage(item: Message) {
    const socket = socketRef.current

    if (!socket?.connected || !joined) {
      setRoomError(
        'Reconnect to the room before deleting messages.',
      )
      return
    }

    if (item.senderId !== socket.id) {
      setRoomError('You can only delete messages you sent.')
      return
    }

    socket.emit('message:delete', {
      roomCode,
      messageId: item.id,
    })
  }

  function clearChat() {
    if (
      window.confirm(
        'Clear all messages in this chat on this device?',
      )
    ) {
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

    window.setTimeout(() => {
      setShareLabel('Share invite link')
    }, 2000)
  }

  const filteredMessages = messages.filter(item =>
    item.text
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase()),
  )

  function renderMessageText(text: string) {
    const query = searchQuery.trim()

    if (!query) return text

    return text
      .split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
      .map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={index}
            className="rounded bg-plum-light text-plum"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )
  }

  if (connectionStatus === 'Server unavailable') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-milk px-6 text-plum">
        <div className="w-full max-w-md rounded-2xl border border-plum/10 bg-white/70 p-8 text-center">
          <h1 className="text-3xl font-bold">Chatty</h1>

          <p className="mt-4 text-plum-soft">
            The chat server is unavailable. Please check your connection.
          </p>

          <Button className="mt-6" onClick={onLeave}>
            Back to home
          </Button>
        </div>
      </main>
    )
  }

  if (!joined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-milk px-6 text-plum">
        <form
          onSubmit={joinWithName}
          className="w-full max-w-md rounded-2xl border border-plum/10 bg-white/70 p-8"
        >
          <h1 className="text-center text-4xl font-bold tracking-tight">
            Chatty
          </h1>

          <p className="mt-3 text-center text-plum-soft">
            You're joining room <strong>{roomCode}</strong>
          </p>

          <label
            htmlFor="display-name"
            className="mt-8 block text-sm font-medium"
          >
            What should we call you?
          </label>

          <input
            id="display-name"
            value={nameInput}
            onChange={event => setNameInput(event.target.value)}
            placeholder="Enter your name"
            maxLength={24}
            autoComplete="nickname"
            className="mt-2 w-full rounded-xl border border-plum/20 bg-white px-4 py-3 outline-none focus:border-plum"
          />

          {roomError && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {roomError}
            </p>
          )}

          <Button type="submit" className="mt-5">
            Join Room
          </Button>

          <button
            type="button"
            onClick={onLeave}
            className="mt-4 w-full text-sm text-plum-soft underline underline-offset-4"
          >
            Back to home
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-milk px-4 py-5 text-plum sm:px-6 sm:py-8">
      <section className="mx-auto flex h-[calc(100dvh-2.5rem)] max-w-3xl flex-col overflow-hidden rounded-2xl border border-plum/10 bg-white/60 shadow-sm sm:h-[calc(100dvh-4rem)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-plum/10 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Chatty
            </h1>

            <p className="mt-1 text-sm text-plum-soft">
              Room{' '}
              <span className="font-semibold tracking-widest">
                {roomCode}
              </span>
            </p>

            <p className="mt-1 text-xs text-plum-muted">
              {connectionStatus} · {memberCount}{' '}
              {memberCount === 1 ? 'member' : 'members'} · {displayName}
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

        <div className="border-b border-plum/10 bg-white/40 px-4 py-3 sm:px-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-plum-soft">
            Online now ({participants.length})
          </p>

          <div className="flex flex-wrap gap-2">
            {participants.map(participant => (
              <span
                key={participant.id}
                className="inline-flex items-center gap-2 rounded-full border border-plum/10 bg-white px-3 py-1.5 text-sm"
              >
                <span className="h-2 w-2 rounded-full bg-green-500" />

                {participant.name}

                {participant.id === socketRef.current?.id
                  ? ' (you)'
                  : ''}
              </span>
            ))}

            {participants.length === 0 && (
              <span className="text-xs text-plum-muted">
                Loading members…
              </span>
            )}
          </div>
        </div>

        {roomError && (
          <p role="alert" className="px-4 pt-3 text-sm text-red-700 sm:px-6">
            {roomError}
          </p>
        )}

        <div className="border-b border-plum/10 p-3 sm:px-6">
          <input
            type="search"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search messages…"
            aria-label="Search messages"
            className="w-full rounded-xl border border-plum/15 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-plum"
          />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {hasOlderMessages && !searchQuery.trim() && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                className="w-auto px-4 py-2 text-sm"
                onClick={loadOlderMessages}
                disabled={loadingOlderMessages || !joined}
              >
                {loadingOlderMessages
                  ? 'Loading older messages…'
                  : 'Load older messages'}
              </Button>
            </div>
          )}

          {filteredMessages.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center text-center">
              <p className="font-medium">
                {searchQuery
                  ? 'No matching messages'
                  : 'Your room is ready'}
              </p>

              <p className="mt-1 text-sm text-plum-soft">
                {searchQuery
                  ? 'Try another search.'
                  : 'Send a message to start the conversation.'}
              </p>
            </div>
          ) : (
            filteredMessages.map(item => {
              const ownMessage =
                item.senderId === socketRef.current?.id

              return (
                <article
                  key={item.id}
                  className="rounded-xl bg-plum-light/60 p-3 sm:p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-plum-soft">
                        {item.sender}

                        <span className="ml-2 font-normal">
                          {new Date(item.createdAt).toLocaleTimeString(
                            [],
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </span>
                      </p>

                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                        {renderMessageText(item.text)}
                      </p>
                    </div>

                    {ownMessage && (
                      <button
                        type="button"
                        onClick={() => deleteMessage(item)}
                        aria-label="Delete message"
                        title="Delete message"
                        className="shrink-0 rounded-lg border border-plum/15 bg-white px-2.5 py-1.5 text-xs text-plum-soft transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              )
            })
          )}

          {typingUsers.length > 0 && (
            <p
              aria-live="polite"
              className="text-xs italic text-plum-soft"
            >
              {typingUsers
                .map(user => user.participantName)
                .join(', ')}{' '}
              {typingUsers.length === 1 ? 'is' : 'are'} typing…
            </p>
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
              onChange={event =>
                handleMessageChange(event.target.value)
              }
              placeholder="Write a message…"
              aria-label="Write a message"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-xl border border-plum/15 bg-white px-4 py-3 outline-none transition focus:border-plum"
            />

            <Button
              type="submit"
              className="w-auto shrink-0 px-4 py-3"
              disabled={!message.trim() || !joined}
            >
              Send
            </Button>
          </form>

          <p className="mt-2 text-center text-xs text-plum-muted">
            Messages are delivered live and saved on the server.
          </p>
        </div>
      </section>
    </main>
  )
}
