
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Button from './Button'

type ChatRoomProps = {
  roomCode: string
  onLeave: () => void
}

type Message = {
  id: number
  text: string
  sender: 'you' | 'friend'
  time: string
}

function getCurrentTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStorageKey(roomCode: string) {
  return `chatty-messages-${roomCode}`
}

function loadMessages(roomCode: string): Message[] {
  try {
    const savedMessages = localStorage.getItem(getStorageKey(roomCode))

    if (savedMessages) {
      const parsed: unknown = JSON.parse(savedMessages)

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is Message =>
            item !== null &&
            typeof item === 'object' &&
            typeof item.id === 'number' &&
            typeof item.text === 'string' &&
            (item.sender === 'you' || item.sender === 'friend') &&
            typeof item.time === 'string',
        )
      }
    }
  } catch {
    // Stored data may be unavailable or invalid.
  }

  return [
    {
      id: 1,
      text: 'Welcome to the room! 👋',
      sender: 'friend',
      time: getCurrentTime(),
    },
  ]
}

function ChatRoom({ roomCode, onLeave }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>(() =>
    loadMessages(roomCode),
  )
  const [message, setMessage] = useState('')
  const [copyLabel, setCopyLabel] = useState('Copy code')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sentCount = messages.filter(
    (item) => item.sender === 'you',
  ).length

  useEffect(() => {
    try {
      localStorage.setItem(
        getStorageKey(roomCode),
        JSON.stringify(messages),
      )
    } catch {
      // The chat still works if storage is unavailable.
    }
  }, [messages, roomCode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = message.trim()

    if (!text) return

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: Date.now(),
        text,
        sender: 'you',
        time: getCurrentTime(),
      },
    ])

    setMessage('')
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopyLabel('Copied!')

      window.setTimeout(() => setCopyLabel('Copy code'), 1500)
    } catch {
      setCopyLabel('Copy unavailable')
      window.setTimeout(() => setCopyLabel('Copy code'), 1500)
    }
  }

  return (
    <main className="min-h-screen bg-milk p-4 text-plum sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-plum/10 bg-white/70 shadow-sm sm:min-h-[calc(100vh-4rem)]">
        <header className="flex items-center justify-between gap-4 border-b border-plum/10 px-5 py-5 sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Chatty
            </h1>
            <p className="mt-1 text-sm text-plum-soft">
              Your little corner of the internet.
            </p>
          </div>

          <Button
            variant="secondary"
            className="w-auto shrink-0 px-4 py-2.5 text-sm"
            onClick={onLeave}
          >
            Leave room
          </Button>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-3 border-b border-plum/10 bg-plum-light/40 px-5 py-4 sm:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-plum-soft">
              Room code
            </p>
            <p className="mt-1 font-mono text-lg font-bold tracking-[0.2em]">
              {roomCode}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-plum-soft sm:text-sm">
              {sentCount} {sentCount === 1 ? 'message sent' : 'messages sent'}
            </span>

            <button
              type="button"
              onClick={copyRoomCode}
              className="rounded-lg border border-plum/20 px-3 py-2 text-sm font-medium transition hover:bg-plum-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum-muted"
            >
              {copyLabel}
            </button>
          </div>
        </section>

        <section
          aria-label="Chat messages"
          aria-live="polite"
          className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6 sm:px-8"
        >
          <p className="text-center text-xs text-plum-muted">
            Your messages are saved in this browser.
          </p>

          {messages.map((item) => {
            const isYou = item.sender === 'you'

            return (
              <div
                key={item.id}
                className={`flex ${isYou ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[85%] sm:max-w-[70%]">
                  <div
                    className={`break-words rounded-2xl px-4 py-3 text-sm leading-6 sm:text-base ${
                      isYou
                        ? 'rounded-br-sm bg-plum text-milk'
                        : 'rounded-bl-sm bg-plum-light text-plum'
                    }`}
                  >
                    {item.text}
                  </div>

                  <p
                    className={`mt-1 text-xs text-plum-muted ${
                      isYou ? 'text-right' : 'text-left'
                    }`}
                  >
                    {isYou ? 'You' : 'Friend'} · {item.time}
                  </p>
                </div>
              </div>
            )
          })}

          <div ref={messagesEndRef} />
        </section>

        <form
          onSubmit={sendMessage}
          className="border-t border-plum/10 bg-white/60 p-4 sm:p-6"
        >
          <div className="flex w-full items-center gap-3">
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write a message..."
              aria-label="Write a message"
              maxLength={1000}
              style={{ width: '100%', flex: '1 1 0%', minWidth: 0 }}
              className="rounded-xl border border-plum/20 bg-milk px-4 py-3 text-sm text-plum outline-none placeholder:text-plum-soft/70 focus:border-plum focus:ring-2 focus:ring-plum/10 sm:text-base"
            />

            <Button
              type="submit"
              disabled={!message.trim()}
              className="w-auto shrink-0 px-5 py-3"
            >
              Send
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-plum-muted">
            A simple space to talk, without the noise.
          </p>
        </form>
      </div>
    </main>
  )
}

export default ChatRoom
