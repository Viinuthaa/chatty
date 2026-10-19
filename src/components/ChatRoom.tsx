
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
    const saved = localStorage.getItem(getStorageKey(roomCode))

    if (saved !== null) {
      const parsed: unknown = JSON.parse(saved)

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
    // Ignore unavailable or invalid stored data.
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
  const [shareLabel, setShareLabel] = useState('Share invite link')

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
      // Keep the current conversation usable without storage.
    }
  }, [messages, roomCode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = message.trim()
    if (!text) return

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        text,
        sender: 'you',
        time: getCurrentTime(),
      },
    ])

    setMessage('')
  }

  function deleteMessage(id: number) {
    setMessages((current) =>
      current.filter((item) => item.id !== id),
    )
  }

  function clearChat() {
    if (messages.length === 0) return

    const confirmed = window.confirm(
      'Clear all messages in this room on this browser? This cannot be undone.',
    )

    if (confirmed) {
      setMessages([])
    }
  }

  async function shareInvite() {
    const inviteUrl = new URL(window.location.href)
    inviteUrl.searchParams.set('room', roomCode)
    const link = inviteUrl.toString()

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my Chatty room',
          text: `Join my Chatty room with code ${roomCode}`,
          url: link,
        })
        setShareLabel('Invite shared!')
      } else {
        await navigator.clipboard.writeText(link)
        setShareLabel('Link copied!')
      }
    } catch {
      try {
        await navigator.clipboard.writeText(link)
        setShareLabel('Link copied!')
      } catch {
        setShareLabel('Unable to share')
      }
    }

    window.setTimeout(() => setShareLabel('Share invite link'), 2000)
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-milk p-0 text-plum sm:p-4 lg:p-8">
      <div className="mx-auto flex h-full min-h-0 max-w-5xl flex-col overflow-hidden border-x border-plum/10 bg-white/70 shadow-sm sm:rounded-2xl sm:border">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-plum/10 px-4 py-3 sm:gap-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Chatty
            </h1>
            <p className="mt-1 hidden text-sm text-plum-soft sm:block">
              Your little corner of the internet.
            </p>
          </div>

          <Button
            variant="secondary"
            className="w-auto shrink-0 px-3 py-2 text-sm sm:px-4 sm:py-2.5"
            onClick={onLeave}
          >
            Leave room
          </Button>
        </header>

        <section className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-plum/10 bg-plum-light/40 px-4 py-3 sm:gap-3 sm:px-8 sm:py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-plum-soft">
              Room code
            </p>
            <p className="mt-1 font-mono text-base font-bold tracking-[0.2em] sm:text-lg">
              {roomCode}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <span className="text-xs text-plum-soft sm:text-sm">
              {sentCount} {sentCount === 1 ? 'message' : 'messages'} sent
            </span>

            <button
              type="button"
              onClick={shareInvite}
              className="rounded-lg border border-plum/20 px-3 py-2 text-xs font-medium transition hover:bg-plum-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum-muted sm:text-sm"
            >
              {shareLabel}
            </button>
          </div>
        </section>

        <section
          aria-label="Chat messages"
          aria-live="polite"
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-plum-muted">
              Messages are saved in this browser.
            </p>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="rounded-md px-2 py-1 text-xs font-medium text-plum-soft underline decoration-plum/30 underline-offset-4 transition hover:text-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum-muted"
              >
                Clear chat
              </button>
            )}
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <p className="text-lg font-semibold">It's quiet in here.</p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-plum-soft">
                Your conversation is empty. Send a message to get things started.
              </p>
            </div>
          ) : (
            messages.map((item) => {
              const isYou = item.sender === 'you'

              return (
                <div
                  key={item.id}
                  className={`flex ${
                    isYou ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div className="max-w-[88%] sm:max-w-[70%]">
                    <div
                      className={`break-words whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:text-base ${
                        isYou
                          ? 'rounded-br-sm bg-plum text-milk'
                          : 'rounded-bl-sm bg-plum-light text-plum'
                      }`}
                    >
                      {item.text}
                    </div>

                    <div
                      className={`mt-1 flex items-center gap-2 text-xs text-plum-muted ${
                        isYou ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span>
                        {isYou ? 'You' : 'Friend'} · {item.time}
                      </span>

                      {isYou && (
                        <button
                          type="button"
                          onClick={() => deleteMessage(item.id)}
                          aria-label={`Delete message: ${item.text}`}
                          className="rounded px-1 py-0.5 underline decoration-plum/30 underline-offset-2 transition hover:text-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum-muted"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          <div ref={messagesEndRef} />
        </section>

        <form
          onSubmit={sendMessage}
          className="shrink-0 border-t border-plum/10 bg-white/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6"
        >
          <div className="flex w-full items-center gap-2 sm:gap-3">
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write a message..."
              aria-label="Write a message"
              maxLength={1000}
              style={{ width: '100%', flex: '1 1 0%', minWidth: 0 }}
              className="rounded-xl border border-plum/20 bg-milk px-3 py-3 text-base text-plum outline-none placeholder:text-plum-soft/70 focus:border-plum focus:ring-2 focus:ring-plum/10 sm:px-4"
            />

            <Button
              type="submit"
              disabled={!message.trim()}
              className="w-auto shrink-0 px-4 py-3 sm:px-5"
            >
              Send
            </Button>
          </div>

          <p className="mt-2 hidden text-center text-xs text-plum-muted sm:block">
            A simple space to talk, without the noise.
          </p>
        </form>
      </div>
    </main>
  )
}

export default ChatRoom
