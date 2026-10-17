
import { useState } from 'react'
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

function ChatRoom({ roomCode, onLeave }: ChatRoomProps) {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Welcome to the room! 👋',
      sender: 'friend',
      time: 'Just now',
    },
  ])

  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const text = message.trim()

    if (!text) return

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: Date.now(),
        text,
        sender: 'you',
        time: 'Just now',
      },
    ])

    setMessage('')
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode)
    } catch {
      // Clipboard access may be unavailable in some browsers.
    }
  }

  return (
    <main className="min-h-screen bg-milk p-4 text-plum sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-plum/10 bg-white/70 shadow-sm">
        <header className="flex items-center justify-between gap-4 border-b border-plum/10 px-5 py-5 sm:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Chatty
            </h1>
            <p className="mt-1 text-sm text-plum-soft">Your little corner of the internet.</p>
          </div>

          <Button
            variant="secondary"
            className="w-auto px-4 py-2.5 text-sm"
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

          <button
            type="button"
            onClick={copyRoomCode}
            className="rounded-lg border border-plum/20 px-3 py-2 text-sm font-medium transition hover:bg-plum-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum-muted"
          >
            Copy code
          </button>
        </section>

        <section
          aria-label="Chat messages"
          className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6 sm:px-8"
        >
          <p className="text-center text-xs text-plum-muted">
            This is the beginning of your conversation.
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
                    className={`rounded-2xl px-4 py-3 text-sm leading-6 sm:text-base ${
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
        </section>

        <form
          onSubmit={sendMessage}
          className="border-t border-plum/10 bg-white/60 p-4 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write a message..."
              aria-label="Write a message"
              maxLength={1000}
              className="min-w-0 flex-1 rounded-xl border border-plum/15 bg-milk px-4 py-3 text-sm outline-none transition placeholder:text-plum-soft/70 focus:border-plum focus:ring-2 focus:ring-plum/10 sm:text-base"
            />

            <Button
              type="submit"
              disabled={!message.trim()}
              className="w-auto px-5 py-3"
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
